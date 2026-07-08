import { URL, fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { fetchWithTimeout } from "./fetchWithTimeout";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

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
 * Identifies the ATS provider from URL patterns or meta tags/script keywords.
 */
export function detectATS(html: string, urlStr: string): string | null {
  const urlProvider = getAtsProviderFromUrl(urlStr);
  if (urlProvider) return urlProvider;

  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes("boards.greenhouse.io")) return "greenhouse";
  if (lowerHtml.includes("jobs.lever.co")) return "lever";
  if (lowerHtml.includes("myworkdayjobs.com") || lowerHtml.includes("workday")) return "workday";
  if (lowerHtml.includes("taleo.net") || lowerHtml.includes("taleo")) return "taleo";
  if (lowerHtml.includes("smartrecruiters.com")) return "smartrecruiters";
  if (lowerHtml.includes("amazon.jobs")) return "amazon";

  return null;
}

/**
 * Detects if the HTML is a login wall or SSO page.
 */
export function detectLoginWall(html: string): boolean {
  const lowerHtml = html.toLowerCase();

  // 1. Password input
  if (lowerHtml.includes('type="password"') || lowerHtml.includes("type='password'")) {
    return true;
  }

  // 2. Title matching
  const titleRegex = /<title[^>]*>([^<]+)<\/title>/i;
  const match = html.match(titleRegex);
  if (match) {
    const title = match[1].toLowerCase();
    if (title.includes("login") || title.includes("sign in") || title.includes("sso") || title.includes("okta") || title.includes("auth")) {
      return true;
    }
  }

  // 3. SSO Provider and login form keywords
  const loginKeywords = [
    "okta",
    "auth0",
    "onelogin",
    "azure ad",
    "azuread",
    "saml 2.0",
    "ping identity",
    "shibboleth",
    "login to continue",
    "sign in with",
    "wp-login",
    "member portal"
  ];

  return loginKeywords.some(keyword => lowerHtml.includes(keyword));
}

/**
 * Two-step scrape: Cheerio static HTTP fetch first, then fallback to Playwright if empty/needs JS.
 */
export async function scrapePage(urlStr: string): Promise<{
  html: string;
  markdown?: string;
  usedPlaywright: boolean;
}> {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlApiKey) {
    try {
      console.log(`Using Firecrawl to scrape URL: ${urlStr}`);
      const response = await fetchWithTimeout("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: urlStr,
          formats: ["html", "markdown"]
        }),
        timeout: 20000
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return {
            html: result.data.html || "",
            markdown: result.data.markdown || "",
            usedPlaywright: false
          };
        }
        console.warn(`Firecrawl response reported failure: ${JSON.stringify(result)}`);
      } else {
        console.warn(`Firecrawl API returned HTTP ${response.status} for URL: ${urlStr}`);
      }
    } catch (error) {
      console.error("Error scraping page using Firecrawl:", error);
    }
    console.log("Falling back to local scrape...");
  }
  let cheerioHtml = "";
  let success = false;

  try {
    const response = await fetchWithTimeout(urlStr, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      timeout: 10000
    });
    if (response.ok) {
      cheerioHtml = await response.text();
      success = true;
    }
  } catch {
    // fast Cheerio fetch failed
  }

  // Determine if static HTML requires JS or is mostly empty
  const isJSRendered = (html: string) => {
    if (!html || html.trim().length < 500) return true;
    const lower = html.toLowerCase();
    if (lower.includes("javascript is required") || lower.includes("enable javascript")) return true;
    
    // Check if body content contains meaningful text
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const bodyText = bodyMatch[1].replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "").trim();
      if (bodyText.length < 100) return true;
    }
    return false;
  };

  if (success && !isJSRendered(cheerioHtml)) {
    return { html: cheerioHtml, usedPlaywright: false };
  }

  // Fallback step: Playwright dynamic loading
  try {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();
    
    // Set 15 seconds timeout to load Javascript-heavy pages
    await page.goto(urlStr, { waitUntil: "networkidle", timeout: 15000 });
    const playwrightHtml = await page.content();
    
    await browser.close();
    return { html: playwrightHtml, usedPlaywright: true };
  } catch (err) {
    // If Playwright is not installed or browser launch fails, return Cheerio HTML
    return { html: cheerioHtml, usedPlaywright: false };
  }
}
