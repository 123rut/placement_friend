-- ============================================================
-- Migration: Student Job Dismissals and Soft-Filtering Relevance
-- ============================================================

-- 1. Create student_job_dismissals table
CREATE TABLE IF NOT EXISTS student_job_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    logical_job_key TEXT,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_student_job_dismissals_student ON student_job_dismissals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_job_dismissals_logical ON student_job_dismissals(student_id, logical_job_key);

-- 2. Add relevance_status, rejection_reason, and logical_job_key to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS relevance_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS logical_job_key TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_relevance_status ON jobs(relevance_status);
CREATE INDEX IF NOT EXISTS idx_jobs_logical_key ON jobs(logical_job_key);
