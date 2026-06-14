import crypto from "crypto";
import { URL } from "url";
import stringSimilarity from "string-similarity";
import { pool } from "./db";

/**
 * 1. Validate URL: Regex format, HEAD request, and keyword scan.
 */
export async function validateUrl(urlStr: string): Promise<{
  success: boolean;
  error?: "invalid_url" | "load_failed";
  warning?: "not_careers_page";
  message?: string;
}> {
  // Step 1: Format check
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { success: false, error: "invalid_url", message: "Only HTTP and HTTPS protocols are allowed." };
    }
  } catch {
    return { success: false, error: "invalid_url", message: "Malformed URL format." };
  }

  // Step 2: Page load check (5s timeout HEAD request)
  let loaded = false;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    
    // Attempt HEAD request first
    let res = await fetch(urlStr, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    clearTimeout(id);

    // If HEAD is not supported, fall back to GET
    if (!res.ok && res.status !== 405) {
      const getController = new AbortController();
      const getId = setTimeout(() => getController.abort(), 5000);
      res = await fetch(urlStr, {
        method: "GET",
        signal: getController.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(getId);
    }

    if (res.ok) {
      loaded = true;
    }
  } catch (err) {
    // page load failed, but as per spec:
    // "Warning only — user can still save with confirmation"
  }

  if (!loaded) {
    return {
      success: true,
      error: "load_failed",
      message: "The page did not return a successful response (timeout or connection failed), but can be saved."
    };
  }

  // Step 3: Looks like a careers page check
  const pathAndHost = (parsedUrl.hostname + parsedUrl.pathname + parsedUrl.search).toLowerCase();
  const keywords = ["jobs", "careers", "openings", "vacancies", "apply", "hiring", "workday", "greenhouse", "lever", "recruiting", "talent"];
  const matchesKeyword = keywords.some(keyword => pathAndHost.includes(keyword));

  if (!matchesKeyword) {
    return {
      success: true,
      warning: "not_careers_page",
      message: "This URL doesn't look like a standard careers or openings page."
    };
  }

  return { success: true };
}

/**
 * 2. Check for duplicate URL under a different company.
 */
export async function checkDuplicateUrl(urlStr: string, excludeCompanyId?: string): Promise<{
  duplicate: boolean;
  existingCompany?: { id: string; name: string };
}> {
  try {
    // Normalize url
    const parsed = new URL(urlStr);
    const normalizedUrl = parsed.origin + parsed.pathname.replace(/\/$/, "");

    const query = excludeCompanyId
      ? `SELECT id, name, careers_url FROM companies WHERE id <> $1`
      : `SELECT id, name, careers_url FROM companies`;
    const params = excludeCompanyId ? [excludeCompanyId] : [];
    
    const res = await pool.query(query, params);
    
    for (const row of res.rows) {
      if (!row.careers_url) continue;
      try {
        const rowParsed = new URL(row.careers_url);
        const rowNormalized = rowParsed.origin + rowParsed.pathname.replace(/\/$/, "");
        if (rowNormalized === normalizedUrl) {
          return {
            duplicate: true,
            existingCompany: { id: row.id, name: row.name }
          };
        }
      } catch {
        // ignore malformed URLs in db
      }
    }
    return { duplicate: false };
  } catch {
    return { duplicate: false };
  }
}

function cleanCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|corporation|corp|co|limited|ltd|pvt)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 3. Fuzzy match company name against database.
 */
export async function fuzzyMatchCompany(name: string, excludeCompanyId?: string): Promise<{
  level: "conflict" | "warning" | "none";
  match?: { id: string; name: string; careersUrl?: string | null };
}> {
  try {
    const query = excludeCompanyId
      ? `SELECT id, name, careers_url FROM companies WHERE id <> $1`
      : `SELECT id, name, careers_url FROM companies`;
    const params = excludeCompanyId ? [excludeCompanyId] : [];
    
    const res = await pool.query(query, params);
    if (res.rows.length === 0) {
      return { level: "none" };
    }

    const cleanName = cleanCompanyName(name);
    let bestMatchRow = res.rows[0];
    let bestScore = 0;

    for (const row of res.rows) {
      const cleanRowName = cleanCompanyName(row.name);
      
      let score = stringSimilarity.compareTwoStrings(cleanName, cleanRowName);

      // Substring check boosts
      if (cleanName.includes(cleanRowName) || cleanRowName.includes(cleanName)) {
        const ratio = Math.min(cleanName.length, cleanRowName.length) / Math.max(cleanName.length, cleanRowName.length);
        if (ratio >= 0.8) {
          score = Math.max(score, 0.96); // Conflict (>= 0.95)
        } else if (ratio >= 0.5) {
          score = Math.max(score, 0.92); // Warning (0.90 - 0.94)
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatchRow = row;
      }
    }

    if (bestScore >= 0.95) {
      return {
        level: "conflict",
        match: { id: bestMatchRow.id, name: bestMatchRow.name, careersUrl: bestMatchRow.careers_url }
      };
    } else if (bestScore >= 0.90) {
      return {
        level: "warning",
        match: { id: bestMatchRow.id, name: bestMatchRow.name, careersUrl: bestMatchRow.careers_url }
      };
    }

    return { level: "none" };
  } catch (error) {
    console.error("Fuzzy matching error:", error);
    return { level: "none" };
  }
}

/**
 * 4. Detect region mismatches in the careers URL paths.
 */
export function detectRegionMismatch(urlStr: string, companyRegion: string): string | null {
  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname.toLowerCase();
    
    if (companyRegion === "IN") {
      // If region is India but URL contains other region directories
      if (
        (path.includes("/us") || path.includes("/uk") || path.includes("/ca") || path.includes("/de") || path.includes("/gb")) &&
        !path.includes("/in") && !path.includes("/india")
      ) {
        return "You provided a non-India careers URL for an India-targeted company.";
      }
    } else if (companyRegion === "US") {
      // If region is US but URL contains India directories
      if (
        (path.includes("/in") || path.includes("/india")) &&
        !path.includes("/us")
      ) {
        return "You provided an India-targeted careers URL for a US-targeted company.";
      }
    }
  } catch {}
  return null;
}

/**
 * 5. Detect if the URL is a single job listing rather than a general careers index page.
 */
export function detectSingleListingUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();

    // Specific domain-level segment checks
    if (parsed.hostname.includes("lever.co")) {
      const parts = path.split("/").filter(Boolean);
      // General Lever board has exactly 1 segment after hostname, e.g. /lever
      if (parts.length > 1) {
        return true;
      }
    }

    // Requisition patterns (e.g., jobs/12345, details/abc-123)
    const singleJobPatterns = [
      /\/jobs?\/(?:results\/)?\d+/, // e.g. /jobs/results/12345
      /\/jobs?\/[a-z0-9\-]+\/\d+/, // e.g. /jobs/software-engineering-intern/123
      /\/details\/\d+/, // e.g. /details/123
      /\/apply\//, // e.g. /apply/form
      /\/job-detail/, // e.g. /job-detail
      /\/job\/description/,
      /\/job-description/,
      /([a-f0-9\-]{36})/, // UUIDs in path
      /(\b[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}\b)/ // standard UUID regex
    ];

    if (singleJobPatterns.some(pattern => pattern.test(path))) {
      return true;
    }

    // Greenhouse and Lever single listing parameters
    if (query.includes("gh_jid=") || query.includes("jobid=")) {
      return true;
    }

    // Workday single job page
    if (path.includes("/job/") && path.split("/").filter(Boolean).length > 2) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 6. Generate deterministic SHA-256 dedupe key.
 */
export function generateDedupeKey(
  companyId: string,
  applyUrl: string | null,
  title: string,
  location: string | null,
  deadline: string | null
): string {
  const cleanRole = title.trim().toLowerCase();
  
  // Primary dedupe key if there is a unique apply URL
  if (applyUrl && applyUrl.trim().length > 0 && !isGeneralCareersUrl(applyUrl)) {
    const cleanApplyUrl = applyUrl.trim().toLowerCase();
    const data = `${companyId}:${cleanRole}:${cleanApplyUrl}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  } else {
    // Fallback dedupe key
    const cleanLocation = (location || "unknown").trim().toLowerCase();
    const cleanDeadline = (deadline || "nodeadline").trim().toLowerCase();
    const data = `${companyId}:${cleanRole}:${cleanLocation}:${cleanDeadline}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

/**
 * Helper to identify if a URL is likely a generic job index page rather than a job post.
 */
function isGeneralCareersUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    
    // If it has pagination or general searches
    if (query.includes("page=") || query.includes("search=") || path.endsWith("/jobs") || path.endsWith("/careers") || path.endsWith("/results")) {
      return true;
    }
  } catch {}
  return false;
}
