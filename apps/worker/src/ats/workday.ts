import { URL } from "url";
import { ScrapedOpportunity } from "../agent";
import { guessEligibilityFromRole } from "../validator";
import { fetchWithTimeout } from "../fetchWithTimeout";

interface WorkdayConfig {
  host: string;
  tenant: string;
  slug: string;
}

const KNOWN_LOCALE_SEGMENTS = new Set(["en-us", "en-gb", "en", "en-in", "en-ca", "en-au"]);

export function detectProvider(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host.includes("myworkdayjobs.com");
  } catch {
    return false;
  }
}

/**
 * Discovers the real Workday host/tenant/slug by scanning scraped page HTML
 * for embedded myworkdayjobs.com URLs (iframes, script tags, anchor hrefs).
 */
function discoverWorkdayConfig(html: string): WorkdayConfig | null {
  // Matches: https://companyname.wd1.myworkdayjobs.com/External
  const match = html.match(
    /https?:\/\/([a-zA-Z0-9_-]+)\.(wd\d+)\.myworkdayjobs\.com\/([a-zA-Z0-9_-]+)/,
  );
  if (!match) return null;
  return {
    host: `${match[1]}.${match[2]}.myworkdayjobs.com`,
    tenant: match[1],
    slug: match[3],
  };
}

/**
 * Infers Workday config directly from a myworkdayjobs.com URL.
 */
function inferFromUrl(urlStr: string): WorkdayConfig | null {
  try {
    const parsed = new URL(urlStr);
    if (!parsed.hostname.includes("myworkdayjobs.com")) return null;
    const host = parsed.hostname;
    const subdomain = host.replace(".myworkdayjobs.com", "");
    const tenant = subdomain.split(".")[0];
    const parts = parsed.pathname.split("/").filter(Boolean);
    let slug = "External";

    for (const part of parts) {
      if (!KNOWN_LOCALE_SEGMENTS.has(part.toLowerCase())) {
        slug = part;
        break;
      }
    }

    return { host, tenant, slug };
  } catch {
    return null;
  }
}

/**
 * Last-resort: guess tenant from the company's custom-domain URL hostname.
 * e.g. browserstack.com -> tenant "browserstack".
 *
 * Real Workday tenants are spread across wd1-wd5 and often use "External"
 * rather than "careers", so try several candidates in order.
 */
function inferHostnameCandidates(urlStr: string): WorkdayConfig[] {
  try {
    const parsed = new URL(urlStr);
    const hostParts = parsed.hostname.replace("www.", "").split(".");
    const tenant = hostParts[0];
    if (!tenant) return [];

    const wdHosts = ["wd1", "wd2", "wd3", "wd5"];
    const slugs = ["External", "careers"];
    const candidates: WorkdayConfig[] = [];

    for (const wd of wdHosts) {
      for (const slug of slugs) {
        candidates.push({ host: `${tenant}.${wd}.myworkdayjobs.com`, tenant, slug });
      }
    }

    return candidates;
  } catch {
    return [];
  }
}

async function tryFetchJobs(config: WorkdayConfig): Promise<ScrapedOpportunity[] | null> {
  const { host, tenant, slug } = config;
  const apiUrl = `https://${host}/wday/cxs/${tenant}/${slug}/jobs`;

  try {
    const response = await fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 50,
        offset: 0,
        searchText: "",
      }),
      timeout: 10000,
    });

    if (!response.ok) {
      console.warn(`[Workday] API returned HTTP ${response.status} for URL: ${apiUrl}`);
      return null;
    }

    const data = await response.json();
    const postings = data.jobPostings || [];

    return postings.map((posting: any) => {
      const externalPath = posting.externalPath || "";
      const cleanPath = externalPath.startsWith("/") ? externalPath : `/${externalPath}`;
      const applyUrl = `https://${host}${cleanPath}`;
      return {
        role: posting.title,
        eligibility: guessEligibilityFromRole(posting.title).branches.join(", "),
        deadline: null,
        applyUrl,
      };
    });
  } catch (error) {
    console.warn(`[Workday] Request failed for ${apiUrl}:`, error);
    return null;
  }
}

export async function extractJobs(urlStr: string, pageHtml?: string): Promise<ScrapedOpportunity[]> {
  try {
    let config: WorkdayConfig | null = null;

    // Step 1: URL is already a myworkdayjobs.com URL; use it directly.
    if (urlStr.includes("myworkdayjobs.com")) {
      config = inferFromUrl(urlStr);
    }

    // Step 2: HTML contains a myworkdayjobs.com link; discover from page.
    if (!config && pageHtml) {
      config = discoverWorkdayConfig(pageHtml);
      if (config) {
        console.log(`[Workday] Discovered tenant from HTML: ${config.host}/${config.slug}`);
      }
    }

    if (config) {
      const result = await tryFetchJobs(config);
      if (result) return result;
    }

    // Step 3: Last-resort hostname guess. Low confidence, so try variants.
    const candidates = inferHostnameCandidates(urlStr);
    for (const candidate of candidates) {
      const result = await tryFetchJobs(candidate);
      if (result) {
        console.log(`[Workday] Hostname guess succeeded: ${candidate.host}/${candidate.slug}`);
        return result;
      }
    }

    // Step 4: Nothing worked; skip.
    console.warn(`[Workday] tenant_not_found for: ${urlStr}`);
    return [];
  } catch (error) {
    console.error("Error extracting jobs from Workday:", error);
    return [];
  }
}
