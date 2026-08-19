-- Migrate foreign keys referencing students(id) to support ON UPDATE CASCADE

-- 1. student_company_targets
ALTER TABLE student_company_targets 
  DROP CONSTRAINT IF EXISTS student_company_targets_student_id_fkey,
  ADD CONSTRAINT student_company_targets_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. opportunity_tracking
ALTER TABLE opportunity_tracking 
  DROP CONSTRAINT IF EXISTS opportunity_tracking_student_id_fkey,
  ADD CONSTRAINT opportunity_tracking_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. alerts_sent
ALTER TABLE alerts_sent 
  DROP CONSTRAINT IF EXISTS alerts_sent_student_id_fkey,
  ADD CONSTRAINT alerts_sent_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. interview_experiences
ALTER TABLE interview_experiences 
  DROP CONSTRAINT IF EXISTS interview_experiences_student_id_fkey,
  ADD CONSTRAINT interview_experiences_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. company_feedback
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_feedback') THEN
    ALTER TABLE company_feedback 
      DROP CONSTRAINT IF EXISTS company_feedback_student_id_fkey,
      ADD CONSTRAINT company_feedback_student_id_fkey 
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. student_notification_preferences
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_notification_preferences') THEN
    ALTER TABLE student_notification_preferences 
      DROP CONSTRAINT IF EXISTS student_notification_preferences_student_id_fkey,
      ADD CONSTRAINT student_notification_preferences_student_id_fkey 
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. student_job_dismissals
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_job_dismissals') THEN
    ALTER TABLE student_job_dismissals 
      DROP CONSTRAINT IF EXISTS student_job_dismissals_student_id_fkey,
      ADD CONSTRAINT student_job_dismissals_student_id_fkey 
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 8. companies (added_by_student_id)
ALTER TABLE companies 
  DROP CONSTRAINT IF EXISTS companies_added_by_student_id_fkey,
  ADD CONSTRAINT companies_added_by_student_id_fkey 
    FOREIGN KEY (added_by_student_id) REFERENCES students(id) ON DELETE SET NULL ON UPDATE CASCADE;
