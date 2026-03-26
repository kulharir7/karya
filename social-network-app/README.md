# README.md

# Social Network App (MVP)

This repository contains the source code for a modern social‑network web application built with **NestJS** (backend) and **Next.js** (frontend).

## Features (MVP)
- User registration & login (email/password + Google/Facebook OAuth)
- JWT based authentication with refresh tokens
- Profile management (avatar upload to AWS S3)
- Follow / unfollow users
- Create text posts with optional image attachments
- Feed showing posts from followed users (simple chronological order)
- Like / comment on posts
- Real‑time chat using WebSocket (Socket.io)
- Email notifications via SendGrid (welcome, password reset)
- Push notifications via Firebase Cloud Messaging (optional mobile)

## Tech Stack
- **Backend**: NestJS (Node.js, TypeScript) + TypeORM + PostgreSQL
- **Frontend**: Next.js (React, TypeScript) + Tailwind CSS
- **Auth**: JWT + Passport (local, Google, Facebook)
- **File Storage**: AWS S3 (pre‑signed URLs)
- **Email**: SendGrid
- **Real‑time**: Socket.io
- **Containerisation**: Docker & Docker‑Compose
- **CI/CD**: GitHub Actions

## Getting Started
### Prerequisites
- Docker & Docker‑Compose
- Node.js 20 (for local dev, optional)
- An AWS account with an S3 bucket
- SendGrid API key
- Google/Facebook OAuth client IDs (optional)

### Run locally with Docker
```bash
cp .env.example .env   # fill in the values
docker compose up --build
```
The backend will be available at `http://localhost:3000` and the frontend at `http://localhost:3001`.

### Development
```bash
# Backend
cd backend && npm install && npm run start:dev
# Frontend
cd frontend && npm install && npm run dev
```

## Project Structure
```
social-network-app/
├─ backend/          # NestJS server
│   ├─ src/          # modules (auth, users, posts, chat)
│   └─ ...
├─ frontend/         # Next.js client
│   ├─ pages/        # UI pages (login, feed, profile)
│   └─ ...
├─ docker-compose.yml
├─ .github/workflows/ci.yml
└─ README.md
```

## License
MIT
