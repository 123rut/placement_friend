# MVP Architecture

## Services

### Web App

The web app handles authentication, onboarding, profile management, company selection, opportunity views, and the CareerPilot chat experience. Server-side routes in the web app proxy authenticated requests to the NestJS API.

### API

The API owns the active CareerPilot backend workflows:

- Resume parsing and candidate profile storage.
- ATS job sync through supported provider APIs.
- Job search and resume-aware match scoring.
- Agent chat and conversation history.
- Company catalog management and user preferences.

### Database

PostgreSQL/Supabase stores students, companies, tracked-company preferences, normalized ATS jobs, candidate profiles, match scores, sync logs, conversations, and notification preferences.

## Main Flows

### Onboarding

1. Student signs up using Supabase Auth.
2. Student completes profile details such as college, branch, CGPA, and batch year.
3. Student selects companies to track.
4. Student lands on the dashboard.

### Resume And Matching

1. Student uploads a PDF or DOCX resume.
2. API extracts resume text.
3. API parses structured profile data through Groq, Gemini, or heuristic fallback.
4. API stores the profile in `candidate_profiles`.
5. API creates an embedding when Gemini is configured.
6. Existing `job_matches` for the student are cleared so future scores use the new profile.

### ATS Job Sync

1. Web app triggers `/api/careerpilot/sync`.
2. Web route forwards the authenticated user ID to the NestJS `/api/sync` route.
3. API loads active companies with ATS metadata.
4. API optionally filters companies using the student's CGPA and branch.
5. API fetches jobs from Greenhouse, Lever, Ashby, Workday, or SmartRecruiters.
6. API normalizes jobs, checks hard eligibility, generates embeddings when available, and upserts into `jobs`.
7. API writes `sync_logs` and updates company sync status.
8. API auto-scores synced jobs for the user and writes `job_matches`.

### CareerPilot Agent

1. Student sends a message from the chat panel.
2. API loads or creates a conversation.
3. Groq or Gemini decides whether to read the resume, search jobs, compute a match, or analyze a skill gap.
4. API writes the updated conversation and returns a concise assistant response.

## Reliability Notes

- Keep ATS sync idempotent by using unique job URLs.
- Preserve sync logs for operational debugging.
- Keep the API sync route protected by `INTERNAL_API_KEY` when called from the web app.
- Prefer supported ATS APIs over generic page extraction.
