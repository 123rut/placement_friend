import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const { Pool } = pg;

async function testWithProfile() {
  const userId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // new test UUID
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    
    // Insert mock profile
    console.log("Inserting mock profile...");
    await client.query(
      `INSERT INTO candidate_profiles (user_id, resume_raw_text, skills, experience, education, projects)
       VALUES ($1::uuid, 'Mock resume text', $2, $3, $4, $5)
       ON CONFLICT (user_id) DO NOTHING`,
      [
        userId,
        ['Java', 'Go', 'React'],
        JSON.stringify([{ company: 'TestCorp', role: 'Software Engineer', years: 2, description: 'Worked on Java and Go services' }]),
        JSON.stringify([{ degree: 'B.Tech', branch: 'CSE', college: 'Test College', year: 2024 }]),
        JSON.stringify([{ name: 'Project 1', tech: ['React'], description: 'Frontend project' }])
      ]
    );
    client.release();

    // 1. Send first message
    console.log("Sending first message...");
    let res = await fetch("http://127.0.0.1:4000/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message: "hi" })
    });
    
    console.log("First Response Status:", res.status);
    let data = await res.json();
    console.log("First Response Data:", JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await pool.end();
  }
}

testWithProfile();
