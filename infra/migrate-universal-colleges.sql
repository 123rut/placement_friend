-- ============================================================
-- Migration: Universal College Domain Access & Flexible Institution Selection
-- ============================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS custom_institution_name TEXT,
  ADD COLUMN IF NOT EXISTS institution_source TEXT DEFAULT 'USER_SELECTED',
  ADD COLUMN IF NOT EXISTS institution_verified BOOLEAN DEFAULT FALSE;

-- Optional backfill for existing rows:
-- If college_id is set and is_verified is true, set institution_source to AUTO_DOMAIN and institution_verified to true
UPDATE students
SET 
  institution_source = CASE 
    WHEN college_id IS NOT NULL AND is_verified = TRUE THEN 'AUTO_DOMAIN'
    WHEN college_id IS NOT NULL THEN 'USER_SELECTED'
    ELSE 'CUSTOM'
  END,
  institution_verified = CASE 
    WHEN college_id IS NOT NULL AND is_verified = TRUE THEN TRUE
    ELSE FALSE
  END
WHERE institution_source IS NULL;
