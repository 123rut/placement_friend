const pg = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the root .env.local first
dotenv.config({ path: path.join(__dirname, '../.env.local') });
// Then try apps/web/.env.local if not already defined
dotenv.config({ path: path.join(__dirname, '../apps/web/.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL is not defined in the environment or .env.local.");
  console.log("Please define DATABASE_URL in your root or apps/web .env.local, like this:");
  console.log("DATABASE_URL=postgresql://postgres:[password]@db.kogehuzrradxhehyhzsn.supabase.co:6543/postgres");
  process.exit(1);
}

// Supabase requires SSL, so enable it if connecting to supabase.co
const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function run() {
  console.log("Connecting to the database...");
  try {
    await client.connect();
    console.log("Connected successfully!");
  } catch (err) {
    console.error("Failed to connect to the database:", err.message);
    process.exit(1);
  }

  try {
    // 1. Run schema.sql
    console.log("Reading schema.sql...");
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log("Executing schema.sql...");
    await client.query(schemaSql);
    console.log("Schema initialized successfully!");

    // 2. Run seed_colleges.sql
    console.log("Reading seed_colleges.sql...");
    const seedCollegesSql = fs.readFileSync(path.join(__dirname, 'seed_colleges.sql'), 'utf8');
    console.log("Executing seed_colleges.sql...");
    await client.query(seedCollegesSql);
    console.log("Colleges seeded successfully!");

    // 3. Run seed_companies.sql
    console.log("Reading seed_companies.sql...");
    const seedCompaniesSql = fs.readFileSync(path.join(__dirname, 'seed_companies.sql'), 'utf8');
    console.log("Executing seed_companies.sql...");
    await client.query(seedCompaniesSql);
    console.log("Companies seeded successfully!");

  } catch (error) {
    console.error("Database initialization failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

run();
