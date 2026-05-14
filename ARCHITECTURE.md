# Wardrobe.AI — Архитектура бэкенда

## Стек

| Компонент | Технология | Назначение |
|---|---|---|
| API сервер | FastAPI (Python) | REST API |
| База данных | PostgreSQL 16 | Хранение пользователей и метаданных одежды |
| Файловое хранилище | MinIO | Хранение фотографий одежды и аватаров |
| ORM | SQLAlchemy 2.0 | Работа с PostgreSQL из Python |
| Аутентификация | JWT (jose) | Bearer-токены |
| AI генерация | Replicate flux-2-pro | Виртуальная примерка |
| Удаление фона | remove.bg API | Обработка фото одежды |
| Запуск инфраструктуры | Docker Compose | PostgreSQL + MinIO одной командой |

---

## Структура файлов

```
backend/
├── main.py                    # Точка входа, создание таблиц, статика
├── auth.py                    # JWT декодирование, get_current_user
├── config.py                  # Переменные окружения
├── db/
│   ├── database.py            # SQLAlchemy engine, SessionLocal, get_db
│   ├── models.py              # ORM модели: User, WardrobeItem
│   └── memory_store.py        # hash_password / verify_password (bcrypt)
├── models/
│   └── schemas.py             # Pydantic схемы запросов и ответов
├── routers/
│   ├── auth_router.py         # POST /auth/register, /auth/login, GET /auth/me
│   ├── wardrobe.py            # CRUD гардероба + загрузка фото в MinIO
│   ├── tryon.py               # AI примерка через Replicate
│   └── avatar.py             # Загрузка аватара, удаление фона
├── services/
│   ├── minio_service.py       # Загрузка/удаление файлов в MinIO
│   ├── ai_service.py          # Вызов Replicate API
│   └── image_service.py       # imgbb upload, url → base64
└── static/
    └── defaults/              # Дефолтные фото одежды для новых юзеров
        ├── default_top.jpg
        ├── default_bottom.jpg
        └── default_outer.jpg
```

---

## Инфраструктура (Docker Compose)

```yaml
# docker-compose.yml
services:
  postgres:   порт 5432   # база данных
  minio:      порт 9000   # S3-совместимое файловое хранилище
              порт 9001   # MinIO Web UI (браузер)
```

Запуск:
```bash
docker-compose up -d
```

MinIO Web UI: `http://localhost:9001`
- Логин: `wardrobe_minio`
- Пароль: `wardrobe_minio_secret`

---

## База данных

### Таблица `users`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `user_<10 hex символов>` |
| name | String(100) | Имя пользователя |
| email | String(255) unique | Email (индекс) |
| hashed_password | String | bcrypt хеш |
| created_at | DateTime | Дата регистрации |

### Таблица `wardrobe_items`

| Поле | Тип | Описание |
|---|---|---|
| id | String PK | `item_<8 hex символов>` |
| user_id | String FK → users.id | Владелец (CASCADE DELETE) |
| name | String(200) | Название вещи |
| category | String(50) | `top / bottom / outer / shoes / headwear / accessory` |
| brand | String(100) | Бренд (опционально) |
| size | String(20) | Размер (опционально) |
| image_url | String | URL фото в MinIO или `/static/defaults/...` |
| uploaded_at | DateTime | Дата добавления |

Связь: один `User` → много `WardrobeItem` (один-ко-многим).

---

## Аутентификация

### Регистрация `POST /auth/register`

```
1. Проверить что email не занят (SELECT WHERE email = ...)
2. Создать User с bcrypt-хешем пароля
3. Добавить 3 дефолтные вещи в wardrobe_items (seed)
4. Вернуть JWT токен + данные пользователя
```

### Вход `POST /auth/login`

```
1. Найти User по email
2. Проверить пароль через bcrypt.checkpw()
3. Вернуть JWT токен + данные пользователя
```

### Защита эндпоинтов

Все защищённые роуты используют `Depends(get_current_user)`:
```
Authorization: Bearer <jwt_token>
    ↓
Декодировать JWT → достать user_id
    ↓
SELECT * FROM users WHERE id = user_id
    ↓
Вернуть dict {id, name, email}
```

---

## Файловое хранилище (MinIO)

### Загрузка фото одежды `POST /wardrobe/{item_id}/image`

```
Пользователь загружает файл (JPG/PNG/WEBP)
    ↓
minio_service.upload_file(bytes, content_type, folder="wardrobe/{user_id}")
    ↓
MinIO: сохранить как "wardrobe/{user_id}/{uuid}.jpg"
    ↓
Вернуть публичный URL: http://localhost:9000/wardrobe/wardrobe/{user_id}/{uuid}.jpg
    ↓
PostgreSQL: UPDATE wardrobe_items SET image_url = <url>
```

### Удаление вещи `DELETE /wardrobe/{item_id}`

```
1. Если image_url указывает на MinIO → удалить файл
2. Удалить запись из PostgreSQL
```

### Бакет MinIO

Бакет `wardrobe` создаётся автоматически при первом обращении.
Политика — публичное чтение (чтобы браузер мог отображать фото).

Структура файлов в MinIO:
```
wardrobe/
└── wardrobe/
    └── {user_id}/
        ├── {uuid1}.jpg   ← фото рубашки
        ├── {uuid2}.png   ← фото джинсов
        └── ...
```

---

## Дефолтный гардероб при регистрации

При регистрации каждый новый пользователь получает 3 вещи:

| Вещь | Категория | Фото |
|---|---|---|
| Classic White Tee | top | `/static/defaults/default_top.jpg` |
| Slim Jeans | bottom | `/static/defaults/default_bottom.jpg` |
| Light Blazer | outer | `/static/defaults/default_outer.jpg` |

Фото раздаются как статика напрямую FastAPI (`/static/...`).
Чтобы поменять фото — просто замени файлы в `backend/static/defaults/`.

---

## API эндпоинты

### Auth
| Метод | URL | Описание |
|---|---|---|
| POST | `/auth/register` | Регистрация, возвращает JWT |
| POST | `/auth/login` | Вход, возвращает JWT |
| GET | `/auth/me` | Данные текущего пользователя |

### Wardrobe (требует JWT)
| Метод | URL | Описание |
|---|---|---|
| GET | `/wardrobe` | Список всех вещей пользователя |
| POST | `/wardrobe` | Добавить вещь (без фото) |
| DELETE | `/wardrobe/{item_id}` | Удалить вещь + фото из MinIO |
| POST | `/wardrobe/{item_id}/image` | Загрузить фото вещи → MinIO |

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

---

## Переменные окружения (.env)

```env
SECRET_KEY=...                  # JWT подпись
DATABASE_URL=postgresql+psycopg://wardrobe_user:wardrobe_pass@localhost:5432/wardrobe
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=wardrobe_minio
MINIO_SECRET_KEY=wardrobe_minio_secret
MINIO_BUCKET=wardrobe
REPLICATE_API_TOKEN=...         # AI примерка
REMOVE_BG_API_KEY=...           # Удаление фона
IMGBB_API_KEY=...               # Временный хостинг изображений для Replicate
```

---

## Запуск проекта

```bash
# 1. Поднять инфраструктуру
docker-compose up -d

# 2. Установить зависимости
pip install -r requirements.txt

# 3. Запустить backend (таблицы создадутся автоматически)
python -m uvicorn backend.main:app --reload --port 8000

# 4. Запустить frontend
cd frontend && npm run dev
```

Swagger UI: `http://localhost:8000/docs`
