-- ============================================================
-- CareerPilot AI — Migration (run after existing schema.sql)
-- ============================================================

-- 1. Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Extend existing companies table with ATS metadata
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS ats            TEXT,           -- 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'smartrecruiters'
  ADD COLUMN IF NOT EXISTS identifier     TEXT,           -- ATS board/tenant name e.g. "stripe"
  ADD COLUMN IF NOT EXISTS ats_host       TEXT,           -- Workday only: exact host e.g. "workday.wd5.myworkdayjobs.com"
  ADD COLUMN IF NOT EXISTS site           TEXT,           -- Workday only: e.g. "Careers"
  ADD COLUMN IF NOT EXISTS industry       TEXT,           -- e.g. "fintech", "saas"
  ADD COLUMN IF NOT EXISTS country        TEXT DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS city           TEXT,
  ADD COLUMN IF NOT EXISTS sync_status    TEXT DEFAULT 'pending',  -- 'success' | 'failed' | 'pending'
  ADD COLUMN IF NOT EXISTS last_error     TEXT;

-- 3. Jobs table — stores normalized jobs from all ATS sources
CREATE TABLE IF NOT EXISTS jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       TEXT REFERENCES companies(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  location         TEXT,
  remote           BOOLEAN DEFAULT FALSE,
  employment_type  TEXT,                      -- 'fulltime' | 'internship' | 'contract'
  description      TEXT,                      -- full JD text — used for embeddings
  salary_min       INTEGER,
  salary_max       INTEGER,
  url              TEXT UNIQUE NOT NULL,
  job_number       TEXT,
  posted_at        TIMESTAMPTZ,
  embedding        VECTOR(768),               -- Gemini text-embedding-004 outputs 768 dims
  last_synced      TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_company_id_idx ON jobs(company_id);
CREATE INDEX IF NOT EXISTS jobs_employment_type_idx ON jobs(employment_type);
CREATE INDEX IF NOT EXISTS jobs_job_number_idx ON jobs(job_number);
CREATE INDEX IF NOT EXISTS jobs_embedding_idx ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Candidate profiles — parsed from resumes
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID,                       -- links to Supabase auth user
  resume_raw_text     TEXT,                       -- full extracted text from PDF/DOCX
  resume_file_url     TEXT,                       -- Supabase storage URL
  skills              TEXT[] DEFAULT '{}',
  experience          JSONB DEFAULT '[]',         -- [{company, role, years, description}]
  education           JSONB DEFAULT '[]',         -- [{degree, branch, college, year}]
  projects            JSONB DEFAULT '[]',         -- [{name, tech[], description}]
  personal            JSONB DEFAULT '{}',
  summary             TEXT DEFAULT '',
  certifications      JSONB DEFAULT '[]',
  achievements        JSONB DEFAULT '[]',
  publications        JSONB DEFAULT '[]',
  languages           TEXT[] DEFAULT '{}',
  preferred_roles     TEXT[] DEFAULT '{}',
  preferred_industries TEXT[] DEFAULT '{}',
  work_authorization  TEXT DEFAULT '',
  total_experience_years FLOAT DEFAULT 0,
  "current_role"      TEXT DEFAULT '',
  current_company     TEXT DEFAULT '',
  career_stage        TEXT DEFAULT 'New Graduate',
  preferred_location  TEXT,
  expected_ctc        INTEGER,
  embedding           VECTOR(768),               -- Gemini embedding of full profile
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS personal             JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS summary              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS certifications       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS achievements         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS publications         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS languages            TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_roles      TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_industries TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_authorization   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_experience_years FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "current_role"       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_company      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS career_stage         TEXT DEFAULT 'New Graduate';

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON candidate_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique_idx ON candidate_profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_embedding_idx ON candidate_profiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 5. Job matches — cached AI match results
CREATE TABLE IF NOT EXISTS job_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
  match_score     FLOAT,                          -- 0-100
  explanation     TEXT,                           -- LLM-written explanation
  strengths       TEXT[] DEFAULT '{}',
  missing_skills  TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS matches_user_id_idx ON job_matches(user_id);
CREATE INDEX IF NOT EXISTS matches_score_idx ON job_matches(match_score DESC);

-- 6. Conversations — persisted chat history per user
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  title       TEXT,                               -- auto-generated from first message
  messages    JSONB DEFAULT '[]',                -- [{role, content, timestamp}]
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);

-- 7. Sync logs — per-company sync history for observability
CREATE TABLE IF NOT EXISTS sync_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   TEXT REFERENCES companies(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,                     -- 'success' | 'failed' | 'partial'
  jobs_found   INTEGER DEFAULT 0,
  jobs_new     INTEGER DEFAULT 0,
  duration_ms  INTEGER,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sync_logs_company_id_idx ON sync_logs(company_id);
CREATE INDEX IF NOT EXISTS sync_logs_created_at_idx ON sync_logs(created_at DESC);

-- 8. Grant access to Supabase roles
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_matches TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_logs TO anon, authenticated, service_role;

-- Disable RLS for now on non-PII/non-sensitive tables
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs DISABLE ROW LEVEL SECURITY;

-- Re-enable Row Level Security on PII-holding tables
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- candidate_profiles: a user can only see/edit their own row
DROP POLICY IF EXISTS "candidate can view own profile" ON candidate_profiles;
CREATE POLICY "candidate can view own profile"
  ON candidate_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "candidate can update own profile" ON candidate_profiles;
CREATE POLICY "candidate can update own profile"
  ON candidate_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "candidate can insert own profile" ON candidate_profiles;
CREATE POLICY "candidate can insert own profile"
  ON candidate_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- students: same pattern (students table PK is "id" of type text representing the auth.uid())
DROP POLICY IF EXISTS "student can view own row" ON students;
CREATE POLICY "student can view own row"
  ON students
  FOR SELECT
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "student can update own row" ON students;
CREATE POLICY "student can update own row"
  ON students
  FOR UPDATE
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "student can insert own row" ON students;
CREATE POLICY "student can insert own row"
  ON students
  FOR INSERT
  WITH CHECK (auth.uid()::text = id);
