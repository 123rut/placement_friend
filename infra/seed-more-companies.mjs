import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL is not defined in the environment or .env.local.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false
});

// Complete list of companies mapped to categories
const rawCompanies = [
  // Tier 1 — High Tech / Product
  { name: "Google", category: "it-product" },
  { name: "Microsoft", category: "it-product" },
  { name: "Amazon", category: "it-product" },
  { name: "NVIDIA", category: "it-product" },
  { name: "Adobe", category: "it-product" },
  { name: "Atlassian", category: "it-product" },
  { name: "Salesforce", category: "it-product" },
  { name: "Uber", category: "it-product" },
  { name: "Stripe", category: "it-product" },
  { name: "Databricks", category: "it-product" },
  { name: "Snowflake", category: "it-product" },
  { name: "Airbnb", category: "it-product" },
  { name: "LinkedIn", category: "it-product" },
  { name: "ServiceNow", category: "it-product" },
  { name: "Rubrik", category: "it-product" },
  { name: "Cloudflare", category: "it-product" },
  { name: "MongoDB", category: "it-product" },
  { name: "Confluent", category: "it-product" },
  { name: "Elastic", category: "it-product" },
  { name: "Okta", category: "it-product" },
  { name: "HashiCorp", category: "it-product" },
  { name: "GitLab", category: "it-product" },
  { name: "GitHub", category: "it-product" },
  { name: "Figma", category: "it-product" },
  { name: "Canva", category: "it-product" },
  { name: "Discord", category: "it-product" },
  { name: "Dropbox", category: "it-product" },
  { name: "Notion", category: "it-product" },
  { name: "Coinbase", category: "it-product" },
  { name: "Rippling", category: "it-product" },
  { name: "Palo Alto Networks", category: "it-product" },
  { name: "Zscaler", category: "it-product" },
  { name: "Datadog", category: "it-product" },
  { name: "CrowdStrike", category: "it-product" },
  { name: "Pure Storage", category: "it-product" },
  { name: "Nutanix", category: "it-product" },
  { name: "Cisco", category: "it-product" },
  { name: "VMware", category: "it-product" },
  { name: "Qualcomm", category: "it-product" },
  { name: "Intel", category: "it-product" },
  { name: "AMD", category: "it-product" },
  { name: "ARM", category: "it-product" },
  { name: "Oracle", category: "it-product" },
  { name: "SAP", category: "it-product" },
  { name: "Siemens", category: "core" },
  { name: "Nokia", category: "core" },
  { name: "Ericsson", category: "core" },
  { name: "Broadcom", category: "it-product" },
  { name: "Synopsys", category: "core" },
  { name: "Cadence", category: "core" },

  // Tier 2 — Product Companies
  { name: "Razorpay", category: "startup" },
  { name: "PhonePe", category: "startup" },
  { name: "Groww", category: "startup" },
  { name: "CRED", category: "startup" },
  { name: "Meesho", category: "startup" },
  { name: "BrowserStack", category: "startup" },
  { name: "Postman", category: "startup" },
  { name: "Freshworks", category: "it-product" },
  { name: "Zoho", category: "it-product" },
  { name: "InMobi", category: "startup" },
  { name: "Walmart Global Tech", category: "it-product" },
  { name: "Expedia", category: "it-product" },
  { name: "Intuit", category: "it-product" },
  { name: "PayPal", category: "it-product" },
  { name: "Visa", category: "bfsi" },
  { name: "Mastercard", category: "bfsi" },
  { name: "JPMorgan Chase", category: "bfsi" },
  { name: "Goldman Sachs", category: "bfsi" },
  { name: "Morgan Stanley", category: "bfsi" },
  { name: "American Express", category: "bfsi" },
  { name: "BlackRock", category: "bfsi" },
  { name: "Bloomberg", category: "it-product" },
  { name: "Autodesk", category: "it-product" },
  { name: "Honeywell", category: "core" },
  { name: "GE Aerospace", category: "core" },
  { name: "Bosch", category: "core" },
  { name: "Schneider Electric", category: "core" },
  { name: "ABB", category: "core" },
  { name: "Dell Technologies", category: "it-product" },
  { name: "HP", category: "it-product" },
  { name: "Lenovo", category: "it-product" },
  { name: "Western Digital", category: "core" },
  { name: "Seagate", category: "core" },
  { name: "Micron", category: "core" },
  { name: "Red Hat", category: "it-product" },
  { name: "SUSE", category: "it-product" },
  { name: "Cloudera", category: "it-product" },
  { name: "Akamai", category: "it-product" },
  { name: "Zoom", category: "it-product" },
  { name: "Twilio", category: "it-product" },
  { name: "RingCentral", category: "it-product" },
  { name: "DocuSign", category: "it-product" },
  { name: "New Relic", category: "it-product" },
  { name: "Splunk", category: "it-product" },
  { name: "Grafana Labs", category: "it-product" },
  { name: "Redis", category: "it-product" },
  { name: "Neo4j", category: "it-product" },
  { name: "Cockroach Labs", category: "it-product" },
  { name: "DigitalOcean", category: "it-product" },
  { name: "Vercel", category: "startup" },

  // Tier 3 — High-Growth Startups
  { name: "OpenAI", category: "startup" },
  { name: "Anthropic", category: "startup" },
  { name: "Perplexity", category: "startup" },
  { name: "Cohere", category: "startup" },
  { name: "Mistral AI", category: "startup" },
  { name: "Scale AI", category: "startup" },
  { name: "Hugging Face", category: "startup" },
  { name: "ElevenLabs", category: "startup" },
  { name: "Glean", category: "startup" },
  { name: "Abnormal AI", category: "startup" },
  { name: "SentinelOne", category: "startup" },
  { name: "Wiz", category: "startup" },
  { name: "Snyk", category: "startup" },
  { name: "PlanetScale", category: "startup" },
  { name: "Supabase", category: "startup" },
  { name: "Render", category: "startup" },
  { name: "Fly.io", category: "startup" },
  { name: "Temporal", category: "startup" },
  { name: "Astronomer", category: "startup" },
  { name: "ClickHouse", category: "startup" },
  { name: "SingleStore", category: "startup" },
  { name: "Yugabyte", category: "startup" },
  { name: "Cato Networks", category: "startup" },
  { name: "Harness", category: "startup" },
  { name: "Hasura", category: "startup" },
  { name: "Stream", category: "startup" },
  { name: "LaunchDarkly", category: "startup" },
  { name: "Humanitec", category: "startup" },
  { name: "Linear", category: "startup" },
  { name: "Retool", category: "startup" },
  { name: "Brex", category: "startup" },
  { name: "Ramp", category: "startup" },
  { name: "Mercury", category: "startup" },
  { name: "Deel", category: "startup" },
  { name: "Remote", category: "startup" },
  { name: "Gusto", category: "startup" },
  { name: "Plaid", category: "startup" },
  { name: "Chime", category: "startup" },
  { name: "Carta", category: "startup" },
  { name: "Checkr", category: "startup" },
  { name: "Anduril", category: "startup" },
  { name: "Samsara", category: "startup" },
  { name: "Celonis", category: "startup" },
  { name: "Contentsquare", category: "startup" },
  { name: "Algolia", category: "startup" },
  { name: "Miro", category: "startup" },
  { name: "Zapier", category: "startup" },
  { name: "Grammarly", category: "startup" },

  // Tier 4 — Enterprise & Consulting
  { name: "Accenture", category: "consulting" },
  { name: "Deloitte", category: "consulting" },
  { name: "EY", category: "consulting" },
  { name: "PwC", category: "consulting" },
  { name: "KPMG", category: "consulting" },
  { name: "Capgemini", category: "consulting" },
  { name: "Cognizant", category: "consulting" },
  { name: "Infosys", category: "it-service" },
  { name: "TCS", category: "it-service" },
  { name: "Wipro", category: "it-service" },
  { name: "HCLTech", category: "it-service" },
  { name: "LTIMindtree", category: "it-service" },
  { name: "Tech Mahindra", category: "it-service" },
  { name: "Hexaware", category: "it-service" },
  { name: "Mphasis", category: "it-service" },
  { name: "Persistent Systems", category: "it-service" },
  { name: "KPIT", category: "it-service" },
  { name: "GlobalLogic", category: "it-service" },
  { name: "Nagarro", category: "it-service" },
  { name: "Publicis Sapient", category: "consulting" },
  { name: "Thoughtworks", category: "consulting" },
  { name: "EPAM", category: "consulting" },
  { name: "Luxoft", category: "consulting" },
  { name: "Virtusa", category: "consulting" },
  { name: "UST", category: "consulting" },
  { name: "NTT DATA", category: "consulting" },
  { name: "Hitachi Digital", category: "consulting" },
  { name: "Fujitsu", category: "consulting" },
  { name: "NEC", category: "core" },
  { name: "CGI", category: "consulting" },
  { name: "Ciena", category: "core" },
  { name: "Ericsson India", category: "core" },
  { name: "Nokia India", category: "core" },
  { name: "Ericsson Global", category: "core" },
  { name: "Siemens Digital Industries", category: "core" },
  { name: "Philips", category: "core" },
  { name: "Roche", category: "core" },
  { name: "Novartis", category: "core" },
  { name: "Roche Informatics", category: "core" },
  { name: "AstraZeneca", category: "core" },
  { name: "Roche Diagnostics", category: "core" },
  { name: "McAfee", category: "it-product" },
  { name: "Fortinet", category: "it-product" },
  { name: "Sophos", category: "it-product" },
  { name: "Trend Micro", category: "it-product" },
  { name: "Check Point Software", category: "it-product" },
  { name: "Forcepoint", category: "it-product" },
  { name: "Tanium", category: "it-product" },
  { name: "Mimecast", category: "it-product" },
  { name: "Sophos India", category: "it-product" },
  { name: "Swiggy", category: "startup" },
  { name: "Myntra", category: "it-product" },
  { name: "Observe.AI", category: "startup" },
  { name: "Upstox", category: "startup" }
];

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seed() {
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    console.log(`Starting to seed ${rawCompanies.length} companies...`);
    
    for (const comp of rawCompanies) {
      const slug = slugify(comp.name);
      
      const res = await client.query(
        `INSERT INTO companies (
          id, name, slug, category, status, is_active, is_global, 
          eligible_branches, source, region, added_by
        )
        VALUES ($1, $2, $3, $4, 'url_missing', true, true, 
                'Computer Science, Information Technology, Electronics', 'careerpilot-catalog', 'IN', 'agent')
        ON CONFLICT (id) DO NOTHING`,
        [slug, comp.name, slug, comp.category]
      );
      
      if (res.rowCount && res.rowCount > 0) {
        inserted++;
      }
    }
    
    await client.query("COMMIT");
    console.log(`Successfully seeded companies!`);
    console.log(`- New companies added: ${inserted}`);
    console.log(`- Total processed: ${rawCompanies.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
