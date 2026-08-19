-- ============================================================
-- Fix Row-Level Security (RLS) Policy for 'students' & 'student_company_targets'
-- Run this in your Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Enable RLS on students and drop email unique constraint
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_college_email_key;
DROP INDEX IF EXISTS students_college_email_key;


-- 2. Drop old conflicting or partial policies
DROP POLICY IF EXISTS "student can view own row" ON students;
DROP POLICY IF EXISTS "student can update own row" ON students;
DROP POLICY IF EXISTS "student can insert own row" ON students;
DROP POLICY IF EXISTS "student can manage own row" ON students;

-- 3. Create comprehensive FOR ALL policy (SELECT, INSERT, UPDATE)
CREATE POLICY "student can manage own row"
  ON students
  FOR ALL
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- 4. Enable RLS and add policy for student_company_targets
ALTER TABLE student_company_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student can manage own targets" ON student_company_targets;

CREATE POLICY "student can manage own targets"
  ON student_company_targets
  FOR ALL
  USING (auth.uid()::text = student_id)
  WITH CHECK (auth.uid()::text = student_id);

-- 5. Fix candidate_profiles RLS policy as well
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "candidate can view own profile" ON candidate_profiles;
DROP POLICY IF EXISTS "candidate can update own profile" ON candidate_profiles;
DROP POLICY IF EXISTS "candidate can insert own profile" ON candidate_profiles;
DROP POLICY IF EXISTS "candidate can manage own profile" ON candidate_profiles;

CREATE POLICY "candidate can manage own profile"
  ON candidate_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
