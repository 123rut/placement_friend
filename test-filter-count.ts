import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function run() {
  const userId = '8eacbdf4-62b4-4d8e-8906-286e3e1faee7';
  
  // 1. Fetch student record
  const studentRes = await pool.query(
    "SELECT id, branch, cgpa, batch_year FROM students WHERE id = $1",
    [userId]
  );
  const studentRecord = studentRes.rows[0];
  console.log("Student Record:", studentRecord);
  
  if (!studentRecord) {
    console.log("No student record found.");
    await pool.end();
    return;
  }
  
  // 2. Fetch active companies
  const companyRes = await pool.query(
    `SELECT id, name, eligible_branches, min_cgpa FROM companies WHERE is_active = TRUE AND ats IS NOT NULL`
  );
  const companies = companyRes.rows;
  console.log(`Loaded ${companies.length} active companies.`);
  
  // 3. Apply filters
  let passedCount = 0;
  let skippedCgpa = 0;
  let skippedBranch = 0;
  
  for (const company of companies) {
    // Check CGPA Minimum Constraint
    if (company.min_cgpa && studentRecord.cgpa < Number(company.min_cgpa)) {
      skippedCgpa++;
      continue;
    }
    // Check Eligible Branches Constraint
    if (company.eligible_branches) {
      const rawBranches = String(company.eligible_branches);
      const cleanBranches = rawBranches.replace(/[{}"']/g, "").split(",").map(b => b.trim().toLowerCase()).filter(Boolean);
      if (cleanBranches.length > 0 && !cleanBranches.includes(studentRecord.branch.toLowerCase())) {
        skippedBranch++;
        continue;
      }
    }
    passedCount++;
  }
  
  console.log(`\nFilter results:`);
  console.log(`- Passed: ${passedCount}`);
  console.log(`- Skipped (CGPA): ${skippedCgpa}`);
  console.log(`- Skipped (Branch): ${skippedBranch}`);
  
  await pool.end();
}

run();
