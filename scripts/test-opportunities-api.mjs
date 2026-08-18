import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const connectionString = process.env.DATABASE_URL;

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false,
});

async function run() {
  await client.connect();
  const studentsRes = await client.query("SELECT id FROM students LIMIT 1");
  if (studentsRes.rows.length === 0) {
    console.log("No students found in database.");
    await client.end();
    return;
  }
  const studentId = studentsRes.rows[0].id;
  console.log("Testing with student ID:", studentId);

  // Test the query used in getOpportunities
  const targetsRes = await client.query(
    "SELECT company_id FROM student_company_targets WHERE student_id = $1",
    [studentId]
  );
  const trackedCompanyIds = targetsRes.rows.map(r => r.company_id);
  console.log("Tracked companies:", trackedCompanyIds.length);

  const jobsRes = await client.query(
    `SELECT j.id,
            j.company_id,
            j.title AS role,
            j.employment_type AS role_type,
            j.url AS apply_url,
            j.created_at AS posted_at,
            j.location,
            c.name as company_name,
            c.min_cgpa,
            c.eligible_branches,
            COALESCE(ot.status, 'NOT_VIEWED') AS status,
            ot.viewed_at,
            ot.applied_at
     FROM jobs j
     JOIN companies c ON j.company_id = c.id
     LEFT JOIN opportunity_tracking ot ON ot.job_id = j.id AND ot.student_id = $2
     WHERE j.company_id = ANY($1::text[])
     ORDER BY j.created_at DESC LIMIT 5`,
    [trackedCompanyIds, studentId]
  );

  console.log("Queried jobs with tracking status count:", jobsRes.rows.length);
  if (jobsRes.rows.length > 0) {
    console.log("Sample job:", jobsRes.rows[0]);
  }

  await client.end();
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
