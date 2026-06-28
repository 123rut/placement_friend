import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const { Pool } = pg;

async function addJobNumber() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    console.log("Adding job_number column to jobs table...");
    await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number TEXT;`);
    console.log("Done!");
    client.release();
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await pool.end();
  }
}

addJobNumber();
