# CareerPilot API

NestJS backend for the CareerPilot MVP.

## Current responsibilities

- Parse resumes from PDF and DOCX uploads
- Store structured candidate profiles
- Search normalized jobs
- Compute job-fit scores with explanations
- Persist conversation history for the planner
- Trigger ATS sync runs against supported providers

## Endpoints

- `GET /api`
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
- `GET /api/worker/sync/companies`

## Build

```bash
npm --workspace apps/api run build
```

## Environment

Expected variables in the repo root `.env.local`:

- `DATABASE_URL`
- `GROQ_API_KEY` for LLM extraction and planner responses
- `GEMINI_API_KEY` for embeddings

If the AI keys are missing, the API falls back to heuristic resume parsing and match generation so the MVP can still be exercised locally.
