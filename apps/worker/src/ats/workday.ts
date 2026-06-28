import { URL } from "url";
import { ScrapedOpportunity } from "../agent";
import { guessEligibilityFromRole } from "../validator";
import { fetchWithTimeout } from "../fetchWithTimeout";

interface WorkdayConfig {
  host: string;
  tenant: string;
  slug: string;
}

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
    /https?:\/\/([a-zA-Z0-9_-]+)\.(wd\d+)\.myworkdayjobs\.com\/([a-zA-Z0-9_-]+)/
  );
  if (!match) return null;
  return {
    host: `${match[1]}.${match[2]}.myworkdayjobs.com`,
    tenant: match[1],
    slug: match[3]
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
      if (part !== "en-US" && part !== "en-GB" && part !== "en" && part.length > 3) {
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
 * e.g. browserstack.com → tenant "browserstack".
 */
function inferFromHostname(urlStr: string): WorkdayConfig | null {
  try {
    const parsed = new URL(urlStr);
    // Take the second-level domain segment as the tenant guess
    const hostParts = parsed.hostname.replace("www.", "").split(".");
    const tenant = hostParts[0];
    if (!tenant) return null;
    return {
      host: `${tenant}.wd1.myworkdayjobs.com`,
      tenant,
      slug: "careers"
    };
  } catch {
    return null;
  }
}

export async function extractJobs(urlStr: string, pageHtml?: string): Promise<ScrapedOpportunity[]> {
  try {
    let config: WorkdayConfig | null = null;

    // Step 1: URL is already a myworkdayjobs.com URL — use it directly
    if (urlStr.includes("myworkdayjobs.com")) {
      config = inferFromUrl(urlStr);
    }

    // Step 2: HTML contains a myworkdayjobs.com link — discover from page
    if (!config && pageHtml) {
      config = discoverWorkdayConfig(pageHtml);
      if (config) {
        console.log(`[Workday] Discovered tenant from HTML: ${config.host}/${config.slug}`);
      }
    }

    // Step 3: Fall back to hostname-based guess (last resort)
    if (!config) {
      config = inferFromHostname(urlStr);
    }

    // Step 4: Nothing worked — skip
    if (!config) {
      console.warn(`[Workday] tenant_not_found for: ${urlStr}`);
      return [];
    }

    const { host, tenant, slug } = config;
    const apiUrl = `https://${host}/wday/cxs/${tenant}/${slug}/jobs`;

    const response = await fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 50,
        offset: 0,
        searchText: ""
      }),
      timeout: 10000
    });

    if (!response.ok) {
      console.warn(`[Workday] API returned HTTP ${response.status} for URL: ${apiUrl}`);
      return [];
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
        applyUrl
      };
    });
  } catch (error) {
    console.error("Error extracting jobs from Workday:", error);
    return [];
  }
}
