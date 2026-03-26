# README.md

## Social Network MVP

A **minimal social‑network** built with a **NestJS** backend (TypeScript) and a **Next.js** frontend (TypeScript + Tailwind CSS).

### Features (MVP)
- User registration & login with JWT
- Basic user profile (username, avatar URL, bio)
- Follow / unfollow other users
- Create plain‑text posts
- Simple news‑feed (posts from users you follow)

### Tech Stack
| Layer | Technology |
|-------|------------|
| Front‑end | Next.js 14 (React 18), TypeScript, Tailwind CSS |
| Back‑end | NestJS, TypeScript, TypeORM, PostgreSQL |
| Auth | JWT (passport‑jwt) |
| Containerisation | Docker & Docker‑Compose |
| Development | VS Code, Node 20, pnpm |

### Project Structure
```
socialnet-mvp/
├─ backend/                 # NestJS API
│   └─ src/
│       ├─ app.module.ts
│       ├─ main.ts
│       ├─ auth/            # Auth (login / register)
│       ├─ users/           # User entity, service, controller
│       └─ posts/           # Post entity, service, controller
├─ frontend/                # Next.js app
│   └─ pages/              # UI pages (login, signup, feed, profile)
├─ docker-compose.yml       # Services: postgres, backend, frontend
└─ README.md               # You are here
```

### Getting Started (Local)
1. **Clone the repo**
   ```bash
   git clone <repo‑url>
   cd socialnet-mvp
   ```
2. **Create a `.env` file** in `backend/` (copy from `.env.example`). Example:
   ```
   POSTGRES_HOST=postgres
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=socialnet
   JWT_SECRET=supersecretkey
   ```
3. **Run with Docker Compose** (recommended)
   ```bash
   docker compose up --build
   ```
   - Backend will be reachable at `http://localhost:3001/api`
   - Frontend at `http://localhost:3000`
4. **Or run locally without Docker**
   - Backend:
     ```bash
     cd backend
     npm install
     npm run start:dev
     ```
   - Frontend:
     ```bash
     cd frontend
     npm install
     npm run dev
     ```

### API Endpoints (excerpt)
- `POST /auth/register` – Register a new user
- `POST /auth/login` – Login and receive JWT
- `GET /users/me` – Get current logged‑in profile (JWT required)
- `POST /users/:id/follow` – Follow a user
- `POST /posts` – Create a post (JWT required)
- `GET /posts/feed` – Get posts from followed users

### License
MIT
