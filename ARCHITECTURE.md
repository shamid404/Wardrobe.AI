# Wardrobe.AI — Архитектура проекта

## Стек

| Компонент | Технология | Назначение |
|---|---|---|
| API сервер | FastAPI (Python) | REST API |
| База данных | PostgreSQL 16 | Хранение данных пользователей |
| Файловое хранилище | Cloudinary | Хранение фотографий одежды и аватаров |
| ORM | SQLAlchemy 2.0 | Работа с PostgreSQL из Python |
| Аутентификация | JWT (jose) + Google OAuth | Bearer-токены, вход через Google |
| AI генерация | Replicate flux-2-pro | Виртуальная примерка |
| AI ассистент | Google Gemini API | Стилист-чатбот |
| Удаление фона | remove.bg API | Обработка фото одежды |
| Погода | Open-Meteo API | Без ключа, бесплатно |
| Email верификация | SMTP (Gmail) | 6-значный код при регистрации |
| Rate limiting | slowapi | Защита эндпоинтов от злоупотреблений |
| Фронтенд | Next.js 14 (App Router) | React UI |
| Запуск инфраструктуры | Docker Compose | PostgreSQL одной командой |

---

## Структура файлов

```
backend/
├── main.py                    # Точка входа, CORS, middleware, роуты
├── auth.py                    # JWT создание/декодирование, revoke_token
├── config.py                  # Переменные окружения
├── db/
│   ├── database.py            # SQLAlchemy engine, SessionLocal, get_db
│   ├── models.py              # ORM модели (см. ниже)
│   └── memory_store.py        # hash_password / verify_password (bcrypt)
├── models/
│   └── schemas.py             # Pydantic схемы запросов и ответов
├── routers/
│   ├── auth_router.py         # Регистрация, логин, Google OAuth, профиль
│   ├── wardrobe.py            # CRUD гардероба + загрузка фото
│   ├── outfits.py             # CRUD образов (Outfit)
│   ├── assistant.py           # AI-ассистент (Gemini) — POST /assistant/chat
│   ├── chat_sessions.py       # История чатов — GET/DELETE /chat/sessions
│   ├── tryon.py               # AI примерка через Replicate
│   └── avatar.py              # Загрузка аватара, удаление фона
├── services/
│   ├── minio_service.py       # Cloudinary: upload_file / delete_file
│   ├── ai_service.py          # Вызов Replicate API
│   ├── image_service.py       # imgbb upload, url → base64
│   ├── vision_service.py      # Анализ изображений
│   └── email_service.py       # Отправка кода верификации через SMTP
└── static/
    └── defaults/              # Дефолтные фото одежды для новых юзеров
        ├── default_top.png
        ├── default_bottom.png
        └── default_outer.png

frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page (анимированная, framer-motion)
│   │   ├── layout.tsx         # Root layout
│   │   ├── login/page.tsx     # Страница входа
│   │   ├── register/page.tsx  # Страница регистрации
│   │   ├── tryon/page.tsx     # Try-On Studio
│   │   └── legacy/route.ts   # Legacy redirect
│   ├── components/
│   │   ├── AuthGuard.tsx      # Защита роутов (проверка JWT)
│   │   ├── demo.tsx           # Демо-компонент
│   │   ├── auth/
│   │   │   └── WardrobeAuth.tsx  # Форма авторизации
│   │   ├── tryon/
│   │   │   └── TryOnStudio.tsx   # UI примерочной
│   │   └── ui/
│   │       ├── button.tsx
│   │       └── background-paths.tsx
│   └── lib/
│       ├── auth.ts            # Хелперы авторизации
│       └── utils.ts           # Утилиты
└── package.json
```

---

## Инфраструктура (Docker Compose)

```yaml
services:
  postgres:   порт 5432   # база данных
```

Запуск:
```bash
docker-compose up -d
```

---

## База данных

### Таблица `users`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `user_<10 hex символов>` |
| name | String(100) | Имя пользователя |
| email | String(255) unique | Email (индекс) |
| hashed_password | String | bcrypt хеш |
| avatar_url | String? | URL аватара в Cloudinary |
| created_at | DateTime | Дата регистрации |

### Таблица `wardrobe_items`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `item_<8 hex символов>` |
| user_id | String FK → users.id | Владелец (CASCADE DELETE) |
| name | String(200) | Название вещи |
| category | String(50) | `top / bottom / outer / shoes / headwear / accessory` |
| brand | String(100)? | Бренд |
| size | String(20)? | Размер |
| color | String(50)? | Цвет |
| season | String(50)? | Сезон |
| image_url | String? | URL фото в Cloudinary или `/static/defaults/...` |
| uploaded_at | DateTime | Дата добавления |

### Таблица `outfits`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `outfit_<8 hex символов>` |
| user_id | String FK → users.id | Владелец (CASCADE DELETE) |
| name | String(200) | Название образа |
| ai_suggested | Boolean | Предложен AI-ассистентом |
| created_at | DateTime | Дата создания |

### Таблица `outfit_items`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `oi_<8 hex символов>` |
| outfit_id | String FK → outfits.id | Образ (CASCADE DELETE) |
| item_id | String FK → wardrobe_items.id | Вещь (CASCADE DELETE) |

### Таблица `chat_sessions`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `session_<8 hex символов>` |
| user_id | String FK → users.id | Владелец (CASCADE DELETE) |
| title | String(200) | Первые 60 символов первого сообщения |
| created_at | DateTime | Дата создания |

### Таблица `chat_messages`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `msg_<8 hex символов>` |
| session_id | String FK → chat_sessions.id | Сессия (CASCADE DELETE) |
| role | String(20) | `user` или `assistant` |
| content | Text | Текст сообщения |
| recommended_item_ids | Text? | JSON-массив id вещей, рекомендованных ассистентом |
| created_at | DateTime | Время сообщения |

### Таблица `tryon_history`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | — |
| user_id | String FK → users.id | Владелец (CASCADE DELETE) |
| preview_url | Text? | URL результата примерки |
| prompt | Text? | Промпт примерки |
| created_at | DateTime | Дата |

---

## Аутентификация

### Регистрация с email-верификацией (2 шага)

```
1. POST /auth/send-code  — отправить 6-значный код на email
   (code хранится в памяти 10 минут, лимит 3 запроса/мин)

2. POST /auth/verify-email — проверить код, создать User + 3 дефолтных вещи
   → вернуть JWT токен + UserOut
```

### Регистрация без верификации (legacy)
```
POST /auth/register — прямая регистрация (без email-кода)
```

### Вход
```
POST /auth/login — email + password → JWT
POST /auth/google — Google ID Token → JWT (создаёт User если нет)
```

### Токены
- JWT, 8 часов, алгоритм HS256
- Logout: `POST /auth/logout` — токен попадает в in-memory blacklist
- Все защищённые роуты: `Depends(get_current_user)` → Bearer токен

---

## Файловое хранилище (Cloudinary)

Файл `minio_service.py` сохранён для обратной совместимости импортов, но внутри использует Cloudinary SDK.

### Загрузка фото
```
bytes → base64 → cloudinary.uploader.upload(folder=...) → secure_url
```

Структура папок в Cloudinary:
```
wardrobe/{user_id}/{uuid}      ← фото одежды
avatars/{user_id}/{uuid}       ← аватары
```

### Удаление
```
URL → извлечь public_id → cloudinary.uploader.destroy(public_id)
```

---

## AI-ассистент (Gemini)

Эндпоинт: `POST /assistant/chat`

Логика:
```
1. Собрать контекст: весь гардероб + сохранённые образы пользователя
2. (опц.) Получить погоду на 7 дней с Open-Meteo по lat/lon
3. Построить system prompt + историю из БД (последние 10 сообщений сессии)
4. Вызвать Gemini (с fallback: gemini-3-flash-preview → gemini-2.5-flash-lite → gemini-2.5-flash)
5. Распарсить JSON-ответ: {message, recommended_items}
6. Сохранить сообщения в chat_messages
7. Вернуть {reply, recommended_items, session_id}
```

Ограничения: только мода/одежда/стиль, рекомендует только вещи из гардероба пользователя.

---

## Дефолтный гардероб при регистрации

| Вещь | Категория | Фото |
|---|---|---|
| Classic White Tee | top | `/static/defaults/default_top.png` |
| Slim Jeans | bottom | `/static/defaults/default_bottom.png` |
| Light Blazer | outer | `/static/defaults/default_outer.png` |

---

## API эндпоинты

### Auth
| Метод | URL | Описание | Лимит |
|---|---|---|---|
| POST | `/auth/send-code` | Отправить код верификации на email | 3/мин |
| POST | `/auth/verify-email` | Подтвердить код, создать аккаунт | 5/мин |
| POST | `/auth/register` | Регистрация без верификации | 5/мин |
| POST | `/auth/login` | Вход email+password | 10/мин |
| POST | `/auth/google` | Вход через Google OAuth | 10/мин |
| POST | `/auth/logout` | Отзыв токена | — |
| DELETE | `/auth/account` | Удалить аккаунт и все данные | — |
| GET | `/auth/me` | Данные текущего пользователя | — |
| PATCH | `/auth/me` | Обновить имя | — |
| POST | `/auth/avatar` | Загрузить аватар → Cloudinary | — |

### Wardrobe (требует JWT)
| Метод | URL | Описание |
|---|---|---|
| GET | `/wardrobe` | Список всех вещей пользователя |
| POST | `/wardrobe` | Добавить вещь (без фото) |
| PATCH | `/wardrobe/{item_id}` | Обновить поля вещи |
| DELETE | `/wardrobe/{item_id}` | Удалить вещь + фото из Cloudinary |
| POST | `/wardrobe/{item_id}/image` | Загрузить фото вещи → Cloudinary |

### Outfits (требует JWT)
| Метод | URL | Описание |
|---|---|---|
| GET | `/outfits` | Список образов пользователя |
| POST | `/outfits` | Создать образ из вещей |
| DELETE | `/outfits/{outfit_id}` | Удалить образ |

### Assistant (требует JWT)
| Метод | URL | Описание | Лимит |
|---|---|---|---|
| POST | `/assistant/chat` | Чат с AI-стилистом (Gemini) | 20/мин |

### Chat Sessions (требует JWT)
| Метод | URL | Описание |
|---|---|---|
| GET | `/chat/sessions` | Список всех сессий |
| GET | `/chat/sessions/{id}/messages` | Сообщения сессии с рекомендованными вещами |
| DELETE | `/chat/sessions/{id}` | Удалить сессию |

### Try-On (требует JWT)
| Метод | URL | Описание |
|---|---|---|
| POST | `/generate-tryon` | AI примерка через Replicate |
| GET | `/history` | История примерок |

### Avatar (требует JWT)
| Метод | URL | Описание |
|---|---|---|
| POST | `/avatar/image` | Загрузить фото аватара |
| POST | `/remove-background` | Убрать фон с фото через remove.bg |

### Misc
| Метод | URL | Описание | Лимит |
|---|---|---|---|
| GET | `/health` | Healthcheck | — |
| GET | `/weather?lat=&lon=` | Погода от Open-Meteo | 30/мин |
| GET | `/proxy-image?url=` | CORS-прокси Cloudinary фото | — |

---

## Переменные окружения (.env)

```env
# App
ENVIRONMENT=development          # development | production
SECRET_KEY=...                   # JWT подпись (обязательно поменять в prod)
ALLOWED_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgresql+psycopg://wardrobe_user:wardrobe_pass@localhost:5432/wardrobe

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# AI
REPLICATE_API_TOKEN=...          # AI примерка
GEMINI_API_KEY=...               # AI ассистент (Gemini)
IMGBB_API_KEY=...                # Временный хостинг для Replicate

# Auth
GOOGLE_CLIENT_ID=...             # Google OAuth
REMOVE_BG_API_KEY=...            # Удаление фона

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=...
```

---

## Запуск проекта

```bash
# 1. Поднять БД
docker-compose up -d

# 2. Установить зависимости бэкенда
pip install -r requirements.txt

# 3. Запустить backend (таблицы создадутся автоматически)
python -m uvicorn backend.main:app --reload --port 8000

# 4. Запустить frontend
cd frontend && npm run dev
```

В production: `ENVIRONMENT=production` скрывает `/docs`, `/redoc`, `/openapi.json`.

Swagger UI (только dev): `http://localhost:8000/docs`
