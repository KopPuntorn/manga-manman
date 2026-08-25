# Manga-Manman 📖

Personal manga reading web app that pulls from MangaDex and auto-translates to Thai via Groq Vision, running 100% on the cloud.

## Architecture

- **Frontend**: Next.js 15 (App Router, TypeScript)
- **Backend**: Go Fiber v2
- **Database**: PostgreSQL
- **Translation**: Groq Vision API
- **Manga Source**: MangaDex API
- **Deployment**: Railway

## Local Development

### Prerequisites

- Go 1.23+
- Node.js 20+
- Docker & Docker Compose (for PostgreSQL)

### Quick Start

1. Start PostgreSQL:
```bash
docker-compose up postgres -d
```

2. Start the backend:
```bash
cd backend
cp .env.example .env  # Edit with your GROQ_API_KEY
go run cmd/server/main.go
```

3. Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

4. Open http://localhost:3000

### Environment Variables

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `GROQ_API_KEY` | Backend | Groq API key for translation |
| `MANGA_TRANSLATOR` | Backend | `groq` (default) or `ocr` |
| `FRONTEND_URL` | Backend | Frontend URL for CORS |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API URL |

## Features (V1)

- 🔍 Search manga from MangaDex
- 📖 Read manga with vertical scroll reader
- 🇹🇭 Auto-translate to Thai via Groq Vision
- 📚 Personal library
- 📝 Reading history & progress tracking
- 💾 Translation caching (translate once, read forever)
