import pg from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../apps/web/.env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false,
});

const rules = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../apps/api/src/config/classification_rules.json"), "utf8")
);

function detectLanguage(text) {
  if (!text || text.trim().length < 20) return "ENGLISH";
  const nonEnglishMarkers = [
    /\b(requisitos|experiencia|años|responsabilidades|descripción|qualificações|conhecimento|anos)\b/i,
    /\b(exigences|expérience|années|responsabilités)\b/i,
    /\b(anforderungen|erfahrung|jahre|verantwortung)\b/i,
  ];
  for (const p of nonEnglishMarkers) {
    if (p.test(text)) return "NON_ENGLISH";
  }
  return "ENGLISH";
}

function parseSections(text) {
  if (!text) return { hasStructuredSections: false, requirements: "", preferred: "", fullText: "" };
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ");
  const hasStructured = /requirements|qualifications|preferred|responsibilities/i.test(clean);
  return { hasStructuredSections: hasStructured, fullText: clean };
}

function classifyRole(title) {
  const norm = (title || "").toLowerCase().trim();
  let score = 0;
  let reason = null;

  for (const [kw, weight] of Object.entries(rules.negative_roles)) {
    const regex = new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(norm)) {
      score += weight;
      if (!reason) reason = `non_technical_role (${kw})`;
    }
  }

  for (const [kw, weight] of Object.entries(rules.technical_roles)) {
    const regex = new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(norm)) {
      score += weight;
    }
  }

  if (score <= -4) return { state: "NON_TECHNICAL", reason: reason || "non_technical_role" };
  if (score >= 2) return { state: "TECHNICAL", reason: null };
  return { state: "AMBIGUOUS", reason: null };
}

function parseExperience(title, text) {
  const norm = (text || "").toLowerCase();
  
  // False positive checks
  const falsePositiveSentences = norm.split(/[.\n]/).filter(s => 
    /\b(?:company|firm|founded|serving|industry)\s+(?:has\s+)?(?:\d+)\+?\s*years/i.test(s) ||
    /\b(?:class of|batch of)\s*20\d\d\b/i.test(s) ||
    /\b(?:web3|oauth2|3rd[- ]party)\b/i.test(s)
  );

  const cleanText = norm;
  const match = cleanText.match(/(\d+)\s*\+\s*(?:years|yrs|year)(?:\s+of)?(?:\s+(?:professional|relevant|work))?\s*experience/i) ||
                cleanText.match(/minimum\s*(?:of\s*)?(\d+)\s*(?:years|yrs|year)/i) ||
                cleanText.match(/at\s*least\s*(\d+)\s*(?:years|yrs|year)/i) ||
                cleanText.match(/(\d+)\s*-\s*(\d+)\s*(?:years|yrs|year)(?:\s+of)?(?:\s+(?:professional|relevant))?\s*experience/i);

  if (match) {
    const years = parseInt(match[1], 10);
    if (!isNaN(years) && years >= 3) {
      return { requiredYears: years, isHardViolation: true };
    }
  }

  return { requiredYears: 0, isHardViolation: false };
}

function generateLogicalKey(companyId, title, location, category) {
  return [
    String(companyId || "").trim().toLowerCase(),
    String(title || "").trim().toLowerCase().replace(/\s+/g, " "),
    String(location || "global").trim().toLowerCase().replace(/\s+/g, " "),
    String(category || "").trim().toLowerCase().replace(/\s+/g, " ")
  ].join("|");
}

async function revalidate() {
  await client.connect();
  console.log("Connected to database. Fetching existing jobs for deterministic revalidation...");

  const res = await client.query(`SELECT id, company_id, title, description, location, employment_type FROM jobs`);
  const jobs = res.rows;
  console.log(`Found ${jobs.length} jobs to revalidate.`);

  let approvedCount = 0;
  let rejectedCount = 0;
  let sectionsFound = 0;

  for (const job of jobs) {
    const sections = parseSections(job.description);
    if (sections.hasStructuredSections) sectionsFound++;

    const role = classifyRole(job.title);
    const exp = parseExperience(job.title, job.description);
    const logicalKey = generateLogicalKey(job.company_id, job.title, job.location, job.employment_type);

    let status = "APPROVED";
    let rejectionReason = null;

    if (role.state === "NON_TECHNICAL") {
      status = "REJECTED";
      rejectionReason = role.reason;
    } else if (exp.isHardViolation) {
      status = "REJECTED";
      rejectionReason = `required_experience_${exp.requiredYears}_years`;
    }

    if (status === "APPROVED") {
      approvedCount++;
    } else {
      rejectedCount++;
      console.log(`[Revalidation] REJECTED: "${job.title}" (${rejectionReason})`);
    }

    await client.query(
      `UPDATE jobs
       SET relevance_status = $1, rejection_reason = $2, logical_job_key = $3
       WHERE id = $4`,
      [status, rejectionReason, logicalKey, job.id]
    );
  }

  console.log("=================================================");
  console.log(`Revalidation Complete:`);
  console.log(`Total Processed: ${jobs.length}`);
  console.log(`Approved (Kept in active feed): ${approvedCount}`);
  console.log(`Rejected (Soft-flagged): ${rejectedCount}`);
  console.log(`Context Extraction Rate: ${jobs.length > 0 ? ((sectionsFound / jobs.length) * 100).toFixed(1) : 0}%`);
  console.log("=================================================");

  await client.end();
}

revalidate().catch((err) => {
  console.error("Revalidation failed:", err);
  process.exit(1);
});
