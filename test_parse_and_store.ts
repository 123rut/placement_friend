import pg from 'pg';
import dotenv from 'dotenv';
import { ResumeService } from './apps/api/src/resume/resume.service';

dotenv.config({ path: '.env.local' });

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const service = new ResumeService(pool);

  // Override extractText to avoid PDF binary check
  service.extractText = async () => {
    return "Ruturaj Challawar. Skills: Node.js, AWS, Postgres. Experience: Backend Engineer at Stripe for 2 years.";
  };

  console.log("Calling parseAndStore...");
  const start = Date.now();
  try {
    const result = await service.parseAndStore(
      Buffer.from("dummy"),
      "application/pdf",
      "8eacbdf4-62b4-4d8e-8906-286e3e1faee7"
    );
    console.log("SUCCESS in", Date.now() - start, "ms");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("FAILED in", Date.now() - start, "ms");
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

run();
