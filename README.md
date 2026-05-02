# 🐸 Healthy Frog

**Nutrition tracking and online interaction system between users and trainers.**

A full-stack MVP built as a graduation thesis project.  
Backend: Python 3.12 + FastAPI + PostgreSQL  
Frontend: React + TypeScript + Vite + MUI

---

## Architecture Overview

```
healthy-frog/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/          # Route handlers (controllers)
│   │   ├── services/     # Business logic
│   │   ├── repositories/ # Database access (SQLAlchemy)
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic v2 request/response schemas
│   │   ├── config.py     # Settings (env variables)
│   │   ├── database.py   # Async engine + session
│   │   ├── dependencies.py  # FastAPI dependencies (auth)
│   │   └── main.py       # App entry point + CORS
│   ├── alembic/          # Database migrations
│   ├── seed.py           # Demo data script
│   └── requirements.txt
├── frontend/         # React SPA
│   └── src/
│       ├── api/          # Axios API functions
│       ├── context/      # AuthContext (token + user state)
│       ├── components/   # Shared components (Layout, nav)
│       ├── pages/        # One file per route
│       └── types/        # Shared TypeScript interfaces
└── docker-compose.yml
```

### Key architectural decisions

| Decision | Rationale |
|---|---|
| Single FastAPI backend | Serves both the React web client and future Android/iOS apps via the same REST + WebSocket API |
| Layered API → Service → Repository | Clear separation of concerns; each layer is independently testable |
| SQLAlchemy async (asyncpg) | Non-blocking I/O throughout; scales well for real-time features |
| JWT in Authorization header | Stateless; works identically for web browsers, mobile apps, and WebSocket handshakes |
| WebSocket chat in same process | Single-instance MVP; no Redis needed; ConnectionManager holds in-memory socket map |
| Alembic for migrations | Version-controlled schema changes; easy to apply in CI/CD |
| Pydantic v2 schemas separate from ORM models | Keeps validation concerns out of the data layer |

---

## Quick Start — Docker Compose (recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Clone / open the project

```bash
cd healthy-frog
```

### 2. Start the backend + database

```bash
docker compose up --build
```

Migrations run automatically on container start.  
API is available at **http://localhost:8000**  
Swagger docs: **http://localhost:8000/docs**

### 3. Seed demo data (first run only)

```bash
docker compose exec backend python seed.py
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Quick Start — Local (without Docker)

### Prerequisites
- Python 3.12
- PostgreSQL 14+
- Node.js 20+

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and edit environment file
copy .env.example .env
# Edit DATABASE_URL in .env to point to your local PostgreSQL

# Run migrations
alembic upgrade head

# Seed demo data
python seed.py

# Start server
uvicorn app.main:app --reload
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install

# Optional: copy .env.example to .env and adjust URLs
# Default proxies /api → localhost:8000 via vite.config.ts

npm run dev
```

Frontend: http://localhost:5173

---

## Demo Accounts

After running `python seed.py`:

| Email | Password | Role |
|---|---|---|
| `john@example.com` | `password123` | User (trainer: Alex) |
| `anna@example.com` | `password123` | User (trainer: Maria) |
| `alex@example.com` | `password123` | Trainer |
| `maria@example.com` | `password123` | Trainer |

---

## API Reference

Full interactive docs at `/docs` (Swagger UI) or `/redoc`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT token |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/users/me` | My profile |
| PUT | `/api/v1/users/me` | Update profile |
| GET | `/api/v1/users/trainers` | List all trainers |
| POST | `/api/v1/users/me/trainer/{id}` | Assign trainer |
| GET | `/api/v1/users/my-clients` | Trainer: list clients |

### Nutrition
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/nutrition/products` | List/search products |
| POST | `/api/v1/nutrition/products` | Create product |
| GET | `/api/v1/nutrition/meals?day=YYYY-MM-DD` | Get meals for a day |
| POST | `/api/v1/nutrition/meals` | Create meal |
| POST | `/api/v1/nutrition/meals/{id}/items` | Add food to meal |

### Reports
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/reports/daily?day=YYYY-MM-DD` | Daily macros summary |

### Chat
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/chat/{user_id}` | Load conversation history |
| POST | `/api/v1/chat/` | Send message (REST fallback) |
| WS | `/api/v1/ws/chat?token=JWT` | Real-time chat |

### Bookings
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/bookings/slots/{trainer_id}` | Available slots |
| POST | `/api/v1/bookings/slots` | Trainer: create slot |
| GET | `/api/v1/bookings/my-slots` | Trainer: my slots |
| POST | `/api/v1/bookings/` | Book a slot |
| GET | `/api/v1/bookings/my` | My bookings |
| GET | `/api/v1/bookings/trainer-bookings` | Trainer: incoming bookings |
| PATCH | `/api/v1/bookings/{id}/status` | Update booking status |

---

## WebSocket Chat Protocol

Connect: `ws://localhost:8000/api/v1/ws/chat?token=<JWT>`

**Send:**
```json
{ "receiver_id": 3, "content": "Hello!" }
```

**Receive (both sender and receiver get this):**
```json
{
  "id": 42,
  "sender_id": 1,
  "receiver_id": 3,
  "content": "Hello!",
  "is_read": false,
  "created_at": "2024-06-01T12:34:56.000000"
}
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async PostgreSQL URL |
| `SECRET_KEY` | `change-me` | JWT signing secret |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime (24h) |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Base REST API URL |
| `VITE_WS_URL` | `ws://localhost:8000/api/v1` | WebSocket base URL |

---

## Database Migrations

```bash
# Apply all migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "describe change"

# Roll back one step
alembic downgrade -1
```

---

## Future Extensions

- **Mobile clients** — the API is already structured for Android/iOS; no changes needed on the backend
- **Push notifications** — add a `device_token` field to users and a notification service
- **Calorie goals & progress charts** — extend the reports endpoint
- **Group classes** — extend TimeSlot with `capacity` and many-to-many Bookings
- **Horizontal scaling** — replace the in-memory ConnectionManager with Redis Pub/Sub for multi-instance WebSocket
- **File uploads** — profile photos via S3-compatible storage
