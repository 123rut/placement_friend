# CareerPilot AI

CareerPilot AI is an AI-powered career agent for software engineers. It combines ATS sync pipelines, resume parsing, semantic job search, and agent-style guidance so a user can upload a resume and get ranked opportunities with concrete next steps.

## What is in this repo

- `apps/api`: NestJS API for resume parsing, job search, matching, chat, and sync triggers
- `apps/worker`: ATS adapters, company registry, sync helpers, and job ingestion foundations
- `apps/web`: Next.js frontend shells and lightweight app routes
- `infra`: PostgreSQL and Supabase SQL, including the CareerPilot migration
- `packages/domain`: shared domain helpers from the earlier foundation work

## CareerPilot MVP slice

The current backend is aligned around this first vertical slice:

1. Upload a PDF or DOCX resume to `/api/resume/parse`
2. Sync ATS jobs into the normalized `jobs` table through `/api/worker/sync`
3. Search cached jobs with `/api/jobs/search`
4. Rank fit with `/api/jobs/match`
5. Ask the planner at `/api/agent/chat`

When `GROQ_API_KEY` and `GEMINI_API_KEY` are configured, the API uses LLM extraction plus embeddings. Without them, the API now falls back to deterministic parsing and heuristic matching so local development still works.

## Database setup

Run the base schema first, then the CareerPilot migration:

```bash
node infra/init-db.js
```

Or apply these manually in Supabase/Postgres:

1. `infra/schema.sql`
2. `infra/migrate-careerpilot.sql`

The migration adds:

- ATS metadata on `companies`
- `jobs`
- `candidate_profiles`
- `job_matches`
- `conversations`
- `sync_logs`
- `pgvector` support

## Key API routes

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

## Product direction

CareerPilot AI is the product. ATS sync is only one input into the AI career workflow; the primary experience is resume-aware guidance, job matching, and application planning.

The project currently verifies with:

```bash
npm run typecheck
npm run build
npm --workspace api test -- --runInBand
npm run validate:companies:metadata
```
