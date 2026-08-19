import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not defined in .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("supabase.co") || connectionString.includes("supabase.com")
    ? { rejectUnauthorized: false }
    : false,
});

async function main() {
  console.log("Connecting to database...");
  await client.connect();
  console.log("Connected successfully!");

  try {
    const sqlPath = path.join(__dirname, "../infra/migrate-students-cascade.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing migrate-students-cascade.sql...");
    await client.query(sql);

    console.log("Reloading Supabase PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");

    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
