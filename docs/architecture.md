# MVP Architecture

## Services

### Web App

The web app handles onboarding, profile management, company selection, and the dashboard experience. For the first release it can also expose internal API routes for low-complexity reads and writes.

### Worker

The worker owns scheduled scraping, normalization, deduplication, eligibility matching, and notification dispatch preparation. This keeps time-based background work separate from the student-facing request cycle.

### Database

The relational model stores students, tracked companies, opportunities, eligibility rules, and notifications. A unique dedupe key protects the system from duplicate opportunities when the same opening is observed in multiple runs.

## Main Flows

### Onboarding

1. Student signs up using college email.
2. Student completes profile and selects tracked companies.
3. Student lands on a personalized dashboard.

### Scraping And Matching

1. Scheduler triggers company fetch jobs.
2. Worker extracts raw openings from career pages.
3. Normalizer maps them to a shared `Opportunity` shape.
4. Dedupe logic skips already-known roles.
5. Eligibility engine computes qualified student matches.
6. Notification jobs are created for newly qualified students.

### Notifications

The MVP can start with email plus internal dashboard alerts. Additional channels such as Telegram or WhatsApp should be abstracted behind a provider interface so the matching pipeline does not depend on delivery method details.

## Reliability Notes

- Store `application_url`, `deadline`, and `source_url` on every opportunity.
- Preserve scrape run logs for debugging extractor failures.
- Prefer idempotent worker steps keyed by opportunity dedupe hash.
- Send notifications only on first qualification match or meaningful updates.
