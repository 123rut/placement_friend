import { Injectable, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { SyncResult } from "../careerpilot.types";
import { DB_POOL } from "../db/db.module";
import { JobsService } from "../jobs/jobs.service";
import { JobRelevanceValidator } from "../classifier/job-relevance-validator";
import { LogicalJobKey } from "../classifier/logical-job-key";
import { SectionParser } from "../classifier/section-parser";

interface NormalizedJob {
  source: string;
  company: string;
  jobId: string;
  title: string;
  location: string | null;
  remote: boolean;
  employmentType: string;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  url: string;
  jobNumber: string | null;
  postedAt: Date | null;
}

interface SyncSummary {
  processed: number;
  succeeded: number;
  failed: number;
  jobsFound: number;
  jobsNew: number;
}

@Injectable()
export class SyncService {
  private cancelRequested = false;
  private isSyncing = false;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly jobsService: JobsService,
  ) {}

  /** Signal the running syncAll loop to stop after the current company finishes. */
  stopSync(): { message: string } {
    if (!this.isSyncing) {
      return { message: "No sync is currently running." };
    }
    this.cancelRequested = true;
    return { message: "Stop signal sent. Sync will stop after the current company finishes." };
  }

  getSyncStatus(): { isSyncing: boolean; cancelRequested: boolean } {
    return { isSyncing: this.isSyncing, cancelRequested: this.cancelRequested };
  }

  async getCompanies(activeOnly = true) {
    const q = activeOnly
      ? `SELECT * FROM companies WHERE is_active = TRUE AND ats IS NOT NULL ORDER BY name`
      : `SELECT * FROM companies WHERE ats IS NOT NULL ORDER BY name`;
    const res = await this.pool.query(q);
    return res.rows;
  }

  async syncCompany(company: any, studentProfile?: any, studentRecord?: any, userId?: string): Promise<SyncResult> {
    const start = Date.now();
    const ats = company.ats || "unknown";
    console.log(`[Sync] ${company.name} (${ats}) started.`);
    try {
      const jobs = await this.fetchJobsForATS(company);
      const { total, newCount } = await this.upsertJobs(jobs, company.id, studentProfile, studentRecord, userId);
      const durationMs = Date.now() - start;

      await this.pool.query(
        `UPDATE companies SET last_scraped_at = NOW(), sync_status = 'success', last_error = NULL WHERE id = $1`,
        [company.id]
      );
      await this.logSync(company.id, "success", total, newCount, durationMs);
      console.log(`[Sync] ${company.name} (${ats}) completed: ${total} jobs, ${newCount} new, ${durationMs}ms.`);

      return { companyId: company.id, companyName: company.name, status: "success", jobsFound: total, jobsNew: newCount, durationMs };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const reason = err?.message || "Unknown sync error";
      await this.pool.query(
        `UPDATE companies SET sync_status = 'failed', last_error = $1 WHERE id = $2`,
        [reason, company.id]
      );
      await this.logSync(company.id, "failed", 0, 0, durationMs, reason);
      console.warn(`[Sync] ${company.name} (${ats}) failed after ${durationMs}ms: ${reason}`);
      return { companyId: company.id, companyName: company.name, status: "failed", jobsFound: 0, jobsNew: 0, durationMs, error: reason };
    }
  }

  async syncAll(userId?: string): Promise<SyncResult[]> {
    this.cancelRequested = false;
    this.isSyncing = true;
    let studentProfile: any = null;
    let studentRecord: any = null;
    if (userId) {
      try {
        const profileRes = await this.pool.query(
          "SELECT skills, experience, education, preferred_location FROM candidate_profiles WHERE user_id = $1::uuid",
          [userId]
        );
        if (profileRes.rows[0]) {
          studentProfile = profileRes.rows[0];
        }
        const studentRes = await this.pool.query(
          "SELECT branch, cgpa, batch_year FROM students WHERE id = $1",
          [userId]
        );
        if (studentRes.rows[0]) {
          studentRecord = studentRes.rows[0];
        }
      } catch (err: any) {
        console.warn("[Sync] Student profile query failed:", err.message);
      }
    }

    let companies = await this.getCompanies();
    if (studentRecord) {
      const initialCount = companies.length;
      companies = companies.filter((company: any) => {
        // Check CGPA Minimum Constraint
        if (company.min_cgpa && studentRecord.cgpa < Number(company.min_cgpa)) {
          console.log(`[Sync Filter] Skipping company ${company.name} due to CGPA constraint (Requires: ${company.min_cgpa}, Student CGPA: ${studentRecord.cgpa})`);
          return false;
        }
        // Check Eligible Branches Constraint
        if (company.eligible_branches) {
          const rawBranches = String(company.eligible_branches);
          // Handle PostgreSQL array format or comma-separated string
          const cleanBranches = rawBranches.replace(/[{}"']/g, "").split(",").map(b => b.trim().toLowerCase()).filter(Boolean);
          if (cleanBranches.length > 0 && !cleanBranches.includes(studentRecord.branch.toLowerCase())) {
            console.log(`[Sync Filter] Skipping company ${company.name} due to branch constraint (Eligible: ${cleanBranches.join(", ")}, Student Branch: ${studentRecord.branch})`);
            return false;
          }
        }
        return true;
      });
      console.log(`[Sync] Personalizing sync. Syncing ${companies.length} out of ${initialCount} companies.`);
    }

    const results: SyncResult[] = [];
    for (const company of companies) {
      const COMPANY_TIMEOUT_MS = 90_000; // 90 s per company — prevents one slow ATS from blocking the rest
      const timeoutResult: SyncResult = {
        companyId: company.id,
        companyName: company.name,
        status: "failed",
        jobsFound: 0,
        jobsNew: 0,
        durationMs: COMPANY_TIMEOUT_MS,
        error: `Sync timed out after ${COMPANY_TIMEOUT_MS / 1000}s`,
      };

      const result = await Promise.race([
        this.syncCompany(company, studentProfile, studentRecord, userId),
        new Promise<SyncResult>((resolve) =>
          setTimeout(() => resolve(timeoutResult), COMPANY_TIMEOUT_MS)
        ),
      ]);

      results.push(result);
      if (result.status === "failed") {
        console.warn(`[Sync] Continuing after ${result.companyName} failure: ${result.error || "Unknown error"}`);
      }
      await new Promise((r) => setTimeout(r, 300));

      if (this.cancelRequested) {
        console.log("[Sync] Stop signal received. Stopping sync loop gracefully.");
        break;
      }
    }
    const summary = this.summarizeSyncResults(results);
    console.log(
      `[Sync Complete] Companies Processed: ${summary.processed}; Succeeded: ${summary.succeeded}; Failed: ${summary.failed}; Jobs Found: ${summary.jobsFound}; New Jobs: ${summary.jobsNew}`,
    );
    this.isSyncing = false;
    this.cancelRequested = false;
    return results;
  }



  private async fetchJobsForATS(company: any): Promise<NormalizedJob[]> {
    switch (company.ats) {
      case "greenhouse":
        return this.fetchGreenhouse(company.identifier);
      case "lever":
        return this.fetchLever(company.identifier);
      case "ashby":
        return this.fetchAshby(company.identifier);
      case "workday":
        return this.fetchWorkday(company.identifier, company.site, company.host || company.ats_host);
      case "smartrecruiters":
        return this.fetchSmartRecruiters(company.identifier);
      default:
        return [];
    }
  }

  private async fetchGreenhouse(identifier: string): Promise<NormalizedJob[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${identifier}/jobs?content=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Greenhouse HTTP ${res.status} for ${identifier}`);
    const data = await res.json();
    return (data.jobs || []).map((j: any) => ({
      source: "greenhouse",
      company: identifier,
      jobId: this.stableJobId("greenhouse", identifier, j.id?.toString() || j.internal_job_id?.toString() || null, j.absolute_url, j.title, j.location?.name, j.updated_at),
      title: j.title,
      location: j.location?.name || null,
      remote: (j.location?.name || "").toLowerCase().includes("remote"),
      employmentType: j.title.toLowerCase().includes("intern") ? "internship" : "fulltime",
      description: this.stripHtml(j.content || j.description || ""),
      salaryMin: null, salaryMax: null,
      url: j.absolute_url || "",
      jobNumber: j.internal_job_id?.toString() || j.id?.toString() || null,
      postedAt: j.updated_at ? new Date(j.updated_at) : null,
    })).filter((j: NormalizedJob) => j.url);
  }

  private async fetchLever(identifier: string): Promise<NormalizedJob[]> {
    const url = `https://api.lever.co/v0/postings/${identifier}?mode=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Lever HTTP ${res.status} for ${identifier}`);
    const jobs: any[] = await res.json();
    return jobs.map(j => ({
      source: "lever",
      company: identifier,
      jobId: this.stableJobId("lever", identifier, j.id || j.reqId || null, j.hostedUrl, j.text, j.categories?.location, j.createdAt),
      title: j.text,
      location: j.categories?.location || null,
      remote: j.workplaceType === "remote",
      employmentType: j.text?.toLowerCase().includes("intern") ? "internship" : "fulltime",
      description: this.stripHtml([j.descriptionPlain, ...(j.lists || []).map((l: any) => l.content)].join("\n")),
      salaryMin: j.salaryRange?.min || null, salaryMax: j.salaryRange?.max || null,
      url: j.hostedUrl || "",
      jobNumber: j.reqId || j.id || null,
      postedAt: j.createdAt ? new Date(j.createdAt) : null,
    })).filter(j => j.url);
  }

  private async fetchAshby(identifier: string): Promise<NormalizedJob[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${identifier}?includeCompensation=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Ashby HTTP ${res.status} for ${identifier}`);
    const data = await res.json();
    return (data.jobs || []).map((j: any) => ({
      source: "ashby",
      company: identifier,
      jobId: this.stableJobId("ashby", identifier, j.id?.toString() || null, j.jobUrl || j.applyUrl, j.title, j.location || j.locationName, j.publishedDate),
      title: j.title,
      location: j.location || j.locationName || null,
      remote: j.isRemote || false,
      employmentType: j.title?.toLowerCase().includes("intern") ? "internship" : "fulltime",
      description: this.stripHtml(j.descriptionHtml || j.description || ""),
      salaryMin: j.compensation?.minValue || null, salaryMax: j.compensation?.maxValue || null,
      url: j.jobUrl || j.applyUrl || "",
      jobNumber: j.id?.toString() || null,
      postedAt: j.publishedDate ? new Date(j.publishedDate) : null,
    })).filter((j: NormalizedJob) => j.url);
  }

  private async fetchWorkday(identifier: string, site?: string | null, host?: string | null): Promise<NormalizedJob[]> {
    if (!site) throw new Error(`Workday site missing for ${identifier}`);

    const resolvedHost = host || `${identifier}.wd1.myworkdayjobs.com`;
    const url = `https://${resolvedHost}/wday/cxs/${identifier}/${site}/jobs`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: "",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Workday HTTP ${res.status} for ${identifier}`);
    const data = await res.json();
    return (data.jobPostings || []).map((job: any) => ({
      source: "workday",
      company: identifier,
      jobId: this.stableJobId("workday", identifier, this.normalizeWorkdayJobId(job.jobPostingId || job.id || job.bulletFields?.[0] || null), job.externalPath, job.title, job.locationsText || job.location, job.postedOn),
      title: job.title,
      location: job.locationsText || job.location || null,
      remote: String(job.locationsText || "").toLowerCase().includes("remote"),
      employmentType: job.title?.toLowerCase().includes("intern") ? "internship" : "fulltime",
      description: this.stripHtml(job.bulletFields?.join(" ") || job.externalPath || job.title || ""),
      salaryMin: null,
      salaryMax: null,
      url: job.externalPath ? `https://${identifier}.wd1.myworkdayjobs.com${job.externalPath}` : "",
      jobNumber: job.bulletFields?.[0] || job.id || null,
      postedAt: job.postedOn ? new Date(job.postedOn) : null,
    })).filter((job: NormalizedJob) => job.url);
  }

  private async fetchSmartRecruiters(identifier: string): Promise<NormalizedJob[]> {
    const url = `https://api.smartrecruiters.com/v1/companies/${identifier}/postings`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`SmartRecruiters HTTP ${res.status} for ${identifier}`);
    const data = await res.json();
    return (data.content || []).map((p: any) => ({
      source: "smartrecruiters",
      company: identifier,
      jobId: this.stableJobId("smartrecruiters", identifier, p.id || null, `https://careers.smartrecruiters.com/${identifier}/${p.id}`, p.name, p.location?.city, p.releasedDate),
      title: p.name,
      location: p.location?.city || null,
      remote: p.workplace === "remotely",
      employmentType: p.typeOfEmployment?.id?.toLowerCase().includes("intern") ? "internship" : "fulltime",
      description: p.jobAd?.sections?.jobDescription?.text || "",
      salaryMin: null, salaryMax: null,
      url: `https://careers.smartrecruiters.com/${identifier}/${p.id}`,
      jobNumber: p.id || null,
      postedAt: p.releasedDate ? new Date(p.releasedDate) : null,
    }));
  }

  private async upsertJobs(
    jobs: NormalizedJob[],
    companyId: string,
    studentProfile?: any,
    studentRecord?: any,
    userId?: string,
  ): Promise<{ total: number; newCount: number }> {
    if (jobs.length === 0) return { total: 0, newCount: 0 };
    let newCount = 0;
    let sectionsExtracted = 0;
    let sectionsNotExtracted = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    const syncedJobIds: string[] = [];
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        `SELECT source, company, job_id, title, description, embedding::text FROM jobs WHERE company_id = $1`,
        [companyId]
      );
      const existingMap = new Map(existingRes.rows.map(r => [this.jobIdentityKey(r.source, r.company, r.job_id), r]));

      for (const job of jobs) {
        if (!job.source || !job.company || !job.jobId) continue;

        // Run Job Relevance & Experience Validation
        const evaluation = await JobRelevanceValidator.evaluateJob(
          {
            title: job.title,
            description: job.description,
            company: job.company,
            location: job.location,
            category: job.employmentType,
          },
          { allowLlmFallback: true },
        );

        if (evaluation.hasStructuredSections) {
          sectionsExtracted++;
        } else {
          sectionsNotExtracted++;
        }

        if (evaluation.status === "APPROVED") {
          approvedCount++;
        } else {
          rejectedCount++;
        }

        console.log(evaluation.logSummary);

        const logicalKey = LogicalJobKey.generate(
          companyId,
          job.title,
          job.location,
          job.employmentType,
        );

        const existingJob = existingMap.get(this.jobIdentityKey(job.source, job.company, job.jobId));
        let embeddingParam: string | null = null;

        // Only compute Gemini vector embeddings for APPROVED jobs to save latency & quota
        if (evaluation.status === "APPROVED") {
          if (
            existingJob &&
            existingJob.embedding &&
            existingJob.title === job.title &&
            existingJob.description === job.description
          ) {
            embeddingParam = existingJob.embedding;
          } else {
            const embedding = await this.generateEmbedding(`${job.title}\n${job.location || ""}\n${job.description}`);
            embeddingParam = embedding ? `[${embedding.join(",")}]` : null;
          }
        }

        const res = await client.query(
          `INSERT INTO jobs (
             company_id, source, company, job_id, title, location, remote,
             employment_type, description, salary_min, salary_max, url,
             job_number, posted_at, embedding, relevance_status,
             rejection_reason, logical_job_key, last_synced
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::vector,$16,$17,$18,NOW())
           ON CONFLICT (source, company, job_id) DO UPDATE SET
             company_id=EXCLUDED.company_id,
             title=EXCLUDED.title, description=EXCLUDED.description, location=EXCLUDED.location,
             remote=EXCLUDED.remote, employment_type=EXCLUDED.employment_type,
             salary_min=EXCLUDED.salary_min, salary_max=EXCLUDED.salary_max,
             url=EXCLUDED.url,
             job_number=EXCLUDED.job_number,
             embedding=COALESCE(EXCLUDED.embedding, jobs.embedding),
             relevance_status=EXCLUDED.relevance_status,
             rejection_reason=EXCLUDED.rejection_reason,
             logical_job_key=EXCLUDED.logical_job_key,
             last_synced=NOW()
           RETURNING id, (xmax = 0) AS is_new`,
          [
            companyId,
            job.source,
            job.company,
            job.jobId,
            job.title,
            job.location,
            job.remote,
            job.employmentType,
            job.description,
            job.salaryMin,
            job.salaryMax,
            job.url,
            job.jobNumber,
            job.postedAt,
            embeddingParam,
            evaluation.status,
            evaluation.rejectionReason,
            logicalKey,
          ]
        );
        const jobId = res.rows[0]?.id;
        const isNew = res.rows[0]?.is_new;
        if (jobId && evaluation.status === "APPROVED") {
          syncedJobIds.push(jobId);
        }
        if (isNew) {
          newCount++;
        }
      }
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }

    const totalProcessed = sectionsExtracted + sectionsNotExtracted;
    const contextRate = totalProcessed > 0 ? (sectionsExtracted / totalProcessed) : 1.0;
    console.log(`[Sync Metrics] Processed: ${jobs.length} | Approved: ${approvedCount} | Rejected: ${rejectedCount} | Context Extraction Rate: ${(contextRate * 100).toFixed(1)}%`);

    if (contextRate < 0.80 && totalProcessed >= 5) {
      console.warn(`[Sync Metrics Alert] ⚠️ Context extraction rate below 80% (${(contextRate * 100).toFixed(1)}%) for company ${companyId}`);
    }

    // Match and score jobs after transaction commits (failure isolated)
    if (userId && syncedJobIds.length > 0) {
      console.log(`[Sync Auto-Match] Auto-scoring ${syncedJobIds.length} eligible approved jobs for user ${userId}...`);
      for (const jobId of syncedJobIds) {
        try {
          await this.jobsService.matchJobToProfile(jobId, userId, { fast: true });
        } catch (matchErr: any) {
          console.warn(`[Sync Auto-Match] Failed to score job ${jobId}:`, matchErr.message);
        }
      }
    }

    return { total: jobs.length, newCount };
  }

  private jobIdentityKey(source: string, company: string, jobId: string): string {
    return `${source}:${company}:${jobId}`;
  }

  private stableJobId(
    source: string,
    company: string,
    id: string | null | undefined,
    url: string | null | undefined,
    title: string | null | undefined,
    location: string | null | undefined,
    postedAt: string | number | Date | null | undefined,
  ): string {
    const normalizedId = source === "workday" ? this.normalizeWorkdayJobId(id) : String(id || "").trim();
    if (normalizedId) return normalizedId;

    const input = [
      company,
      String(title || "").trim().toLowerCase(),
      String(location || "").trim().toLowerCase(),
      postedAt ? new Date(postedAt).toISOString().slice(0, 10) : "",
      this.normalizedUrlPath(url),
    ].join("|");

    return `hash-${this.hashString(input)}`;
  }

  private normalizeWorkdayJobId(id: string | null | undefined): string {
    const raw = String(id || "").trim();
    if (!raw) return "";
    const reqMatch = raw.match(/\b(?:R|JR)[-_ ]?0*([0-9]+)\b/i);
    if (reqMatch) return reqMatch[1];
    const tailMatch = raw.match(/_((?:R|JR)[-_ ]?0*[0-9]+)$/i);
    if (tailMatch) return this.normalizeWorkdayJobId(tailMatch[1]);
    return raw;
  }

  private normalizedUrlPath(url: string | null | undefined): string {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
    } catch {
      return String(url).split("?")[0].replace(/\/$/, "");
    }
  }

  private hashString(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "models/gemini-embedding-2", content: { parts: [{ text: text.slice(0, 8000) }] }, outputDimensionality: 768 }), signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.embedding?.values || null;
    } catch { return null; }
  }

  private async logSync(companyId: string, status: string, jobsFound: number, jobsNew: number, durationMs: number, error?: string) {
    await this.pool.query(
      `INSERT INTO sync_logs (company_id, status, jobs_found, jobs_new, duration_ms, error) VALUES ($1,$2,$3,$4,$5,$6)`,
      [companyId, status, jobsFound, jobsNew, durationMs, error || null]
    );
  }

  private summarizeSyncResults(results: SyncResult[]): SyncSummary {
    return results.reduce<SyncSummary>(
      (summary, result) => {
        summary.processed++;
        if (result.status === "success") {
          summary.succeeded++;
        } else {
          summary.failed++;
        }
        summary.jobsFound += result.jobsFound || 0;
        summary.jobsNew += result.jobsNew || 0;
        return summary;
      },
      { processed: 0, succeeded: 0, failed: 0, jobsFound: 0, jobsNew: 0 },
    );
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
  }



  async getSyncLogs(limit = 50) {
    const res = await this.pool.query(
      `SELECT sl.*, c.name as company_name FROM sync_logs sl JOIN companies c ON sl.company_id = c.id ORDER BY sl.created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  private checkJobEligibility(
    job: NormalizedJob,
    studentProfile?: any,
    studentRecord?: any,
  ): { eligible: boolean; reason?: string } {
    const jobText = `${job.title} ${job.description}`.toLowerCase();

    // 1. Check Experience Limits
    const batchYear = studentRecord ? Number(studentRecord.batch_year) : null;
    const isStudent = batchYear && (batchYear >= 2025 && batchYear <= 2028);

    const patterns = [
      /(\d+)\s*\+?\s*(?:years|yrs|year)\b/i,
      /(\d+)\s*-\s*(\d+)\s*(?:years|yrs|year)\b/i,
      /minimum\s*(?:of\s*)?(\d+)\s*(?:years|yrs|year)\b/i,
      /required\s*(?:of\s*)?(\d+)\s*(?:years|yrs|year)\b/i,
    ];
    let requiredYears = 0;
    for (const pattern of patterns) {
      const match = jobText.match(pattern);
      if (match) {
        const years = parseInt(match[1], 10);
        if (!isNaN(years)) {
          requiredYears = years;
          break;
        }
      }
    }

    let candidateYears = 0;
    if (studentProfile && Array.isArray(studentProfile.experience)) {
      for (const exp of studentProfile.experience) {
        let years = Number(exp.years);
        if (isNaN(years) && exp.startYear) {
          const startMonth = Number(exp.startMonth) || 1;
          const startYear = Number(exp.startYear);
          const current = !!exp.current;
          const endYear = current ? new Date().getFullYear() : (Number(exp.endYear) || startYear);
          const endMonth = current ? (new Date().getMonth() + 1) : (Number(exp.endMonth) || startMonth);
          const months = (endYear - startYear) * 12 + (endMonth - startMonth);
          years = months > 0 ? Math.round((months / 12) * 100) / 100 : 0;
        }
        if (!isNaN(years) && years > 0) {
          candidateYears += years;
        }
      }
    }

    if (requiredYears > 0) {
      if (isStudent && requiredYears >= 2) {
        return { eligible: false, reason: `Requires ${requiredYears}+ years experience, but candidate is a graduating student.` };
      }
      if (candidateYears < requiredYears) {
        return { eligible: false, reason: `Requires ${requiredYears}+ years experience, but candidate has only ${candidateYears} year(s).` };
      }
    }

    // 2. Check Degree Mismatch
    const degrees: string[] = [];
    if (/\b(b\.?tech|b\.?e\.?\b|bachelor|b\.s\.)/i.test(jobText)) degrees.push("Bachelor's");
    if (/\b(m\.?tech|m\.?e\.?\b|master|m\.s\.)/i.test(jobText)) degrees.push("Master's");
    if (/\bmca\b/i.test(jobText)) degrees.push("MCA");
    if (/\b(ph\.?d|doctorate)/i.test(jobText)) degrees.push("PhD");

    if (degrees.length > 0 && studentProfile && Array.isArray(studentProfile.education) && studentProfile.education.length > 0) {
      const degreeMatched = studentProfile.education.some((edu: any) => {
        const deg = String(edu.degree || "").toLowerCase();
        return degrees.some((req) => {
          if (req === "Bachelor's") return /\b(b\.?tech|b\.?e\.?\b|bachelor|b\.s\.)/i.test(deg);
          if (req === "Master's") return /\b(m\.?tech|m\.?e\.?\b|master|m\.s\.)/i.test(deg);
          if (req === "MCA") return /\bmca\b/i.test(deg);
          if (req === "PhD") return /\b(ph\.?d|doctorate)/i.test(deg);
          return false;
        });
      });
      if (!degreeMatched) {
        return { eligible: false, reason: `Requires ${degrees.join(" or ")} degree, but candidate has: ${studentProfile.education.map((e: any) => e.degree).join(", ")}.` };
      }
    }

    // 3. Check Senior Title Constraint
    const lowerTitle = job.title.toLowerCase();
    const isSeniorTitle = /\b(senior|sr|lead|staff|principal|manager|architect|director|head|vp)\b/i.test(lowerTitle);
    if (isSeniorTitle && isStudent) {
      return { eligible: false, reason: "Senior role, unsuitable for graduating student profile." };
    }

    return { eligible: true };
  }
}
