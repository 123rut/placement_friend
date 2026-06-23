import { URL } from "url";
import * as cheerio from "cheerio";
import { ScrapedOpportunity } from "../agent";
import { guessEligibilityFromRole } from "../validator";

export function detectProvider(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host.includes("taleo.net");
  } catch {
    return false;
  }
}

export async function extractJobs(urlStr: string): Promise<ScrapedOpportunity[]> {
  try {
    const response = await fetch(urlStr, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      console.warn(`Taleo page fetch returned HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: ScrapedOpportunity[] = [];
    const visited = new Set<string>();

    // Parse links pointing to job details (e.g. jobdetail.ftl)
    $("a").each((_, element) => {
      const href = $(element).attr("href");
      const text = $(element).text().trim();

      if (href && (href.includes("jobdetail.ftl") || href.includes("req="))) {
        let applyUrl = href;
        if (href.startsWith("/")) {
          const parsed = new URL(urlStr);
          applyUrl = `${parsed.origin}${href}`;
        }

        if (visited.has(applyUrl)) return;
        visited.add(applyUrl);

        if (text && text.length > 5) {
          jobs.push({
            role: text,
            eligibility: guessEligibilityFromRole(text).branches.join(", "),
            deadline: null,
            applyUrl
          });
        }
      }
    });

    return jobs;
  } catch (error) {
    console.error("Error extracting jobs from Taleo:", error);
    return [];
  }
}

