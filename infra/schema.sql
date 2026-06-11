CREATE TABLE colleges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  college_email TEXT NOT NULL UNIQUE,
  college_id TEXT NOT NULL REFERENCES colleges(id),
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
  careers_url TEXT NOT NULL,
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
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_company_targets (
  student_id TEXT NOT NULL REFERENCES students(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  notify_via TEXT NOT NULL DEFAULT 'email',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, company_id)
);

CREATE TABLE drives (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  role TEXT NOT NULL,
  type TEXT NOT NULL,
  eligibility_branches TEXT NOT NULL,
  min_cgpa NUMERIC(3,2),
  apply_link TEXT NOT NULL,
  drive_date TIMESTAMP,
  deadline TIMESTAMP,
  scraped_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts_sent (
  student_id TEXT NOT NULL REFERENCES students(id),
  drive_id TEXT NOT NULL REFERENCES drives(id),
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  channel TEXT NOT NULL,
  PRIMARY KEY (student_id, drive_id, channel)
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
