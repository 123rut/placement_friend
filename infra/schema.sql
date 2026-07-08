DROP TABLE IF EXISTS company_feedback CASCADE;
DROP TABLE IF EXISTS interview_experiences CASCADE;
DROP TABLE IF EXISTS alerts_sent CASCADE;
DROP TABLE IF EXISTS drives CASCADE;
DROP TABLE IF EXISTS student_company_targets CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS colleges CASCADE;
DROP TABLE IF EXISTS system_state CASCADE;
DROP TABLE IF EXISTS student_notification_preferences CASCADE;

DROP TYPE IF EXISTS company_status CASCADE;
DROP TYPE IF EXISTS company_added_by CASCADE;

CREATE TYPE company_status AS ENUM ('active', 'url_missing', 'url_stale', 'requires_auth', 'paused', 'archived');
CREATE TYPE company_added_by AS ENUM ('agent', 'user');

CREATE TABLE colleges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email_domain TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  college_email TEXT NOT NULL UNIQUE,
  college_id TEXT REFERENCES colleges(id),
  branch TEXT NOT NULL,
  cgpa NUMERIC(3,2) NOT NULL,
  batch_year INTEGER NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  careers_url TEXT,
  category TEXT NOT NULL,
  eligible_branches TEXT NOT NULL,
  min_cgpa NUMERIC(3,2),
  avg_package NUMERIC(5,2),
  source TEXT NOT NULL,
  url_verified_at TIMESTAMP,
  added_by_student_id TEXT REFERENCES students(id),
  is_global BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status company_status NOT NULL DEFAULT 'active',
  fail_count INTEGER NOT NULL DEFAULT 0,
  silent_fail_count INTEGER NOT NULL DEFAULT 0,
  last_scraped_at TIMESTAMP,
  last_checked_at TIMESTAMP,
  opportunities_found_last_run INTEGER NOT NULL DEFAULT 0,
  url_confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  last_failure_reason TEXT,
  previous_careers_url TEXT,
  region TEXT NOT NULL DEFAULT 'IN',
  added_by company_added_by NOT NULL DEFAULT 'user'
);

CREATE TABLE student_company_targets (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notify_via TEXT NOT NULL DEFAULT 'email',
  notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  notify_dashboard BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, company_id)
);

CREATE TABLE drives (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  role TEXT NOT NULL,
  type TEXT NOT NULL,
  allowed_branches TEXT[] NOT NULL DEFAULT '{}',
  min_cgpa NUMERIC(3,2),
  apply_link TEXT NOT NULL,
  drive_date TIMESTAMP,
  deadline TIMESTAMP,
  scraped_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT
);

CREATE TABLE alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  drive_id TEXT NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_logged_at TIMESTAMPTZ,
  UNIQUE(student_id, drive_id, channel)
);

CREATE TABLE interview_experiences (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  drive_id TEXT REFERENCES drives(id),
  rounds TEXT NOT NULL,
  questions TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  tips TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_feedback (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  drive_id TEXT REFERENCES drives(id),
  rating INTEGER NOT NULL,
  feedback_type TEXT NOT NULL,
  content TEXT NOT NULL,
  batch_year INTEGER NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX companies_category_idx ON companies(category);
CREATE INDEX drives_company_id_idx ON drives(company_id);
CREATE INDEX students_college_id_idx ON students(college_id);
CREATE INDEX drives_allowed_branches_idx ON drives USING GIN(allowed_branches);

ALTER TABLE colleges DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_company_targets DISABLE ROW LEVEL SECURITY;
ALTER TABLE drives DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_sent DISABLE ROW LEVEL SECURITY;
ALTER TABLE interview_experiences DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_feedback DISABLE ROW LEVEL SECURITY;

CREATE TABLE system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE system_state DISABLE ROW LEVEL SECURITY;

CREATE TABLE student_notification_preferences (
  student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  dashboard_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE student_notification_preferences DISABLE ROW LEVEL SECURITY;

-- Grant access to Supabase roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
