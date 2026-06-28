import fs from 'fs';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const { Pool } = pg;

async function runMigration() {
  console.log("Connecting to database...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'infra', 'migrate-careerpilot.sql');
    console.log(`Reading SQL from ${sqlPath}...`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing migration SQL...");
    await client.query(sql);
    
    console.log("Migration executed successfully! 🎉");
    client.release();
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
