# Manga-Manman 📖🇹🇭

Personal manga reading web app that pulls from MangaDex and auto-translates to Thai via Groq Vision or Gemini Vision, running 100% on the cloud.

## Architecture

- **Frontend**: Next.js 15 (App Router, TypeScript, Vanilla CSS Design System)
- **Backend**: Go Fiber v2
- **Database**: PostgreSQL (pgx v5 connection pool)
- **Translation Providers**:
  - **Groq Vision** (`meta-llama/llama-4-scout-17b-16e-instruct`)
  - **Gemini Vision** (`gemini-1.5-flash` / `gemini-2.0-flash`)
- **Manga Source**: MangaDex API v5
- **Deployment**: Railway / Render / Vercel

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
cp .env.example .env  # Configure GROQ_API_KEY or GEMINI_API_KEY
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
| `GEMINI_API_KEY` | Backend | Gemini API key for fallback translation |
| `MANGA_TRANSLATOR` | Backend | `groq` (default) or `gemini` |
| `FRONTEND_URL` | Backend | Frontend URL for CORS |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API URL (default `http://localhost:8080`) |

## Features

### 📖 Reader Experience
- **3 Reading Modes**:
  - 📜 **Webtoon**: Continuous vertical scroll with auto page detection
  - 📄 **Single Page**: Click / keyboard paginated view
  - 📖 **Double Page**: Side-by-side spread view
- **Keyboard Shortcuts**:
  - `→` / `D` : Next Page / Chapter
  - `←` / `A` : Previous Page
  - `T` : Cycle Translation modes (Thai / Side-by-Side / Original / Off)
  - `M` : Switch Reading modes (Webtoon / Single / Double)
  - `F` : Toggle Fullscreen
  - `?` / `H` : Open Shortcuts help dialog
- **Chapter Quick Navigation**: Jump between chapters directly from the reader bar

### 🇹🇭 AI Manga Translation & Bubble Editor
- **Thai Translation Overlay**: Formatted speech bubbles directly over manga dialogues
- **Bilingual & Original Modes**: Side-by-side view (Thai + Japanese) or Original raw
- **Inline Translation Editor**: Click any bubble to edit Thai text and save directly to PostgreSQL database
- **Translation Caching**: Translate once, stored forever in database

### 📚 Personal Library & Bookmarks
- **Status Categories**: `Reading` (กำลังอ่าน), `Plan to Read` (วางแผนจะอ่าน), `Completed` (อ่านจบแล้ว), `Dropped` (พักไว้ก่อน)
- **Auto-Resume**: "Continue Reading" prompt taking you back to the exact chapter and page

### 🔍 Explore & Search
- **Genre & Tag Chips**: Action, Romance, Comedy, Fantasy, Isekai, Slice of Life, Mystery, Sci-Fi, Horror
- **Status Filters**: Ongoing vs Completed
- **Sorting Options**: Most Popular, Latest Uploads, Top Rated, Relevance

