import "dotenv/config";
import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

function parseJobIdentity(url, fallbackCompany, fallbackJobNumber) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return hashedIdentity("unknown-hash", fallbackCompany, fallbackJobNumber, url);
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  let match = host.match(/^boards\.greenhouse\.io$/) && path.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (match) return { source: "greenhouse", company: match[1], jobId: match[2] };

  match = host.match(/^jobs\.lever\.co$/) && path.match(/^\/([^/]+)\/([^/]+)/);
  if (match) return { source: "lever", company: match[1], jobId: match[2] };

  match = host.match(/^careers\.smartrecruiters\.com$/) && path.match(/^\/([^/]+)\/([^/-]+)/);
  if (match) return { source: "smartrecruiters", company: match[1], jobId: match[2] };

  match = host.match(/^([^.]+)\.wd\d+\.myworkdayjobs\.com$/);
  if (match) {
    const id = normalizeWorkdayJobId(path) || normalizeWorkdayJobId(fallbackJobNumber);
    if (id) return { source: "workday", company: match[1], jobId: id };
  }

  if (host.includes("icims.com")) {
    const jobId = parsed.searchParams.get("jobid") || path.match(/\/jobs\/(\d+)/)?.[1];
    if (jobId) return { source: "icims", company: fallbackCompany, jobId };
  }

  return hashedIdentity("unknown-hash", fallbackCompany, fallbackJobNumber, url);
}

function parseUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function normalizeWorkdayJobId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const req = raw.match(/\b(?:R|JR)[-_ ]?0*([0-9]+)\b/i);
  if (req) return req[1];
  const tail = raw.match(/_((?:R|JR)[-_ ]?0*[0-9]+)$/i);
  return tail ? normalizeWorkdayJobId(tail[1]) : "";
}

function hashedIdentity(source, company, jobNumber, url) {
  const seed = [company || "unknown", jobNumber || "", normalizedUrlPath(url)].join("|");
  return {
    source,
    company: company || "unknown",
    jobId: `hash-${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24)}`,
  };
}

function normalizedUrlPath(url) {
  const parsed = parseUrl(url);
  if (!parsed) return String(url || "").split("?")[0].replace(/\/$/, "");
  return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const failed = [];

  try {
    const jobs = await client.query(`
      SELECT j.id, j.url, j.job_number, c.identifier, c.ats, c.slug
      FROM jobs j
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE j.source IS NULL OR j.company IS NULL OR j.job_id IS NULL
    `);

    for (const row of jobs.rows) {
      const fallbackCompany = row.identifier || row.slug || "unknown";
      const identity = parseJobIdentity(row.url, fallbackCompany, row.job_number);

      try {
        await client.query(
          `UPDATE jobs SET source = $1, company = $2, job_id = $3 WHERE id = $4`,
          [identity.source, identity.company, identity.jobId, row.id],
        );
      } catch (error) {
        failed.push({ id: row.id, url: row.url, reason: error.message });
      }
    }

    const dupes = await client.query(`
      SELECT source, company, job_id, COUNT(*)::int AS count, ARRAY_AGG(id ORDER BY created_at, id) AS ids
      FROM jobs
      GROUP BY source, company, job_id
      HAVING COUNT(*) > 1
    `);

    console.log(`Backfilled ${jobs.rowCount - failed.length}/${jobs.rowCount} jobs.`);
    console.log(`Duplicate identity groups processed: ${dupes.rowCount}.`);
    
    let deletedCount = 0;
    for (const dupe of dupes.rows) {
      // The newest job is the last one in the array (due to ORDER BY created_at, id)
      const keepId = dupe.ids[dupe.ids.length - 1];
      const deleteIds = dupe.ids.slice(0, -1);
      
      console.log(`Keeping ${keepId}, deleting duplicates: ${deleteIds.join(", ")} for ${dupe.source}/${dupe.company}/${dupe.job_id}`);
      
      if (deleteIds.length > 0) {
        await client.query(`DELETE FROM jobs WHERE id = ANY($1)`, [deleteIds]);
        deletedCount += deleteIds.length;
      }
    }
    console.log(`Deleted ${deletedCount} duplicate job entries.`);

    for (const failure of failed) {
      console.warn(`Failed ${failure.id}: ${failure.reason} (${failure.url || "no url"})`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
