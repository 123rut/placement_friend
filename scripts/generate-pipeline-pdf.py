from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = "output/pdf/careerpilot-project-pipelines.pdf"


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="TitleMain",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#14213d"),
        spaceAfter=16,
    )
)
styles.add(
    ParagraphStyle(
        name="SectionTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=23,
        textColor=colors.HexColor("#14213d"),
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontSize=8.7,
        leading=11,
        textColor=colors.HexColor("#253047"),
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#253047"),
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="Box",
        parent=styles["BodyText"],
        alignment=1,
        fontSize=8.6,
        leading=10.5,
        textColor=colors.HexColor("#14213d"),
    )
)


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def step_table(rows, widths=None):
    data = [[p(cell, "Box") for cell in row] for row in rows]
    table = Table(data, colWidths=widths, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#9aa8bf")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c7d0df")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f7f9fc")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def key_value_table(rows):
    data = [[p(k, "Small"), p(v, "Small")] for k, v in rows]
    table = Table(data, colWidths=[1.9 * inch, 6.4 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf3fb")),
                ("BACKGROUND", (1, 0), (1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#b8c3d6")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d6deea")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def bullets(items):
    return [p(f"- {item}", "Body") for item in items]


def build():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=landscape(A4),
        rightMargin=0.45 * inch,
        leftMargin=0.45 * inch,
        topMargin=0.42 * inch,
        bottomMargin=0.42 * inch,
    )
    story = []

    story.append(p("CareerPilot Project Pipelines", "TitleMain"))
    story.append(
        p(
            "End-to-end pipeline map for the Placement Friend / CareerPilot AI monorepo. "
            "The project has two job ingestion paths: the newer CareerPilot ATS sync path that writes "
            "to jobs and job_matches, and the older worker scraper path that writes to drives and alerts_sent.",
            "Body",
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        step_table(
            [
                ["Student/User", "Next.js Web App", "NestJS API", "PostgreSQL/Supabase"],
                ["Worker Scheduler", "Scraper/ATS Adapters", "AI Providers", "Notifications/Dashboard"],
            ],
            widths=[2.55 * inch] * 4,
        )
    )
    story.append(Spacer(1, 0.15 * inch))
    story.extend(
        bullets(
            [
                "apps/web owns authenticated UI, dashboard screens, and proxy API routes.",
                "apps/api owns resume parsing, ATS sync, semantic search, match scoring, companies, and agent chat.",
                "apps/worker owns scheduled scraping, page/ATS extraction, drive ingestion, and notification dispatch.",
                "packages/domain owns shared opportunity and student eligibility rules.",
                "infra owns schema, CareerPilot migration, seed data, and database initialization.",
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("Pipeline 1: Current CareerPilot ATS Job Sync", "SectionTitle"))
    story.append(
        p(
            "Triggered from the web app through the NestJS API. It fetches jobs from known ATS providers, "
            "normalizes them, optionally embeds them, upserts them into jobs, and auto-scores matches for the user.",
            "Body",
        )
    )
    story.append(
        step_table(
            [
                ["Web Sync Button", "POST /api/careerpilot/sync", "POST /api/worker/sync", "SyncService.syncAll"],
                ["Load candidate profile", "Load student row", "Load ATS companies", "Filter by CGPA/branch"],
                ["Greenhouse", "Lever", "Ashby", "Workday / SmartRecruiters"],
                ["Normalize jobs", "Hard eligibility pre-check", "Generate Gemini embedding", "Upsert jobs"],
                ["Write sync_logs", "Update company sync_status", "Auto-match per job", "Upsert job_matches"],
            ],
            widths=[2.55 * inch] * 4,
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        key_value_table(
            [
                ("Entry files", "apps/web/app/api/careerpilot/sync/route.ts, apps/api/src/sync/sync.controller.ts"),
                ("Core service", "apps/api/src/sync/sync.service.ts"),
                ("Destination tables", "jobs, job_matches, sync_logs, companies"),
                ("External systems", "Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Gemini embeddings"),
                ("Key behavior", "Skips ineligible companies/jobs, times out slow companies, logs failures, preserves existing embeddings when job content is unchanged."),
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("Pipeline 2: Worker Scraper, Drives, and Notifications", "SectionTitle"))
    story.append(
        p(
            "A scheduled worker cycle scrapes career pages. It can discover missing URLs, validate pages, detect ATS providers, "
            "fall back to AI/regex extraction, save deduplicated drives, then dispatch dashboard and mock email notifications.",
            "Body",
        )
    )
    story.append(
        step_table(
            [
                ["Scheduler interval", "executePipeline", "Resolve active student", "Fetch active companies"],
                ["Missing URL?", "Discover via search", "Validate URL", "Save or flag url_missing"],
                ["Detect redirect", "Scrape page", "Detect login wall", "Detect ATS provider"],
                ["ATS adapter path", "AI/regex fallback path", "Raw opportunities", "Baseline filters"],
                ["Branch filter", "Generate dedupe_key", "Insert drives", "Run eligibility matching"],
                ["dispatchNotifications", "Check duplicates", "Insert alerts_sent", "Append mock email log"],
            ],
            widths=[2.55 * inch] * 4,
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        key_value_table(
            [
                ("Entry files", "apps/worker/src/scheduler.ts, apps/worker/src/index.ts"),
                ("Extraction files", "apps/worker/src/scraper.ts, apps/worker/src/agent.ts, apps/worker/src/ats/*"),
                ("Notification file", "apps/worker/src/notifier.ts"),
                ("Destination tables", "drives, alerts_sent, system_state, companies"),
                ("Key behavior", "Uses company status/failure counters, domain rate limiting, dedupe_key conflict protection, and channel preferences per tracked company."),
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("Resume Parsing and Candidate Profile Pipeline", "SectionTitle"))
    story.append(
        step_table(
            [
                ["Upload PDF/DOCX", "Extract text", "Groq JSON schema parser", "Gemini parser fallback"],
                ["Heuristic fallback", "Normalize profile", "Generate profile embedding", "Upsert candidate_profiles"],
                ["Delete old job_matches", "Profile ready", "Search/match can use vectors", "Agent can read resume"],
            ],
            widths=[2.55 * inch] * 4,
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        key_value_table(
            [
                ("Entry files", "apps/web/app/api/careerpilot/resume/route.ts, apps/api/src/resume/resume.controller.ts"),
                ("Core service", "apps/api/src/resume/resume.service.ts"),
                ("Destination table", "candidate_profiles"),
                ("External systems", "pdf-parse, mammoth, Groq, Gemini embeddings"),
                ("Key behavior", "Sanitizes null bytes, normalizes skills/education/experience, clears stale match results after profile changes."),
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("Search, Match, and CareerPilot Agent Pipeline", "SectionTitle"))
    story.append(
        step_table(
            [
                ["User asks CareerPilot", "Load/create conversation", "Groq/Gemini planner", "Choose tool or answer"],
                ["read_resume", "search_jobs", "compute_match", "get_skill_gap"],
                ["Vector search if embeddings exist", "Keyword fallback search", "Hard requirement checks", "LLM/heuristic scoring"],
                ["Save conversation", "Return answer to web app", "Dashboard reads matches", "User applies externally"],
            ],
            widths=[2.55 * inch] * 4,
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        key_value_table(
            [
                ("Agent service", "apps/api/src/agent/agent.service.ts"),
                ("Job matching service", "apps/api/src/jobs/jobs.service.ts"),
                ("Destination tables", "conversations, job_matches"),
                ("Search data", "jobs joined with companies, with optional pgvector similarity"),
                ("Hard checks", "Experience, degree, branch, graduation year, location, seniority."),
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("Database Relationship Summary", "SectionTitle"))
    story.append(
        step_table(
            [
                ["students", "student_company_targets", "companies", "drives"],
                ["alerts_sent", "jobs", "candidate_profiles", "job_matches"],
                ["sync_logs", "conversations", "system_state", "student_notification_preferences"],
            ],
            widths=[2.55 * inch] * 4,
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.extend(
        bullets(
            [
                "students -> student_company_targets -> companies defines what each student tracks.",
                "companies -> drives -> alerts_sent belongs to the worker placement-drive notification flow.",
                "companies -> jobs -> job_matches belongs to the CareerPilot ATS sync and semantic match flow.",
                "candidate_profiles links a user resume to job_matches and agent personalization.",
                "sync_logs records per-company ATS sync results for observability.",
                "system_state stores runtime markers such as active_student_id and last_notifier_run.",
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("Where The Two Job Models Split", "SectionTitle"))
    story.append(
        key_value_table(
            [
                ("drives model", "Created by the worker scraper. Used for placement-style opportunities, branch/CGPA eligibility, alerts_sent, dashboard/email notifications."),
                ("jobs model", "Created by the CareerPilot ATS sync. Used for normalized ATS jobs, embeddings, semantic search, resume-aware scoring, and job_matches."),
                ("Shared inputs", "companies, students, student_company_targets, candidate_profiles when user-specific sync is requested."),
                ("Practical implication", "The project is not a single straight pipeline yet. It has two ingestion systems that should eventually be unified or bridged if the product wants one canonical opportunity model."),
            ]
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        p(
            "Recommended future consolidation: make jobs the canonical role table, keep drives as campus-specific events only if needed, "
            "and route notifications from job_matches or a unified opportunity_matches table.",
            "Body",
        )
    )

    def footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#697386"))
        canvas.drawString(0.45 * inch, 0.22 * inch, "CareerPilot project pipeline map")
        canvas.drawRightString(11.25 * inch, 0.22 * inch, f"Page {doc_obj.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build()
