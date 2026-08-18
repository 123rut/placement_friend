import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : false,
});

async function run() {
  await client.connect();

  // 1. Check stats on relevance_status
  const statsRes = await client.query(`
    SELECT relevance_status, COUNT(*) as count
    FROM jobs
    GROUP BY relevance_status
  `);
  console.log("Job Relevance Status Counts in DB:", statsRes.rows);

  // 2. Check sample approved jobs
  const approvedSample = await client.query(`
    SELECT title, company, relevance_status, rejection_reason
    FROM jobs
    WHERE relevance_status = 'APPROVED'
    LIMIT 5
  `);
  console.log("\nSample APPROVED Jobs:");
  console.table(approvedSample.rows);

  // 3. Check sample rejected jobs
  const rejectedSample = await client.query(`
    SELECT title, company, relevance_status, rejection_reason
    FROM jobs
    WHERE relevance_status = 'REJECTED'
    LIMIT 5
  `);
  console.log("\nSample REJECTED Jobs (Preserved with reason):");
  console.table(rejectedSample.rows);

  // 4. Test student dismissal query
  const student = (await client.query(`SELECT id FROM students LIMIT 1`)).rows[0];
  if (student) {
    const job = (await client.query(`SELECT id, title, logical_job_key FROM jobs WHERE relevance_status = 'APPROVED' LIMIT 1`)).rows[0];
    if (job) {
      console.log(`\nTesting dismissal for student ${student.id} on job "${job.title}" (${job.id})...`);
      // Insert dismissal
      await client.query(`
        INSERT INTO student_job_dismissals (student_id, job_id, logical_job_key)
        VALUES ($1, $2, $3)
        ON CONFLICT (student_id, job_id) DO NOTHING
      `, [student.id, job.id, job.logical_job_key]);

      // Query excluding dismissals
      const testQuery = await client.query(`
        SELECT j.id, j.title
        FROM jobs j
        LEFT JOIN student_job_dismissals sjd ON sjd.student_id = $1 AND (
          sjd.job_id = j.id OR
          (j.logical_job_key IS NOT NULL AND sjd.logical_job_key = j.logical_job_key)
        )
        WHERE j.id = $2 AND sjd.id IS NULL
      `, [student.id, job.id]);

      console.log(`Query after dismissal returned rows count: ${testQuery.rows.length} (Expected 0 - job hidden)`);

      // Clean up test dismissal
      await client.query(`DELETE FROM student_job_dismissals WHERE student_id = $1 AND job_id = $2`, [student.id, job.id]);
      console.log("Cleaned up test dismissal.");
    }
  }

  await client.end();
}

run().catch(console.error);
