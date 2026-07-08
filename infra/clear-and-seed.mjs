import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedCompanies } from '../packages/domain/src/companies.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../apps/web/.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL is not defined in environment variables.");
  process.exit(1);
}

// 1. Safety check
const args = process.argv.slice(2);
const hasForce = args.includes('--force');

if (!hasForce) {
  console.error(`
⚠ WARNING: DESTROY DATABASE DATA OPERATION ⚠

This operation will delete all company-related data, including job postings (drives),
alerts, targets, feedbacks, and interview experiences.
Only student and college accounts will be preserved.

To execute this operation, run:
  node infra/clear-and-seed.mjs --force
`);
  process.exit(1);
}

// Parse connection URL to show database name safely
let dbName = 'Unknown';
try {
  const url = new URL(connectionString);
  dbName = url.pathname.replace('/', '') || url.hostname;
} catch {}

console.log(`Targeting Database: ${dbName}`);
console.log(`Starting database reset and seeding...`);

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function run() {
  const started = Date.now();
  
  try {
    await client.connect();
    
    // Start Transaction
    await client.query("BEGIN");

    console.log("✓ Clearing previous company and dependent data tables (RESTART IDENTITY)...");
    await client.query(`
      TRUNCATE TABLE 
        company_feedback, 
        interview_experiences, 
        alerts_sent, 
        drives, 
        student_company_targets, 
        companies 
      RESTART IDENTITY;
    `);

    console.log(`✓ Seeding ${seedCompanies.length} companies from catalog...`);
    let insertedCount = 0;
    
    for (const company of seedCompanies) {
      const res = await client.query(
        `INSERT INTO companies (
          id, name, slug, careers_url, category, eligible_branches, 
          min_cgpa, avg_package, source, url_verified_at, is_active, 
          is_global, ats, identifier, site, ats_host, industry, city, country, region, added_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'agent')`,
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
      if (res.rowCount && res.rowCount > 0) {
        insertedCount++;
      }
    }

    // 3. Validation before commit
    if (insertedCount !== seedCompanies.length) {
      throw new Error(`Seeding validation failed. Catalog count: ${seedCompanies.length}, Inserted count: ${insertedCount}`);
    }
    console.log(`✓ Seed validation passed (${insertedCount}/${seedCompanies.length} companies successfully inserted).`);

    // Commit Transaction
    await client.query("COMMIT");
    const duration = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`✓ Transaction committed successfully in ${duration}s!\n`);

    // 4. Print Summary
    printSummary();

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Database seeding failed! Rolled back transaction.");
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

function printSummary() {
  const summary = {
    greenhouse: 0,
    lever: 0,
    workday: 0,
    ashby: 0,
    smartrecruiters: 0,
    amazon: 0,
    unsupported: 0
  };

  let activeCount = 0;
  let inactiveCount = 0;

  for (const company of seedCompanies) {
    if (company.isActive === false) {
      inactiveCount++;
      summary.unsupported++;
    } else {
      activeCount++;
      const ats = company.ats || 'unsupported';
      if (summary[ats] !== undefined) {
        summary[ats]++;
      } else {
        summary.unsupported++;
      }
    }
  }

  console.log(`=========================================`);
  console.log(`           SEEDING SUMMARY               `);
  console.log(`=========================================`);
  console.log(`✓ Database cleared and re-seeded successfully.`);
  console.log(`✓ Total Seeded Companies: ${seedCompanies.length}`);
  console.log(`  - Active: ${activeCount}`);
  console.log(`  - Inactive/Unsupported: ${inactiveCount}`);
  console.log(`\nATS Breakdown (Active):`);
  console.log(`  Greenhouse:      ${summary.greenhouse}`);
  console.log(`  SmartRecruiters: ${summary.smartrecruiters}`);
  console.log(`  Ashby:           ${summary.ashby}`);
  console.log(`  Workday:         ${summary.workday}`);
  console.log(`  Lever:           ${summary.lever}`);
  console.log(`  Amazon:          ${summary.amazon}`);
  console.log(`  Unsupported/Fails: ${summary.unsupported}`);
  console.log(`=========================================`);
}

run();
