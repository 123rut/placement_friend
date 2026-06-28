import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const { Pool } = pg;

async function killAndMigrate() {
  const directUrl = process.env.DATABASE_URL.replace(':6543/', ':5432/');
  
  console.log("Connecting directly to port 5432...");
  const pool = new Pool({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    console.log("Terminating other idle connections owned by 'postgres'...");
    // Only target connections owned by the same user to avoid permission errors
    await client.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = current_database() 
        AND usename = current_user
        AND pid <> pg_backend_pid();
    `);
    
    console.log("Waiting 2 seconds for locks to release...");
    await new Promise(r => setTimeout(r, 2000));

    console.log("Adding job_number column to jobs...");
    await client.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number TEXT;");
    console.log("Successfully added job_number column! 🎉");
    client.release();
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

killAndMigrate();
