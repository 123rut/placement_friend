import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const { Pool } = pg;

async function checkLocks() {
  const directUrl = process.env.DATABASE_URL.replace(':6543/', ':5432/');
  const pool = new Pool({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    console.log("Checking active locks on table 'jobs'...");
    const resLocks = await client.query(`
      SELECT 
        l.pid,
        a.query,
        a.state,
        a.usename,
        a.application_name,
        l.mode,
        l.granted
      FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE l.relation = 'jobs'::regclass;
    `);

    console.log("Locks found:", resLocks.rows.length);
    if (resLocks.rows.length > 0) {
      console.log(JSON.stringify(resLocks.rows, null, 2));
    } else {
      console.log("No locks found! Table should be free.");
    }
    
    client.release();
  } catch (err) {
    console.error("Failed to check locks:", err.message);
  } finally {
    await pool.end();
  }
}

checkLocks();
