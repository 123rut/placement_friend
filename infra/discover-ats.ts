import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { findCareersUrl } from "../apps/worker/src/search";
import { detectRedirect, getAtsProviderFromUrl } from "../apps/worker/src/scraper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL is not defined.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false
});

function parseGreenhouseToken(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.searchParams.get("board_token") || "";
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  } catch {
    return "";
  }
}

function parseLeverToken(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  } catch {
    return "";
  }
}

function parseSmartRecruitersToken(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  } catch {
    return "";
  }
}

function parseAshbyToken(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  } catch {
    return "";
  }
}

function parseWorkday(urlStr: string) {
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

async function run() {
  console.log("Fetching companies with missing ATS or careers URLs...");
  const res = await pool.query(
    "SELECT id, name FROM companies WHERE status = 'url_missing' OR ats IS NULL ORDER BY name"
  );
  const companies = res.rows;
  console.log(`Found ${companies.length} companies to scan.`);

  for (const company of companies) {
    console.log(`\nScanning "${company.name}"...`);
    try {
      // 1. DuckDuckGo Search
      const discoveredUrl = await findCareersUrl(company.name);
      if (!discoveredUrl) {
        console.warn(`[-] No careers URL found for ${company.name}`);
        continue;
      }
      console.log(`[+] Discovered URL: ${discoveredUrl}`);

      // 2. Redirect detection
      const redirectRes = await detectRedirect(discoveredUrl);
      const finalUrl = redirectRes.finalUrl;
      const atsProvider = redirectRes.atsProvider;

      if (!atsProvider) {
        console.log(`[-] No ATS detected for ${company.name} (Direct URL: ${finalUrl})`);
        // Just save the discovered careers URL but no ATS
        await pool.query(
          "UPDATE companies SET careers_url = $1, status = 'active', is_active = true WHERE id = $2",
          [finalUrl, company.id]
        );
        continue;
      }

      console.log(`[!] ATS Detected: ${atsProvider.toUpperCase()} at ${finalUrl}`);
      
      let identifier = "";
      let site: string | null = null;
      let atsHost: string | null = null;

      if (atsProvider === "greenhouse") {
        identifier = parseGreenhouseToken(finalUrl);
      } else if (atsProvider === "lever") {
        identifier = parseLeverToken(finalUrl);
      } else if (atsProvider === "smartrecruiters") {
        identifier = parseSmartRecruitersToken(finalUrl);
      } else if (atsProvider === "ashby") {
        identifier = parseAshbyToken(finalUrl);
      } else if (atsProvider === "workday") {
        const wdConfig = parseWorkday(finalUrl);
        if (wdConfig) {
          identifier = wdConfig.tenant;
          site = wdConfig.slug;
          atsHost = wdConfig.host;
        }
      }

      // Update company in database with ATS details
      await pool.query(
        `UPDATE companies 
         SET careers_url = $1, 
             ats = $2, 
             identifier = $3, 
             site = $4, 
             ats_host = $5,
             status = 'active',
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [finalUrl, atsProvider, identifier || null, site, atsHost, company.id]
      );
      console.log(`[+] Database updated successfully for ${company.name}`);
    } catch (err: any) {
      console.error(`[x] Error processing ${company.name}:`, err.message || err);
    }
  }

  console.log("\nScan complete!");
  await pool.end();
}

run();
