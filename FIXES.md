# Wardrobe.AI — Список багов и план исправлений

## Приоритет 1 — Критичные (ломают основной функционал)

- [x] **Вещи не сохраняются в БД при добавлении**
  - Файл: `frontend/src/components/tryon/TryOnStudio.tsx`, функция `handleAddItem()` ~строка 211
  - Проблема: создаёт `id: local_${Date.now()}`, кладёт только в локальный React state
  - Надо: вызвать `POST /api/wardrobe` (создать вещь), затем `POST /api/wardrobe/{id}/image` (загрузить фото)
  - При перезагрузке страницы все добавленные вещи пропадают

- [x] **Удаление вещей не уходит в БД**
  - Файл: `frontend/src/components/tryon/TryOnStudio.tsx`, функция `deleteItem()` ~строка 255
  - Проблема: удаляет только из локального state, `DELETE /api/wardrobe/{item_id}` не вызывается
  - Надо: вызвать backend перед обновлением state

---

## Приоритет 2 — Быстрые исправления (по 2-5 минут)

- [x] **Hardcoded URL к бэкенду**
  - Файл: `frontend/src/components/tryon/TryOnStudio.tsx` ~строка 140
  - Проблема: `fetch("http://127.0.0.1:8000/wardrobe", ...)` — обходит Next.js proxy
  - Надо: заменить на `fetch("/api/wardrobe", ...)`

- [x] **CORS невалиден для браузера**
  - Файл: `backend/main.py`, строки 20-26
  - Проблема: `allow_origins=["*"]` + `allow_credentials=True` — браузер блокирует такую комбинацию
  - Надо: `allow_origins=["http://localhost:3000"]`

- [x] **Score bars захардкожены (85 / 92 / 88)**
  - Файл: `frontend/src/components/tryon/TryOnStudio.tsx` ~строки 847-863
  - Проблема: значения фиксированы, хотя API возвращает `fit_score`, `style_score`, `confidence`
  - Надо: прокинуть результат генерации в state и отображать реальные цифры

---

## Приоритет 3 — Функциональные доработки

- [x] **Дефолтный гардероб не выдаётся при регистрации**
  - Файл: `backend/routers/auth_router.py`
  - Проблема: `_DEFAULT_ITEMS` (строка 15) описан, но в функции `register()` не вставляется в БД
  - Надо: добавить цикл создания `WardrobeItem` для новых пользователей после `db.commit()`

- [x] **История примерок не per-user и теряется при рестарте**
  - Файл: `backend/routers/tryon.py`, эндпоинт `GET /history` строка 131
  - Проблема: `TRYON_JOBS` — dict в памяти, возвращает все jobs без фильтрации по user_id
  - Надо: добавить таблицу `tryon_history` в БД или хотя бы фильтровать по user

- [x] **Avatar upload — заглушка**
  - Файл: `backend/routers/avatar.py`, `POST /avatar/image` строка 16
  - Проблема: файл читается, но никуда не сохраняется — возвращает фейковый URL
  - Надо: сохранять в MinIO (аналогично wardrobe), хранить URL в таблице users

---

## Приоритет 4 — Технический долг (не блокируют, но нужно для чистоты)

- [x] **Функция `upload_to_imgbb` использует Cloudinary**
  - Файл: `backend/services/image_service.py` строка 19
  - Проблема: имя misleading — внутри Cloudinary, а не imgbb
  - Надо: переименовать в `upload_to_cloud` или `upload_to_cloudinary` + обновить импорты в `tryon.py`

- [x] **Старый mock-эндпоинт `/tryon` использует memory store**
  - Файл: `backend/routers/tryon.py` строки 16-45
  - Проблема: использует `WARDROBE_DB` из памяти вместо PostgreSQL, не нужен в продакшне
  - Надо: либо переписать под PostgreSQL, либо удалить (реальный эндпоинт — `/generate-tryon`)

---

## Прогресс

| # | Задача | Статус |
|---|--------|--------|
| 1 | Сохранение вещей в БД (add) | ✅ |
| 2 | Сохранение вещей в БД (delete) | ✅ |
| 3 | Hardcoded URL → /api/wardrobe | ✅ |
| 4 | CORS fix | ✅ |
| 5 | Score bars из API response | ✅ |
| 6 | Seed дефолтных вещей при регистрации | ✅ |
| 7 | История примерок в БД + per-user | ✅ |
| 8 | Avatar upload в MinIO | ✅ |
| 9 | Переименовать upload_to_imgbb | ✅ |
| 10 | Убрать/переписать mock /tryon | ✅ |
