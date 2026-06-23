import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not defined in environment variables.");
}

export const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes("supabase.co") ? { rejectUnauthorized: false } : false
});

export interface CompanyDb {
  id: string;
  name: string;
  slug: string;
  careers_url: string | null;
  category: string;
  eligible_branches: string;
  min_cgpa: number | null;
  avg_package: number | null;
  source: string;
  url_verified_at: Date | null;
  added_by_student_id: string | null;
  is_global: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  status: "active" | "url_missing" | "url_stale" | "requires_auth" | "paused" | "archived";
  fail_count: number;
  silent_fail_count: number;
  last_scraped_at: Date | null;
  last_checked_at: Date | null;
  opportunities_found_last_run: number;
  url_confirmed_by_user: boolean;
  last_failure_reason: string | null;
  previous_careers_url: string | null;
  region: string;
  added_by: "agent" | "user";
}

export interface DriveDb {
  id: string;
  company_id: string;
  role: string;
  type: string;
  allowed_branches: string[];
  min_cgpa: number | null;
  apply_link: string;
  drive_date: Date | null;
  deadline: Date | null;
  scraped_at: Date;
  dedupe_key: string;
  created_at: Date;
  source: string | null;
}

/**
 * Fetch active companies for the scraper pipeline (paginated).
 * Excludes 'paused' and 'archived'.
 */
export async function getActiveCompanies(page = 1, limit = 50, studentId: string | null = null): Promise<CompanyDb[]> {
  const offset = (page - 1) * limit;
  let queryStr = `SELECT c.* FROM companies c
                  WHERE c.status NOT IN ('paused', 'archived')`;
  const params: any[] = [];

  if (studentId) {
    queryStr = `SELECT c.* FROM companies c
                JOIN student_company_targets t ON c.id = t.company_id
                WHERE t.student_id = $1 AND c.status NOT IN ('paused', 'archived')`;
    params.push(studentId);
  }

  queryStr += ` ORDER BY c.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(queryStr, params);
  return result.rows;
}

/**
 * Bulk insert drives using ON CONFLICT DO NOTHING.
 */
export async function saveDrives(drives: Array<Omit<DriveDb, "scraped_at" | "created_at">>): Promise<number> {
  if (drives.length === 0) return 0;
  const client = await pool.connect();
  let insertedCount = 0;
  try {
    await client.query("BEGIN");
    for (const drive of drives) {
      const res = await client.query(
        `INSERT INTO drives (id, company_id, role, type, allowed_branches, min_cgpa, apply_link, drive_date, deadline, dedupe_key, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          drive.id,
          drive.company_id,
          drive.role,
          drive.type,
          drive.allowed_branches,
          drive.min_cgpa,
          drive.apply_link,
          drive.drive_date,
          drive.deadline,
          drive.dedupe_key,
          drive.source || null
        ]
      );
      if (res.rowCount && res.rowCount > 0) {
        insertedCount++;
      }
    }
    await client.query("COMMIT");
    return insertedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update careers URL, save old to previous_careers_url, reset counters, status = 'active'.
 */
export async function updateCompanyCareersUrl(id: string, url: string | null): Promise<void> {
  const currentRes = await pool.query(`SELECT careers_url FROM companies WHERE id = $1`, [id]);
  const oldUrl = currentRes.rows[0]?.careers_url || null;

  await pool.query(
    `UPDATE companies
     SET careers_url = $1,
         previous_careers_url = CASE WHEN $1 <> $2 THEN $2 ELSE previous_careers_url END,
         fail_count = 0,
         silent_fail_count = 0,
         status = 'active',
         is_active = true,
         url_confirmed_by_user = true,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [url, oldUrl, id]
  );
}

/**
 * Flag company status manually.
 */
export async function flagCompany(id: string, status: CompanyDb["status"]): Promise<void> {
  const is_active = status === "active";
  await pool.query(
    `UPDATE companies
     SET status = $1,
         is_active = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [status, is_active, id]
  );
}

/**
 * Increment fail_count, update last_failure_reason, flag as url_stale if >= 3.
 */
export async function incrementFailCount(id: string, reason: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `UPDATE companies
       SET fail_count = fail_count + 1,
           last_failure_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING fail_count`,
      [reason, id]
    );
    
    const failCount = res.rows[0]?.fail_count || 0;
    if (failCount >= 3) {
      await client.query(
        `UPDATE companies
         SET status = 'url_stale',
             is_active = false
         WHERE id = $1`,
        [id]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Increment silent_fail_count independently.
 */
export async function incrementSilentFailCount(id: string): Promise<void> {
  await pool.query(
    `UPDATE companies
     SET silent_fail_count = silent_fail_count + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
}

/**
 * Update successful scrape stats and reset counters.
 */
export async function updateScrapeStats(id: string, count: number): Promise<void> {
  await pool.query(
    `UPDATE companies
     SET last_scraped_at = CURRENT_TIMESTAMP,
         last_checked_at = CURRENT_TIMESTAMP,
         opportunities_found_last_run = $1,
         fail_count = 0,
         silent_fail_count = CASE WHEN $1 > 0 THEN 0 ELSE silent_fail_count END,
         status = 'active',
         is_active = true,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [count, id]
  );
}

/**
 * Update last_checked_at on every attempt.
 */
export async function updateLastChecked(id: string): Promise<void> {
  await pool.query(
    `UPDATE companies
     SET last_checked_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
}

/**
 * Soft delete by archiving.
 */
export async function archiveCompany(id: string): Promise<void> {
  await pool.query(
    `UPDATE companies
     SET status = 'archived',
         is_active = false,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );
}
