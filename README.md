# CareerPilot AI

CareerPilot AI is an AI-powered career agent for software engineering students and early-career candidates. It combines resume parsing, ATS job ingestion, semantic search, fit ranking, and agent-style guidance so users can upload a resume, discover relevant roles, and get concrete next steps.

## Repository Structure

```text
apps/
  api/       NestJS API for resumes, jobs, matching, agent chat, and sync triggers
  web/       Next.js frontend and lightweight proxy API routes
  worker/    ATS adapters, scraping, scheduling, matching, and notification helpers
packages/
  domain/    Shared domain types and eligibility helpers
infra/       PostgreSQL/Supabase schema, seed data, and database init scripts
docs/        Product and architecture notes
scripts/     Validation and utility scripts
```

## MVP Flow

1. Upload a PDF or DOCX resume to the API.
2. Parse the resume into a candidate profile.
3. Sync jobs from supported ATS sources into the normalized `jobs` table.
4. Search and rank opportunities against the candidate profile.
5. Use the agent endpoint for resume-aware planning and application guidance.

The API can use Groq for extraction/planning and Gemini for embeddings. When keys are not configured, local development still works through deterministic parsing and heuristic matching where supported.

## Tech Stack

- Node.js and npm workspaces
- NestJS API
- Next.js web app
- TypeScript shared packages
- PostgreSQL/Supabase
- pgvector for embedding search
- Playwright/Cheerio-based worker foundations

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL or Supabase project
- Optional LLM provider keys for richer parsing, matching, embeddings, and chat

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create a root `.env.local` file:

```env
DATABASE_URL=postgresql://postgres:password@host:5432/postgres

# Optional AI providers
GROQ_API_KEY=
GROQ_API_KEY_2=
GROQ_API_KEY_3=
GEMINI_API_KEY=

# Optional web/Supabase settings
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CAREERPILOT_API_URL=http://127.0.0.1:4000/api

# Optional worker settings
STUDENT_ID=
LOGGED_IN_STUDENT_ID=
SCRAPER_POLL_INTERVAL_MS=3600000
NOTIFIER_ENABLED=true
FIRECRAWL_API_KEY=
```

## Database

Initialize the database:

```bash
npm run db:init
```

This script loads `.env.local`, connects using `DATABASE_URL`, and applies:

- `infra/schema.sql`
- `infra/seed_colleges.sql`
- `infra/seed_companies.sql`

If you are setting up Supabase manually, apply the SQL files in `infra/` from the Supabase SQL editor or your preferred PostgreSQL client.

## Development

Run the API:

```bash
npm run dev:api
```

The API listens on:

```text
http://localhost:4000/api
```

Run the web app:

```bash
npm run dev:web
```

The web app listens on:

```text
http://localhost:3000
```

Run the worker:

```bash
npm run dev:worker
```

## Useful Scripts

```bash
npm run build
npm run build:api
npm run build:web
npm run build:worker
npm run typecheck
npm run typecheck:web
npm run typecheck:worker
npm run validate:companies
npm run validate:companies:metadata
```

API tests can be run with:

```bash
npm --workspace api test -- --runInBand
```

## Key API Routes

The API uses the global `/api` prefix.

- `POST /api/resume/parse`
- `GET /api/resume/:userId`
- `POST /api/jobs/search`
- `POST /api/jobs/match`
- `GET /api/jobs/matches/:userId`
- `POST /api/agent/chat`
- `GET /api/agent/conversations/:userId`
- `POST /api/worker/sync`
- `POST /api/worker/sync/:companyId`
- `GET /api/worker/sync/logs`

## Workspace Notes

- `apps/api` owns request/response behavior and database-backed CareerPilot workflows.
- `apps/worker` owns ATS integrations, scraping, scheduling, and background processing.
- `apps/web` owns the user-facing Next.js experience and proxies selected CareerPilot API calls.
- `packages/domain` contains shared domain utilities used across workspaces.

## Product Direction

CareerPilot AI is the product. ATS syncing is one input into the larger career workflow; the primary experience is resume-aware opportunity discovery, fit ranking, and application planning.
