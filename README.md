# Placement & Internship Alert Agent

Placement & Internship Alert Agent is a SaaS platform that helps students discover placement drives and internships before deadlines pass. The MVP centralizes company career-page tracking, eligibility matching, and notifications in a mobile-first student workflow.

## Current Status

Sprint 1 is implemented in this repo:

- College-email-first onboarding with domain-to-college mapping
- Student profile setup for branch, CGPA, and batch year
- Top 100 seeded companies with category, eligibility, and package metadata
- PRD-aligned SQL schema and seed files for Supabase/PostgreSQL foundations
- Foundation dashboard and API routes for colleges and companies

Later sprint work such as scraping, drive ingestion, and alerts remains intentionally out of scope in the current web experience.

## Full MVP Scope

- Authentication with college email
- Student profile management
- Company tracking
- Opportunity scraping and deduplication
- Eligibility matching
- Timely notifications
- Upcoming drives dashboard

## Repository Layout

- `apps/web`: student-facing Next.js application and lightweight API routes
- `apps/worker`: scraping, normalization, matching, and notification orchestration skeleton
- `packages/domain`: shared domain types, rules, and helpers
- `docs`: product and architecture notes
- `infra`: SQL schema for the first release

## Suggested Next Steps

1. Wire the Sprint 1 schema into a real Supabase project.
2. Replace the mock onboarding state with Supabase Auth and persisted student records.
3. Load `infra/seed_colleges.sql` and `infra/seed_companies.sql` into the database.
4. Begin Sprint 2 with real career-page discovery and drive ingestion.

## Product Direction

The current scaffold intentionally favors reliability, low notification noise, and clean ownership boundaries between scraping, matching, and delivery. Advanced social, recommendation, and community features are deferred until the MVP is stable.
