import pg from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../apps/web/.env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false,
});

async function run() {
  await client.connect();
  console.log("Connected to database. Applying infra/migrate-job-dismissals.sql...");
  const sql = fs.readFileSync(path.join(__dirname, "../infra/migrate-job-dismissals.sql"), "utf8");
  await client.query(sql);
  console.log("Migration applied successfully!");
  await client.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
