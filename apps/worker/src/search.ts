import * as cheerio from "cheerio";
import { URL } from "url";
import { fetchWithTimeout } from "./fetchWithTimeout";

/**
 * Discovers a candidate careers page URL for a company via DuckDuckGo HTML search.
 * Returns the best candidate URL or null.
 */
export async function findCareersUrl(companyName: string): Promise<string | null> {
  try {
    const query = `${companyName} careers`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetchWithTimeout(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.warn(`DuckDuckGo search returned HTTP ${response.status} for ${companyName}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const links: string[] = [];

    // DuckDuckGo HTML results use class "result__a" inside "result__title"
    $(".result__a").each((_, element) => {
      const href = $(element).attr("href");
      if (href) {
        links.push(href);
      }
    });

    // Check snippets and titles for candidate URLs
    for (const rawUrl of links) {
      let resolvedUrl = rawUrl;

      // Extract resolved url from DuckDuckGo redirect link /l/?uddg=...
      if (rawUrl.includes("uddg=")) {
        try {
          const parsed = new URL("https://html.duckduckgo.com" + rawUrl);
          const uddg = parsed.searchParams.get("uddg");
          if (uddg) {
            resolvedUrl = decodeURIComponent(uddg);
          }
        } catch {
          // Fallback to rawUrl
        }
      }

      const lowerUrl = resolvedUrl.toLowerCase();
      // Skip duckduckgo internal URLs
      if (lowerUrl.includes("duckduckgo.com")) {
        continue;
      }

      // Prioritize pages with career keywords
      if (
        lowerUrl.includes("careers") ||
        lowerUrl.includes("jobs") ||
        lowerUrl.includes("careers-page") ||
        lowerUrl.includes("opportunities") ||
        lowerUrl.includes("hiring") ||
        lowerUrl.includes("openings") ||
        lowerUrl.includes("workday") ||
        lowerUrl.includes("greenhouse.io") ||
        lowerUrl.includes("lever.co")
      ) {
        return resolvedUrl;
      }
    }

    // Fallback: return the first non-duckduckgo search result URL
    for (const rawUrl of links) {
      let resolvedUrl = rawUrl;
      if (rawUrl.includes("uddg=")) {
        try {
          const parsed = new URL("https://html.duckduckgo.com" + rawUrl);
          const uddg = parsed.searchParams.get("uddg");
          if (uddg) {
            resolvedUrl = decodeURIComponent(uddg);
          }
        } catch {}
      }

      if (!resolvedUrl.toLowerCase().includes("duckduckgo.com")) {
        return resolvedUrl;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error in findCareersUrl for ${companyName}:`, error);
    return null;
  }
}
