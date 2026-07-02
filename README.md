# Placement Friend

A SaaS platform that helps students discover placement drives and internships before deadlines pass. Built with TypeScript, JavaScript, and modern web technologies.

## Overview

Placement & Internship Alert Agent centralizes company career-page tracking, student eligibility matching, and timely notifications to ensure students never miss an opportunity.

## Tech Stack

- **TypeScript** - 48.5% (Type-safe backend and frontend logic)
- **JavaScript** - 43.9% (Frontend frameworks and utilities)
- **CSS** - 7.6% (Responsive UI styling)
- **Next.js** - Frontend framework
- **Supabase/PostgreSQL** - Database and authentication

## Current Status (Sprint 1 ✅)

- ✅ College-email-first onboarding with domain-to-college mapping
- ✅ Student profile setup for branch, CGPA, and batch year
- ✅ Top 100 seeded companies with category, eligibility, and package metadata
- ✅ PRD-aligned SQL schema and seed files for Supabase/PostgreSQL
- ✅ Foundation dashboard and API routes for colleges and companies

## Full MVP Scope

- 🎯 Authentication with college email
- 🎯 Student profile management
- 🎯 Company tracking and discovery
- 🎯 Opportunity scraping and deduplication
- 🎯 Eligibility matching
- 🎯 Timely notifications
- 🎯 Upcoming drives dashboard

## Repository Structure

```
placement_friend/
├── apps/
│   ├── web/              # Student-facing Next.js application
│   └── worker/           # Scraping and notification orchestration
├── packages/
│   └── domain/           # Shared domain types and business logic
├── docs/                 # Product and architecture documentation
├── infra/                # SQL schema and seed data
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v16.0.0 or higher)
- npm or yarn
- Supabase account (for database)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/123rut/placement_friend.git
cd placement_friend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your Supabase credentials in `.env.local`

5. Load the database schema:
```bash
# Connect to your Supabase project and run:
# - infra/seed_colleges.sql
# - infra/seed_companies.sql
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

## Next Steps (Sprint 2 & Beyond)

1. Wire the Sprint 1 schema into a production Supabase project
2. Replace mock onboarding state with Supabase Auth and persisted student records
3. Implement career-page discovery and drive ingestion
4. Build eligibility matching engine
5. Set up notification system

## Architecture Philosophy

- **Reliability First**: Focus on data accuracy and consistency
- **Low Notification Noise**: Quality over quantity in alerts
- **Clean Boundaries**: Clear separation between scraping, matching, and delivery
- **Scalability**: Foundation for future social and recommendation features

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support & Issues

Found a bug? Have a feature request? Please [open an issue](https://github.com/123rut/placement_friend/issues) on GitHub.

## License

This project is open source and available under the MIT License.

---

**Made for students, by developers.** Helping placement aspirants succeed! 🚀
