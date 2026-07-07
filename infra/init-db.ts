import pg from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { seedCompanies } from "../packages/domain/src/companies.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  } catch (err: any) {
    console.error("Failed to connect to the database:", err.message);
    process.exit(1);
  }

  try {
    // Start Transaction
    await client.query("BEGIN");

    // 1. Run schema.sql
    console.log("Reading schema.sql...");
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log("Executing schema.sql...");
    await client.query(schemaSql);
    console.log("Schema initialized successfully!");

    // 1b. Run migrate-careerpilot.sql
    console.log("Reading migrate-careerpilot.sql...");
    const migrateSql = fs.readFileSync(path.join(__dirname, 'migrate-careerpilot.sql'), 'utf8');
    console.log("Executing migrate-careerpilot.sql...");
    await client.query(migrateSql);
    console.log("Migration extensions applied successfully!");

    // 2. Run seed_colleges.sql
    console.log("Reading seed_colleges.sql...");
    const seedCollegesSql = fs.readFileSync(path.join(__dirname, 'seed_colleges.sql'), 'utf8');
    console.log("Executing seed_colleges.sql...");
    await client.query(seedCollegesSql);
    console.log("Colleges seeded successfully!");

    // 3. Seed companies directly from the unified companies.ts catalog in-memory
    console.log(`Seeding ${seedCompanies.length} companies from unified catalog...`);
    for (const company of seedCompanies) {
      await client.query(
        `INSERT INTO companies (
          id, name, slug, careers_url, category, eligible_branches, 
          min_cgpa, avg_package, source, url_verified_at, is_active, 
          is_global, ats, identifier, site, ats_host, industry, city, country, region, added_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'agent')
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          category = EXCLUDED.category,
          eligible_branches = EXCLUDED.eligible_branches,
          min_cgpa = EXCLUDED.min_cgpa,
          avg_package = EXCLUDED.avg_package,
          careers_url = EXCLUDED.careers_url,
          ats = EXCLUDED.ats,
          identifier = EXCLUDED.identifier,
          site = EXCLUDED.site,
          ats_host = EXCLUDED.ats_host,
          industry = EXCLUDED.industry,
          city = EXCLUDED.city,
          country = EXCLUDED.country,
          region = EXCLUDED.region,
          is_active = EXCLUDED.is_active`,
        [
          company.id,
          company.name,
          company.slug,
          company.careersUrl,
          company.category,
          company.eligibleBranches.join(", "),
          company.minCgpa,
          company.avgPackageLpa,
          company.source,
          company.urlVerifiedAt,
          company.isActive,
          true, // is_global
          company.ats,
          company.identifier,
          company.site || null,
          company.host || null,
          company.industry || null,
          company.city || null,
          company.country || null,
          company.country || 'IN'
        ]
      );
    }

    // 4. Deactivate catalog-managed companies that were removed from the catalog
    const catalogIds = seedCompanies.map(c => c.id);
    if (catalogIds.length > 0) {
      await client.query(
        `UPDATE companies
         SET is_active = FALSE
         WHERE source = 'careerpilot-catalog'
         AND id NOT IN (${catalogIds.map((_, i) => `$${i + 1}`).join(', ')})`,
        catalogIds
      );
      console.log("Deactivated removed catalog companies.");
    }

    // Commit Transaction
    await client.query("COMMIT");
    console.log("Seeding transaction committed successfully!");

  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Database initialization failed (rolled back transaction):", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

run();
