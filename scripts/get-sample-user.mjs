import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const res = await pool.query("SELECT user_id FROM candidate_profiles LIMIT 1");
  console.log("Sample user ID:", res.rows[0]?.user_id);
  await pool.end();
}

main().catch(console.error);
