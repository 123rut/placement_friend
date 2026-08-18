-- ============================================================
-- CareerPilot — Opportunity Status Tracking Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunity_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'VIEWED'
        CHECK (status IN ('VIEWED', 'APPLIED')),

    viewed_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (student_id, job_id)
);

CREATE INDEX IF NOT EXISTS opportunity_tracking_student_id_idx
    ON opportunity_tracking(student_id);
CREATE INDEX IF NOT EXISTS opportunity_tracking_job_id_idx
    ON opportunity_tracking(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON opportunity_tracking TO anon, authenticated, service_role;
ALTER TABLE opportunity_tracking DISABLE ROW LEVEL SECURITY;
