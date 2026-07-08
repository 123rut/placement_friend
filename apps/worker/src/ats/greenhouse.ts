import { URL } from "url";
import { ScrapedOpportunity } from "../agent";
import { guessEligibilityFromRole } from "../validator";
import { fetchWithTimeout } from "../fetchWithTimeout";

const DOMAIN_TO_BOARD_TOKEN: Record<string, string> = {
  "atlassian.com": "atlassian",
  "gojek.io": "gojek",
  "swiggy.com": "swiggy",
  "cred.club": "cred",
  "meesho.io": "meesho"
};

export function detectProvider(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    if (host.includes("greenhouse.io")) return true;
    for (const domain of Object.keys(DOMAIN_TO_BOARD_TOKEN)) {
      if (host === domain || host.endsWith("." + domain)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export async function extractJobs(urlStr: string): Promise<ScrapedOpportunity[]> {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    let boardToken = "";

    // 1. Check custom domains map
    for (const [domain, token] of Object.entries(DOMAIN_TO_BOARD_TOKEN)) {
      if (host === domain || host.endsWith("." + domain)) {
        boardToken = token;
        break;
      }
    }

    // 2. Extract board token from path (e.g., /google) or query param if not in map
    if (!boardToken) {
      if (parsed.pathname.startsWith("/embed/")) {
        boardToken = parsed.searchParams.get("board_token") || "";
      } else {
        const parts = parsed.pathname.split("/").filter(Boolean);
        boardToken = parts[0] || "";
      }
    }

    if (!boardToken) {
      console.warn("Could not extract Greenhouse board token from:", urlStr);
      return [];
    }

    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;
    const response = await fetchWithTimeout(apiUrl, { timeout: 10000 });

    if (!response.ok) {
      console.warn(`Greenhouse API returned HTTP ${response.status} for board ${boardToken}`);
      return [];
    }

    const data = await response.json();
    const jobs = data.jobs || [];

    return jobs.map((job: any) => ({
      role: job.title,
      eligibility: guessEligibilityFromRole(job.title).branches.join(", "),
      deadline: null,
      applyUrl: job.absolute_url
    }));
  } catch (error) {
    console.error("Error extracting jobs from Greenhouse:", error);
    return [];
  }
}

