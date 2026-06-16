<div align="center">

# Wardrobe.AI

**AI-powered wardrobe management — your personal stylist in your pocket.**

*Diploma project by Dimash Altaibekov*

---

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)

</div>

---

## What it does

Wardrobe.AI lets you digitize your wardrobe, get AI-generated outfit suggestions, try on clothes virtually, and chat with a Gemini-powered style assistant — all in one place.

| Feature | Description |
|---|---|
| **Smart Wardrobe** | Upload and categorize every item in your closet |
| **AI Stylist Chat** | Gemini-powered assistant that knows your wardrobe |
| **Virtual Try-On** | See yourself in any outfit before wearing it (via Replicate) |
| **Outfit Planner** | AI-generated outfit combinations from your items |
| **Laundry Tracker** | Mark items as in the wash, never mix up your outfits |
| **Shopping Wishlist** | Analyze wishlist items with price estimates in KZT |
| **Outfit History** | Browse your past looks and try-on results |

---

## Tech Stack

### Backend
- **FastAPI** + SQLAlchemy 2.0 + PostgreSQL 16
- **JWT auth** (HS256, 8h lifetime) + Google OAuth
- **Cloudinary** — photo storage
- **Replicate** — Virtual Try-On model
- **Google Gemini** — AI stylist chat
- **remove.bg** — background removal for clothing photos
- **SlowAPI** — rate limiting

### Frontend
- **Next.js 14** App Router + TypeScript
- **Framer Motion** — scroll animations, transitions
- **Tailwind CSS** — utility styling
- **Fonts**: Cormorant Garamond (headings) · DM Sans (body)

---

## Project Structure

```
.
├── backend/
│   ├── main.py                  # Entry point, CORS, route registration
│   ├── auth.py                  # JWT create / decode / blacklist
│   ├── config.py                # Env variables
│   ├── db/
│   │   ├── database.py          # SQLAlchemy engine + get_db
│   │   ├── models.py            # ORM models
│   │   └── memory_store.py      # bcrypt helpers
│   ├── models/schemas.py        # Pydantic schemas
│   ├── routers/
│   │   ├── auth_router.py       # Register, login, Google OAuth, profile
│   │   ├── wardrobe.py          # Wardrobe CRUD + photo upload
│   │   ├── outfits.py           # Outfit CRUD
│   │   ├── assistant.py         # Gemini stylist — POST /assistant/chat
│   │   ├── chat_sessions.py     # Chat history
│   │   ├── tryon.py             # Virtual Try-On via Replicate
│   │   ├── planner.py           # Outfit planner
│   │   ├── shopping.py          # Wishlist analysis
│   │   └── avatar.py            # Avatar upload + bg removal
│   └── services/
│       ├── minio_service.py     # Cloudinary upload / delete
│       ├── ai_service.py        # Replicate API calls
│       ├── image_service.py     # imgbb upload, url → base64
│       ├── vision_service.py    # Image analysis
│       └── email_service.py     # SMTP verification email
│
├── frontend/src/
│   ├── app/
│   │   ├── page.tsx             # Landing page (scroll animations)
│   │   ├── layout.tsx           # Root layout, fonts
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── tryon/page.tsx       # Virtual Try-On studio
│   └── components/
│       ├── AuthGuard.tsx
│       ├── auth/WardrobeAuth.tsx
│       └── tryon/TryOnStudio.tsx
│
├── docker-compose.yml           # PostgreSQL + MinIO
├── requirements.txt
└── railway.toml                 # Railway deployment config
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker + Docker Compose

### 1 — Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://wardrobe_user:wardrobe_pass@localhost:5432/wardrobe
SECRET_KEY=your-secret-key
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GOOGLE_CLIENT_ID=...
GEMINI_API_KEY=...
REPLICATE_API_TOKEN=...
REMOVEBG_API_KEY=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...
```

### 2 — Start the database

```bash
docker-compose up -d
```

### 3 — Backend

```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

### 4 — Frontend

```bash
cd frontend
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

---

## Auth Flow

```
POST /auth/send-code      →  6-digit code to email (10 min, 3 req/min)
POST /auth/verify-email   →  creates user + default wardrobe → returns JWT
POST /auth/google         →  Google OAuth, creates user if new
POST /auth/login          →  email + password → JWT
POST /auth/logout         →  blacklists token in memory
```

New users automatically receive 5 default wardrobe items (cap, tee, shorts, sneakers, bag).

---

## Database Schema

| Table | Key Columns |
|---|---|
| `users` | id, name, email, hashed_password, avatar_url |
| `wardrobe_items` | id, user_id, name, category, brand, color, season, image_url |
| `outfits` | id, user_id, name, ai_suggested |
| `outfit_items` | outfit_id, item_id |
| `chat_sessions` | id, user_id, title |
| `chat_messages` | id, session_id, role, content, recommended_item_ids (JSON) |
| `tryon_history` | id, user_id, preview_url, prompt |

**Item categories:** `top` · `bottom` · `outer` · `shoes` · `headwear` · `accessory`

---

## Deployment

The backend is deployed on **Railway** via Nixpacks:

```toml
[deploy]
startCommand = "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
```

The frontend is deployed on **Vercel**.

---

## Monetization

| Tier | Price | Features |
|---|---|---|
| Free | $0 | Full wardrobe, AI chat, outfit suggestions |
| Pro | $7.99 / mo | Virtual Try-On, advanced planner |
| Premium | $14.99 / mo | All features + priority generation |

Payments via **Stripe**.

---

<div align="center">

Made with care by **Dimash Altaibekov** · AITU · 2025

</div>
