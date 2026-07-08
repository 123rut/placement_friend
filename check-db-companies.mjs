import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    // All candidate profiles
    const profilesRes = await client.query(
      'SELECT user_id, skills, (embedding IS NOT NULL) AS has_embedding, created_at FROM candidate_profiles ORDER BY created_at DESC'
    );
    console.log('All candidate profiles in DB:');
    profilesRes.rows.forEach(r => console.log(r));

    // All students
    const studentsRes = await client.query('SELECT id, full_name, college_email FROM students');
    console.log('\nAll students:');
    studentsRes.rows.forEach(r => console.log(r));
  } finally {
    client.release();
    await pool.end();
  }
}
run();
