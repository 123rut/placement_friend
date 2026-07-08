/**
 * CareerPilot AI — ATS Sync Engine
 * 
 * Syncs jobs from all registered companies into the jobs table.
 * Handles upsert (insert new, skip duplicates by URL) and embedding generation.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { CompanySeed } from "./company-registry.js";
import { fetchGreenhouseJobs } from "./ats/greenhouse-v2.js";
import { fetchLeverJobs } from "./ats/lever-v2.js";
import { fetchAshbyJobs } from "./ats/ashby.js";
import { embedText } from "./embedding.js";
import { NormalizedJob } from "./ats/normalized-job.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : false
});

// ── Adapter router ────────────────────────────────────────────────
async function fetchJobsForCompany(company: CompanySeed): Promise<NormalizedJob[]> {
  switch (company.ats) {
    case "greenhouse":
      return fetchGreenhouseJobs(company.identifier);
    case "lever":
      return fetchLeverJobs(company.identifier);
    case "ashby":
      return fetchAshbyJobs(company.identifier);
    case "workday":
      // Workday uses a different flow — skip for now, use existing workday.ts
      console.log(`[Sync] Workday sync for ${company.name} — using existing adapter`);
      return [];
    case "smartrecruiters": {
      const url = `https://api.smartrecruiters.com/v1/companies/${company.identifier}/postings`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`SmartRecruiters HTTP ${res.status}`);
      const data = await res.json();
      const postings: any[] = data.content || [];
      return postings.map((p: any): NormalizedJob => ({
        title: p.name,
        location: p.location?.city || null,
        remote: p.workplace === "remotely",
        employmentType: p.typeOfEmployment?.id?.toLowerCase().includes("intern") ? "internship" : "fulltime",
        description: p.jobAd?.sections?.jobDescription?.text || "",
        salaryMin: null,
        salaryMax: null,
        url: `https://careers.smartrecruiters.com/${company.identifier}/${p.id}`,
        postedAt: p.releasedDate ? new Date(p.releasedDate) : null
      }));
    }
    default:
      return [];
  }
}

// ── Upsert jobs into DB ───────────────────────────────────────────
async function upsertJobs(jobs: NormalizedJob[], companyId: string): Promise<{ total: number; newCount: number }> {
  if (jobs.length === 0) return { total: 0, newCount: 0 };

  let newCount = 0;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingRes = await client.query(
      `SELECT url, title, description, embedding::text FROM jobs WHERE company_id = $1`,
      [companyId]
    );
    const existingMap = new Map(existingRes.rows.map(r => [r.url, r]));

    for (const job of jobs) {
      if (!job.url) continue;

      const existingJob = existingMap.get(job.url);
      let embeddingParam: string | null = null;

      if (
        existingJob &&
        existingJob.embedding &&
        existingJob.title === job.title &&
        existingJob.description === job.description
      ) {
        embeddingParam = existingJob.embedding;
      } else {
        const embeddingText = `${job.title}\n${job.location || ""}\n${job.description}`;
        const embedding = await embedText(embeddingText);
        embeddingParam = embedding ? `[${embedding.join(",")}]` : null;
      }

      const res = await client.query(
        `INSERT INTO jobs (company_id, title, location, remote, employment_type, description, salary_min, salary_max, url, posted_at, embedding, last_synced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, NOW())
         ON CONFLICT (url) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           location = EXCLUDED.location,
           embedding = COALESCE(EXCLUDED.embedding, jobs.embedding),
           last_synced = NOW()
         RETURNING (xmax = 0) AS is_new`,
        [
          companyId,
          job.title,
          job.location,
          job.remote,
          job.employmentType,
          job.description,
          job.salaryMin,
          job.salaryMax,
          job.url,
          job.postedAt,
          embeddingParam
        ]
      );

      if (res.rows[0]?.is_new) newCount++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { total: jobs.length, newCount };
}



// ── Main sync loop ────────────────────────────────────────────────
export async function syncAllCompanies(companyIds?: string[]): Promise<void> {
  let queryStr = `SELECT * FROM companies WHERE is_active = TRUE AND ats IS NOT NULL`;
  const params: any[] = [];
  if (companyIds && companyIds.length > 0) {
    queryStr += ` AND id = ANY($1)`;
    params.push(companyIds);
  }

  const res = await pool.query(queryStr, params);
  const companies = res.rows;

  console.log(`\n🔄 Starting sync for ${companies.length} companies...`);

  for (const company of companies) {
    const start = Date.now();
    console.log(`\n[${company.name}] Syncing via ${company.ats.toUpperCase()}...`);

    try {
      const jobs = await fetchJobsForCompany(company);
      console.log(`[${company.name}] Fetched ${jobs.length} jobs`);

      const { total, newCount } = await upsertJobs(jobs, company.id);
      const durationMs = Date.now() - start;

      // Update company sync status
      await pool.query(
        `UPDATE companies SET last_scraped_at = NOW(), sync_status = 'success', last_error = NULL WHERE id = $1`,
        [company.id]
      );

      // Log to sync_logs
      await pool.query(
        `INSERT INTO sync_logs (company_id, status, jobs_found, jobs_new, duration_ms)
         VALUES ($1, 'success', $2, $3, $4)`,
        [company.id, total, newCount, durationMs]
      );

      console.log(`[${company.name}] ✓ ${total} jobs synced, ${newCount} new (${durationMs}ms)`);

    } catch (err: any) {
      const durationMs = Date.now() - start;
      console.error(`[${company.name}] ✗ Failed: ${err.message}`);

      await pool.query(
        `UPDATE companies SET sync_status = 'failed', last_error = $1 WHERE id = $2`,
        [err.message, company.id]
      );

      await pool.query(
        `INSERT INTO sync_logs (company_id, status, jobs_found, jobs_new, duration_ms, error)
         VALUES ($1, 'failed', 0, 0, $2, $3)`,
        [company.id, durationMs, err.message]
      );
    }

    // Small delay between companies to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n✅ Sync complete.");
  await pool.end();
}

// ── CLI entrypoint ────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);

  if (args[0] === "seed") {
    console.log("Database seeding must be run through the main bootstrap script: npm run db:init");
    pool.end();
  } else {
    // Sync specific companies if IDs passed, else all
    const ids = args.length > 0 ? args : undefined;
    syncAllCompanies(ids).catch(console.error);
  }
}
