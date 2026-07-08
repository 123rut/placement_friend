import stringSimilarity from "string-similarity";

export interface DatabaseClient {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

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
    // page load failed
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
export async function checkDuplicateUrl(
  db: DatabaseClient,
  urlStr: string,
  excludeCompanyId?: string
): Promise<{
  duplicate: boolean;
  existingCompany?: { id: string; name: string };
}> {
  try {
    const parsed = new URL(urlStr);
    const normalizedUrl = parsed.origin + parsed.pathname.replace(/\/$/, "");

    const query = excludeCompanyId
      ? `SELECT id, name, careers_url FROM companies WHERE id <> $1`
      : `SELECT id, name, careers_url FROM companies`;
    const params = excludeCompanyId ? [excludeCompanyId] : [];
    
    const res = await db.query(query, params);
    
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
export async function fuzzyMatchCompany(
  db: DatabaseClient,
  name: string,
  excludeCompanyId?: string
): Promise<{
  level: "conflict" | "warning" | "none";
  match?: { id: string; name: string; careersUrl?: string | null };
}> {
  try {
    const query = excludeCompanyId
      ? `SELECT id, name, careers_url FROM companies WHERE id <> $1`
      : `SELECT id, name, careers_url FROM companies`;
    const params = excludeCompanyId ? [excludeCompanyId] : [];
    
    const res = await db.query(query, params);
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
      if (
        (path.includes("/us") || path.includes("/uk") || path.includes("/ca") || path.includes("/de") || path.includes("/gb")) &&
        !path.includes("/in") && !path.includes("/india")
      ) {
        return "You provided a non-India careers URL for an India-targeted company.";
      }
    } else if (companyRegion === "US") {
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

    if (parsed.hostname.includes("lever.co")) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length > 1) {
        return true;
      }
    }

    const singleJobPatterns = [
      /\/jobs?\/(?:results\/)?\d+/,
      /\/jobs?\/[a-z0-9\-]+\/\d+/,
      /\/details\/\d+/,
      /\/apply\//,
      /\/job-detail/,
      /\/job\/description/,
      /\/job-description/,
      /([a-f0-9\-]{36})/,
      /(\b[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}\b)/
    ];

    if (singleJobPatterns.some(pattern => pattern.test(path))) {
      return true;
    }

    if (query.includes("gh_jid=") || query.includes("jobid=")) {
      return true;
    }

    if (path.includes("/job/") && path.split("/").filter(Boolean).length > 2) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 10000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Checks if a hostname matches supported ATS provider domains.
 */
export function getAtsProviderFromUrl(urlStr: string): string | null {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    if (host.includes("greenhouse.io") || host.includes("boards.greenhouse")) return "greenhouse";
    if (host.includes("lever.co") || host.includes("jobs.lever")) return "lever";
    if (host.includes("myworkdayjobs.com")) return "workday";
    if (host.includes("taleo.net")) return "taleo";
    if (host.includes("smartrecruiters.com")) return "smartrecruiters";
    if (host.includes("amazon.jobs")) return "amazon";

    // Custom Greenhouse domains
    const customGreenhouseDomains = ["atlassian.com", "gojek.io", "swiggy.com", "cred.club", "meesho.io"];
    if (customGreenhouseDomains.some(domain => host === domain || host.endsWith("." + domain))) {
      return "greenhouse";
    }
  } catch {}
  return null;
}

/**
 * Resolves redirects up to a depth of 5 and classifies them.
 */
export async function detectRedirect(urlStr: string): Promise<{
  originalUrl: string;
  finalUrl: string;
  sameDomain: boolean;
  crossDomain: boolean;
  isATS: boolean;
  atsProvider: string | null;
}> {
  let currentUrl = urlStr;
  let redirectDepth = 0;
  const maxDepth = 5;
  const visited = new Set<string>();

  while (redirectDepth < maxDepth) {
    visited.add(currentUrl);
    try {
      const response = await fetchWithTimeout(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (location) {
          const resolvedLoc = new URL(location, currentUrl).toString();
          if (visited.has(resolvedLoc)) {
            throw new Error("redirect_loop");
          }
          currentUrl = resolvedLoc;
          redirectDepth++;
          continue;
        }
      }
      break;
    } catch (err: any) {
      if (err.message === "redirect_loop") {
        throw err;
      }
      break;
    }
  }

  const origHost = new URL(urlStr).hostname.toLowerCase();
  const finalHost = new URL(currentUrl).hostname.toLowerCase();
  const sameDomain = origHost === finalHost || finalHost.endsWith("." + origHost) || origHost.endsWith("." + finalHost);

  const atsProvider = getAtsProviderFromUrl(currentUrl);
  const isATS = atsProvider !== null;

  return {
    originalUrl: urlStr,
    finalUrl: currentUrl,
    sameDomain,
    crossDomain: !sameDomain,
    isATS,
    atsProvider
  };
}
