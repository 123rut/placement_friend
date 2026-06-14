import crypto from "crypto";
import { URL, fileURLToPath } from "url";
import {
  getActiveCompanies,
  saveDrives,
  updateCompanyCareersUrl,
  flagCompany,
  incrementFailCount,
  incrementSilentFailCount,
  updateScrapeStats,
  updateLastChecked,
  CompanyDb
} from "./db";
import { findCareersUrl } from "./search";
import {
  validateUrl,
  checkDuplicateUrl,
  detectRegionMismatch,
  detectSingleListingUrl,
  generateDedupeKey
} from "./validator";
import {
  scrapePage,
  detectRedirect,
  detectLoginWall,
  detectATS,
  getAtsProviderFromUrl
} from "./scraper";
import { extractOpportunities, ScrapedOpportunity } from "./agent";
import { recordFailure, recordSuccess } from "./health";
import { acquireDomainSlot, releaseDomainSlot, getDomain, delayBetweenRequests } from "./rateLimiter";

// ATS Adapters
import * as greenhouse from "./ats/greenhouse";
import * as lever from "./ats/lever";
import * as workday from "./ats/workday";
import * as taleo from "./ats/taleo";
import * as smartrecruiters from "./ats/smartrecruiters";

import { matchStudentToOpportunity, StudentProfile, Opportunity } from "@piaa/domain";
import { pool } from "./db";

export type RunSummary = {
  companiesScraped: number;
  opportunitiesFound: number;
  opportunitiesInserted: number;
  atsDetected: Record<string, number>;
  failures: Array<{ companyId: string; reason: string }>;
  conflicts: Array<{ companyId: string; details: string }>;
};

export async function executePipeline(): Promise<RunSummary> {
  const summary: RunSummary = {
    companiesScraped: 0,
    opportunitiesFound: 0,
    opportunitiesInserted: 0,
    atsDetected: {},
    failures: [],
    conflicts: []
  };

  console.log("Starting Sprint 2 Scraper & AI Agent Pipeline...");

  // 1. Fetch active companies from DB (paginated)
  let page = 1;
  const limit = 50;
  const activeCompanies: CompanyDb[] = [];

  while (true) {
    const batch = await getActiveCompanies(page, limit);
    if (batch.length === 0) break;
    activeCompanies.push(...batch);
    page++;
  }

  console.log(`Fetched ${activeCompanies.length} active companies to process.`);

  for (const company of activeCompanies) {
    let careersUrl = company.careers_url;

    // 2. Discover missing URLs via DuckDuckGo
    if (!careersUrl || company.status === "url_missing") {
      console.log(`Company "${company.name}" has missing URL. Attempting auto-discovery...`);
      const discoveredUrl = await findCareersUrl(company.name);
      if (discoveredUrl) {
        console.log(`Discovered candidate URL for "${company.name}": ${discoveredUrl}`);
        // 3. Validate URL (3-step)
        const validation = await validateUrl(discoveredUrl);
        if (validation.success) {
          await updateCompanyCareersUrl(company.id, discoveredUrl);
          careersUrl = discoveredUrl;
          console.log(`Discovered URL validated and saved for "${company.name}".`);
        } else {
          console.warn(`Discovered URL failed validation for "${company.name}": ${validation.error || validation.warning}`);
          await flagCompany(company.id, "url_missing");
          summary.failures.push({ companyId: company.id, reason: "discovered_url_invalid" });
          continue;
        }
      } else {
        console.warn(`Auto-discovery failed for "${company.name}".`);
        await flagCompany(company.id, "url_missing");
        summary.failures.push({ companyId: company.id, reason: "url_missing" });
        continue;
      }
    }

    // Double check we have a careersUrl now
    if (!careersUrl) {
      continue;
    }

    // Skip requires_auth
    if (company.status === "requires_auth") {
      console.log(`Skipping "${company.name}" because it requires auth.`);
      continue;
    }

    console.log(`Processing "${company.name}" with URL: ${careersUrl}`);

    // Update last checked at start of run
    await updateLastChecked(company.id);

    // 5. Resolve redirects (up to depth 5)
    let finalUrl = careersUrl;
    let sameDomain = true;
    let isATS = false;
    let atsProvider: string | null = null;

    // Rate Limiting: Acquire Domain Slot
    const domain = getDomain(careersUrl);
    await acquireDomainSlot(domain);

    try {
      const redirectRes = await detectRedirect(careersUrl);
      finalUrl = redirectRes.finalUrl;
      sameDomain = redirectRes.sameDomain;
      isATS = redirectRes.isATS;
      atsProvider = redirectRes.atsProvider;

      if (!sameDomain) {
        if (isATS) {
          console.log(`Cross-domain redirect to ATS detected for "${company.name}": ${finalUrl}`);
          summary.conflicts.push({ companyId: company.id, details: `Redirected to ATS (${atsProvider})` });
        } else {
          console.log(`Cross-domain redirect to non-ATS detected for "${company.name}": ${finalUrl}`);
          summary.conflicts.push({ companyId: company.id, details: "Redirected to cross-domain non-ATS" });
        }
      } else if (careersUrl !== finalUrl) {
        // Auto-update URL if same domain redirect
        await updateCompanyCareersUrl(company.id, finalUrl);
        console.log(`Auto-updated same-domain redirect URL for "${company.name}" to: ${finalUrl}`);
      }

      // 6. Detect login wall or SSO page
      // Two-step page scrape (Cheerio -> Playwright)
      const { html, usedPlaywright } = await scrapePage(finalUrl);

      if (detectLoginWall(html)) {
        console.warn(`Login wall or SSO detected for "${company.name}". Flagging as requires_auth.`);
        await flagCompany(company.id, "requires_auth");
        await recordFailure(company.id, "login_wall");
        summary.failures.push({ companyId: company.id, reason: "login_wall" });
        continue;
      }

      // 7. Detect ATS provider (if not already found by URL)
      if (!atsProvider) {
        atsProvider = detectATS(html, finalUrl);
      }

      let scrapedJobs: ScrapedOpportunity[] = [];

      // 8. Extraction logic: Level 1 ATS vs Level 3 AIFallback
      if (atsProvider) {
        console.log(`ATS detected: ${atsProvider} for "${company.name}". Routing to adapter...`);
        summary.atsDetected[atsProvider] = (summary.atsDetected[atsProvider] || 0) + 1;

        if (atsProvider === "greenhouse") {
          scrapedJobs = await greenhouse.extractJobs(finalUrl);
        } else if (atsProvider === "lever") {
          scrapedJobs = await lever.extractJobs(finalUrl);
        } else if (atsProvider === "workday") {
          scrapedJobs = await workday.extractJobs(finalUrl);
        } else if (atsProvider === "taleo") {
          scrapedJobs = await taleo.extractJobs(finalUrl);
        } else if (atsProvider === "smartrecruiters") {
          scrapedJobs = await smartrecruiters.extractJobs(finalUrl);
        }
      } else {
        console.log(`No ATS detected for "${company.name}". Using fallback AI/regex extraction...`);
        scrapedJobs = await extractOpportunities(html, company.id);
      }

      summary.companiesScraped++;
      summary.opportunitiesFound += scrapedJobs.length;

      // 9. Deduplicate & Save Drives
      if (scrapedJobs.length > 0) {
        const drivesToSave = scrapedJobs.map((job) => {
          const dedupeKey = generateDedupeKey(company.id, job.applyUrl, job.role, null, job.deadline);
          return {
            id: crypto.randomUUID(),
            company_id: company.id,
            role: job.role,
            type: job.role.toLowerCase().includes("intern") ? "internship" : "full-time",
            eligibility_branches: job.eligibility,
            min_cgpa: null,
            apply_link: job.applyUrl,
            drive_date: null,
            deadline: job.deadline ? new Date(job.deadline) : null,
            dedupe_key: dedupeKey
          };
        });

        const newSavedCount = await saveDrives(drivesToSave);
        summary.opportunitiesInserted += newSavedCount;
        console.log(`Extracted ${scrapedJobs.length} opportunities for "${company.name}" (${newSavedCount} new saved).`);

        // 10. Update health metrics (success)
        await recordSuccess(company.id, scrapedJobs.length);
      } else {
        // Handle silent failure
        console.warn(`Scraped 0 opportunities for "${company.name}". Incrementing silent failure count.`);
        await incrementSilentFailCount(company.id);
        await updateScrapeStats(company.id, 0);
        summary.failures.push({ companyId: company.id, reason: "silent_failure" });
      }

    } catch (err: any) {
      console.error(`Error processing company "${company.name}":`, err.message || err);
      const reason = err.message === "redirect_loop" ? "redirect_loop" : "scraping_failure";
      await recordFailure(company.id, reason);
      summary.failures.push({ companyId: company.id, reason });
    } finally {
      releaseDomainSlot(domain);
    }

    // Rate Limiting: Delay between requests
    await delayBetweenRequests();
  }

  // 11. Eligibility matching & summary report
  await runEligibilityMatching();

  return summary;
}

async function runEligibilityMatching(): Promise<void> {
  console.log("\nRunning Student Eligibility Matching...");
  
  // Fetch students, colleges, targets, and recent drives
  const studentsRes = await pool.query(
    `SELECT s.*, c.name as college_name 
     FROM students s 
     JOIN colleges c ON s.college_id = c.id`
  );
  
  const targetsRes = await pool.query(`SELECT * FROM student_company_targets`);
  const drivesRes = await pool.query(`SELECT * FROM drives ORDER BY scraped_at DESC LIMIT 100`);

  const targetsMap = new Map<string, string[]>();
  for (const row of targetsRes.rows) {
    const list = targetsMap.get(row.student_id) || [];
    list.push(row.company_id);
    targetsMap.set(row.student_id, list);
  }

  const studentProfiles: StudentProfile[] = studentsRes.rows.map(row => ({
    id: row.id,
    fullName: row.full_name,
    email: row.college_email,
    collegeId: row.college_id,
    collegeName: row.college_name,
    branch: row.branch,
    cgpa: parseFloat(row.cgpa),
    batchYear: row.batch_year,
    isVerified: row.is_verified,
    trackedCompanyIds: targetsMap.get(row.id) || []
  }));

  const opportunities: Opportunity[] = drivesRes.rows.map(row => ({
    id: row.id,
    companyId: row.company_id,
    title: row.role,
    roleType: row.type === "internship" ? "internship" : "full-time",
    location: "Bengaluru",
    description: "",
    applicationUrl: row.apply_link,
    sourceUrl: row.apply_link,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    minCgpa: row.min_cgpa ? parseFloat(row.min_cgpa) : null,
    allowedBranches: row.eligibility_branches ? row.eligibility_branches.split(",").map((b: string) => b.trim()) : [],
    allowedBatchYears: [],
    postedAt: row.scraped_at.toISOString()
  }));

  console.log(`Matching ${studentProfiles.length} students with ${opportunities.length} recent opportunities.`);

  let matchesCount = 0;
  for (const student of studentProfiles) {
    for (const opp of opportunities) {
      const match = matchStudentToOpportunity(student, opp);
      if (match.qualifies) {
        matchesCount++;
        console.log(`[ELIGIBLE] Student: ${student.fullName} (${student.collegeName}) qualifies for "${opp.title}" at "${opp.companyId}"`);
      }
    }
  }

  console.log(`Matched ${matchesCount} student-opportunity targets.`);
}

// Execute the pipeline if run directly
if (import.meta.url.startsWith("file:")) {
  const modulePath = fileURLToPath(import.meta.url);
  const processPath = process.argv[1];
  
  if (processPath && (modulePath === processPath || processPath.endsWith("index.ts"))) {
    executePipeline()
      .then((summary) => {
        console.log("\n==========================================");
        console.log("PIPELINE EXECUTION SUMMARY");
        console.log("==========================================");
        console.log(`Companies Scraped:           ${summary.companiesScraped}`);
        console.log(`Total Opportunities Found:   ${summary.opportunitiesFound}`);
        console.log(`New Opportunities Saved:     ${summary.opportunitiesInserted}`);
        console.log(`ATS Providers Detected:      `, summary.atsDetected);
        console.log(`Failures Flagged:            ${summary.failures.length}`);
        console.log(`Conflicts/Redirects:         ${summary.conflicts.length}`);
        console.log("==========================================");
        pool.end();
      })
      .catch((err) => {
        console.error("Pipeline crashed:", err);
        pool.end();
        process.exit(1);
      });
  }
}
