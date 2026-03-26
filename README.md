// Root README.md

# SocialNet MVP

A minimal social‑network web app built with **Next.js** (frontend) and **NestJS** (backend) using **PostgreSQL**.

## Features (MVP)
- User registration & login (JWT)
- Profile page (username, avatar)
- Follow / unfollow users
- Create simple text posts
- Feed of posts from followed users
- Like / comment (basic skeleton – endpoints ready)

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | NestJS (TypeScript) + TypeORM |
| Database | PostgreSQL |
| Auth | JWT (passport‑jwt) |
| Containerisation | Docker + Docker‑Compose |

## Quick Start (Docker)
```bash
# clone repo (you already have it locally)
docker compose up --build
```
The frontend will be available at `http://localhost:3000` and the API at `http://localhost:4000/api`.

## Folder Structure
```
/socialnet-mvp
├─ backend/          # NestJS API
│   ├─ src/
│   │   ├─ app.module.ts
│   │   ├─ main.ts
│   │   ├─ auth/      # Auth module (JWT)
│   │   ├─ users/     # User entity, service, controller
│   │   └─ posts/     # Post entity, service, controller
│   └─ ormconfig.ts
├─ frontend/         # Next.js app
│   ├─ pages/
│   │   ├─ index.tsx    # Feed page (protected)
│   │   ├─ login.tsx    # Login / signup
│   │   └─ profile/[id].tsx
│   ├─ components/
│   └─ lib/api.ts       # Wrapper for API calls
├─ docker-compose.yml
└─ README.md
```

## Development
### Backend
```bash
cd backend
npm install
npm run start:dev   # runs on http://localhost:4000
```
### Frontend
```bash
cd frontend
npm install
npm run dev         # runs on http://localhost:3000
```

---
Feel free to extend the schema, add real‑time features (WebSocket/Socket.io) or image uploads later.
