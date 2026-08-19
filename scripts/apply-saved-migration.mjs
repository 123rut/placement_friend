import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: connStr,
  ssl: connStr.includes("supabase") ? { rejectUnauthorized: false } : false,
});

async function main() {
  console.log("Applying saved_jobs and opportunity_tracking extensions...");
  await pool.query(`
    ALTER TABLE opportunity_tracking
      ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS opportunity_tracking_saved_idx
      ON opportunity_tracking(student_id, is_saved);
  `);
  console.log("Migration applied successfully!");
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
