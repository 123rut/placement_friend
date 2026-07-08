# Carrierpilot

Placement Friend is a SaaS platform that helps students discover placement drives, internships, and early-career roles before deadlines pass.

The current product experience is powered by CareerPilot AI: a resume-aware career agent that combines student profiles, ATS job ingestion, eligibility matching, semantic search, fit scoring, and actionable guidance.

## What It Does

- Authenticates students with Supabase-backed sessions.
- Stores academic profile details such as college, branch, CGPA, and batch year.
- Tracks company career pages and ATS boards.
- Syncs jobs from supported ATS providers into PostgreSQL.
- Parses resumes from PDF or DOCX uploads.
- Matches opportunities against resume, eligibility, and preferences.
- Provides AI-assisted career planning through the CareerPilot agent.
- Supports watchlists, notification preferences, and opportunity dashboards.

## Repository Structure

```text
apps/
  api/       NestJS API for resumes, jobs, matching, agent chat, and sync triggers
  web/       Next.js frontend and server-side proxy API routes
  worker/    ATS adapters, scraping, scheduling, matching, and notifications
packages/
  domain/    Shared domain types, company catalog, and eligibility helpers
infra/       PostgreSQL/Supabase schema, seed data, and database init scripts
docs/        Product and architecture notes
scripts/     Validation and utility scripts
```

## Tech Stack

- Node.js and npm workspaces
- TypeScript
- Next.js
- NestJS
- Supabase Auth
- PostgreSQL/Supabase
- pgvector for embedding search
- Groq for LLM extraction/planning
- Gemini for embeddings and optional fallback parsing
- Playwright/Cheerio-based worker foundations

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL or Supabase project
- Optional Groq and Gemini API keys for richer AI workflows

## Environment

Create a root `.env.local` file:

```env
DATABASE_URL=postgresql://postgres:password@host:5432/postgres

# Required for production server-to-server API calls
INTERNAL_API_KEY=
WEB_ORIGIN=http://localhost:3000

# Optional AI providers
GROQ_API_KEY=
GROQ_API_KEY_2=
GROQ_API_KEY_3=
GEMINI_API_KEY=

# Web/Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CAREERPILOT_API_URL=http://127.0.0.1:4000/api

# Worker settings
STUDENT_ID=
LOGGED_IN_STUDENT_ID=
SCRAPER_POLL_INTERVAL_MS=3600000
NOTIFIER_ENABLED=true
FIRECRAWL_API_KEY=
```

`INTERNAL_API_KEY` is used only for server-to-server communication between the web proxy routes and the NestJS API. It must not be exposed to browser code.

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Initialize the database:

```bash
npm run db:init
```

The init script loads `.env.local`, connects with `DATABASE_URL`, and applies the SQL files in `infra/`.

## Development

Run the API:

```bash
npm run dev:api
```

The API listens at:

```text
http://localhost:4000/api
```

Run the web app:

```bash
npm run dev:web
```

The web app listens at:

```text
http://localhost:3000
```

Run the worker:

```bash
npm run dev:worker
```

## Validation And Build

Use these commands before deployment:

```bash
npm run lint
npm run typecheck
npm run build
npm run validate:companies:metadata
```

Live ATS validation requires network access:

```bash
npm run validate:companies
```

The live validator checks each active company against its ATS provider and prints a grouped summary by provider and failure reason.

Run API tests:

```bash
npm --workspace api test -- --runInBand
```

## Key API Routes

The NestJS API uses the global `/api` prefix.

- `POST /api/resume/parse`
- `GET /api/resume/:userId`
- `PUT /api/resume/:userId`
- `POST /api/jobs/search`
- `POST /api/jobs/match`
- `GET /api/jobs/matches/:userId`
- `POST /api/agent/chat`
- `GET /api/agent/conversations/:userId`
- `POST /api/worker/sync`
- `POST /api/worker/sync/stop`
- `GET /api/worker/sync/status`
- `GET /api/worker/sync/logs`
- `POST /api/worker/sync/:companyId`

## Supported ATS Providers

- Greenhouse
- Lever
- Ashby
- Workday
- SmartRecruiters
- Amazon Jobs

## Production Notes

- Deploy the NestJS API with `INTERNAL_API_KEY` set.
- Keep the NestJS API private or protected so only trusted server callers can reach it.
- Configure `WEB_ORIGIN` to the deployed frontend origin.
- Run metadata validation in CI.
- Run live ATS validation from a networked environment before deployment.
- Treat long-running sync as an operational workflow and monitor sync logs.
- Do not commit `.env.local` or production secrets.

## Workspace Ownership

- `apps/web` owns the user-facing product and authenticated server proxy routes.
- `apps/api` owns CareerPilot workflows, AI calls, resume parsing, matching, and sync triggers.
- `apps/worker` owns background scraping, ATS adapters, and notification helpers.
- `packages/domain` owns shared company and eligibility domain data.

## Product Direction

Placement Friend is the student-facing platform. CareerPilot AI is the intelligence layer inside it: resume-aware opportunity discovery, fit ranking, application planning, and company tracking.
