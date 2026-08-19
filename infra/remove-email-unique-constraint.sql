-- ============================================================
-- Migration: Remove Unique Constraint on students.college_email
-- ============================================================

DO $$
BEGIN
  -- 1. Drop unique constraint students_college_email_key if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_college_email_key'
  ) THEN
    ALTER TABLE students DROP CONSTRAINT students_college_email_key;
  END IF;

  -- 2. Drop any unique index on college_email if created separately
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'students' AND indexname = 'students_college_email_key'
  ) THEN
    DROP INDEX IF EXISTS students_college_email_key;
  END IF;
END $$;
