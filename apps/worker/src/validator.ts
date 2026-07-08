import crypto from "crypto";
import { pool } from "./db";
import {
  validateUrl as sharedValidateUrl,
  checkDuplicateUrl as sharedCheckDuplicateUrl,
  fuzzyMatchCompany as sharedFuzzyMatchCompany,
  detectRegionMismatch as sharedDetectRegionMismatch,
  detectSingleListingUrl as sharedDetectSingleListingUrl
} from "@piaa/domain";

/**
 * 1. Validate URL: Regex format, HEAD request, and keyword scan.
 */
export async function validateUrl(urlStr: string) {
  return sharedValidateUrl(urlStr);
}

/**
 * 2. Check for duplicate URL under a different company.
 */
export async function checkDuplicateUrl(urlStr: string, excludeCompanyId?: string) {
  return sharedCheckDuplicateUrl(pool, urlStr, excludeCompanyId);
}

/**
 * 3. Fuzzy match company name against database.
 */
export async function fuzzyMatchCompany(name: string, excludeCompanyId?: string) {
  return sharedFuzzyMatchCompany(pool, name, excludeCompanyId);
}

/**
 * 4. Detect region mismatches in the careers URL paths.
 */
export function detectRegionMismatch(urlStr: string, companyRegion: string) {
  return sharedDetectRegionMismatch(urlStr, companyRegion);
}

/**
 * 5. Detect if the URL is a single job listing rather than a general careers index page.
 */
export function detectSingleListingUrl(urlStr: string) {
  return sharedDetectSingleListingUrl(urlStr);
}

/**
 * 6. Generate deterministic SHA-256 dedupe key.
 */
export function generateDedupeKey(
  companyId: string,
  applyUrl: string | null,
  title: string,
  location: string | null,
  deadline: string | null
): string {
  const cleanRole = title.trim().toLowerCase();
  
  // Primary dedupe key if there is a unique apply URL
  if (applyUrl && applyUrl.trim().length > 0 && !isGeneralCareersUrl(applyUrl)) {
    const cleanApplyUrl = applyUrl.trim().toLowerCase();
    const data = `${companyId}:${cleanRole}:${cleanApplyUrl}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  } else {
    // Fallback dedupe key
    const cleanLocation = (location || "unknown").trim().toLowerCase();
    const cleanDeadline = (deadline || "nodeadline").trim().toLowerCase();
    const data = `${companyId}:${cleanRole}:${cleanLocation}:${cleanDeadline}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

/**
 * Helper to identify if a URL is likely a generic job index page rather than a job post.
 */
export function isGeneralCareersUrl(urlStr: string, companyCareersUrl?: string | null): boolean {
  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    
    // Normalize paths by removing trailing slashes
    const normPath = path.replace(/\/$/, "");
    
    // If it matches companyCareersUrl exactly (or close to it)
    if (companyCareersUrl) {
      try {
        const compParsed = new URL(companyCareersUrl);
        const compNorm = compParsed.origin + compParsed.pathname.toLowerCase().replace(/\/$/, "");
        const urlNorm = parsed.origin + normPath;
        if (compNorm === urlNorm) {
          return true;
        }

        // If the URL is a subpath of the company's careers page
        // check if it is missing clear job identifiers
        if (urlNorm.startsWith(compNorm)) {
          const hasJobId = /\d+/.test(normPath) || 
                           /[a-f0-9\-]{36}/.test(normPath) || 
                           normPath.includes("job-") || 
                           normPath.includes("/job/") || 
                           normPath.includes("/posting/") ||
                           query.includes("gh_jid=") || 
                           query.includes("jobid=") || 
                           query.includes("req=") || 
                           query.includes("job_id=");
          if (!hasJobId) {
            return true;
          }
        }
      } catch {}
    }
    
    // List of path segments that indicate general portals/categories/landing pages
    const generalSegments = [
      "/jobs",
      "/careers",
      "/opportunities",
      "/openings",
      "/results",
      "/students",
      "/graduates",
      "/where-we-hire",
      "/key-hiring-areas",
      "/career-opportunities",
      "/all-jobs",
      "/view-all-jobs",
      "/search-jobs",
      "/search-careers",
      "/working-here",
      "/join-us",
      "/why-us",
      "/benefits",
      "/teams",
      "/culture",
      "/departments",
      "/locations",
      "/divisions"
    ];
    
    // Check if normalized path matches or ends with any of the general segments
    if (generalSegments.some(seg => normPath === seg || normPath.endsWith(seg))) {
      return true;
    }
    
    // If it has pagination or general search queries
    if (
      query.includes("page=") ||
      query.includes("search=") ||
      query.includes("keyword=") ||
      query.includes("q=") ||
      query.includes("category=") ||
      query.includes("department=")
    ) {
      // But make sure it doesn't have a single job indicator
      const hasJobId = query.includes("gh_jid=") || query.includes("jobid=") || query.includes("req=") || query.includes("job_id=");
      if (!hasJobId) {
        return true;
      }
    }
  } catch {}
  return false;
}

export function isGenericRoleName(roleName: string): boolean {
  const lower = roleName.trim().toLowerCase();
  const genericPhrases = [
    "students and graduates",
    "career opportunities",
    "key hiring areas",
    "entry-level opportunity",
    "entry level opportunity",
    "technology",
    "all jobs",
    "search jobs",
    "join our talent network",
    "explore opportunities",
    "learn more",
    "view jobs",
    "view all jobs",
    "working at",
    "general application",
    "spontaneous application",
    "careers",
    "apply here"
  ];
  // If the role name is exactly one of these, or very short and generic
  if (genericPhrases.some(phrase => lower === phrase || lower.startsWith(phrase + " ") || lower.endsWith(" " + phrase))) {
    return true;
  }
  
  // Check if roleName is exactly a main department/division name
  const departments = [
    "engineering", "sales", "marketing", "finance", "human resources", "hr", "operations",
    "customer support", "legal", "product management", "design", "it support", "information technology"
  ];
  if (departments.some(dept => lower === dept)) {
    return true;
  }
  
  return false;
}

export type EligibilityResult = {
  branches: string[];
  confidence: number;
};

/**
 * Normalizes branch name to standard forms used by our system
 */
export function normalizeBranch(branch: string): string {
  const clean = branch.trim().toUpperCase();
  if (clean === "CSE" || clean === "COMPUTER SCIENCE ENGINEERING" || clean.includes("COMPUTER SCIENCE")) {
    return "Computer Science";
  }
  if (clean === "IT" || clean.includes("INFORMATION TECHNOLOGY")) {
    return "Information Technology";
  }
  if (clean === "ECE" || clean.includes("ELECTRONICS") || clean.includes("COMMUNICATION")) {
    return "Electronics";
  }
  if (clean === "EEE" || clean.includes("ELECTRICAL")) {
    return "Electrical";
  }
  if (clean === "MECH" || clean.includes("MECHANICAL")) {
    return "Mechanical";
  }
  if (clean.includes("CIVIL")) {
    return "Civil";
  }
  if (clean.includes("CHEMICAL")) {
    return "Chemical";
  }
  // Fallback to title case
  return branch.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/**
 * Normalizes role name by removing noise keywords and extra spaces
 */
export function normalizeRoleName(roleName: string): string {
  return roleName
    .replace(/\(.*?\)/g, "") // remove parenthesized details like (Remote), (Hybrid), (Internship)
    .replace(/\[.*?\]/g, "")
    .replace(/\b(remote|hybrid|contract|internship program|junior|senior|associate|lead|principal|staff|graduate|fresher|trainee)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Guess eligibility branches from role title and context
 */
export function guessEligibilityFromRole(roleName: string, context?: string): EligibilityResult {
  const normalizedRole = normalizeRoleName(roleName).toLowerCase();
  const lowerContext = context ? context.toLowerCase() : "";

  // 1. Check exclusions (non-technical roles)
  const nonTechKeywords = ["hr", "recruiter", "talent acquisition", "marketing", "sales", "finance", "accounting", "legal", "compliance", "writer", "designer", "content writer", "product manager"];
  if (nonTechKeywords.some(kw => normalizedRole.includes(kw))) {
    return { branches: [], confidence: 1.0 };
  }

  // 2. Identify matching branches using keyword lists
  const csKeywords = [
    "software", "developer", "programmer", "backend", "frontend", "full stack", "fullstack",
    "web", "app", "mobile", "ios", "android", "cloud", "devops", "systems engineer",
    "qa", "test", "automation", "security", "cyber", "data engineer", "data engineering",
    "machine learning", "artificial intelligence", "deep learning", "ai", "ml", "nlp", "computer vision",
    "computer science", "information technology", "coding", "algorithm", "full-stack", "back-end", "front-end", "sre", "site reliability"
  ];

  const dataKeywords = [
    "data analyst", "analytics", "business intelligence", "bi analyst", "reporting", "tableau", "power bi", "data analysis", "data scientist"
  ];

  const eceKeywords = [
    "embedded", "firmware", "hardware", "vlsi", "fpga", "pcb", "circuit", "semiconductor", "asic", "rtl", "microcontroller"
  ];

  const electricalKeywords = [
    "electrical", "power system", "control system", "transformer", "grid"
  ];

  const mechKeywords = [
    "mechanical", "cad", "thermal", "fluid", "manufacturing", "production", "automotive",
    "aerospace", "solidworks", "ansys", "hvac", "machine design", "mechatronics"
  ];

  const civilKeywords = [
    "civil", "structural", "construction", "geotechnical", "surveying", "transportation",
    "environmental", "autocad", "site engineer", "infrastructure"
  ];

  const chemicalKeywords = [
    "chemical", "polymer", "process engineer", "petroleum", "refinery", "process engineering"
  ];

  const branchesSet = new Set<string>();
  let matchedCount = 0;

  if (csKeywords.some(kw => normalizedRole.includes(kw)) && !normalizedRole.includes("embedded")) {
    branchesSet.add("Computer Science");
    branchesSet.add("Information Technology");
    matchedCount++;
  }

  if (dataKeywords.some(kw => normalizedRole.includes(kw))) {
    branchesSet.add("Computer Science");
    branchesSet.add("Information Technology");
    matchedCount++;
  }

  if (eceKeywords.some(kw => normalizedRole.includes(kw))) {
    branchesSet.add("Electronics");
    matchedCount++;
  }

  if (electricalKeywords.some(kw => normalizedRole.includes(kw))) {
    branchesSet.add("Electrical");
    matchedCount++;
  }

  if (mechKeywords.some(kw => normalizedRole.includes(kw))) {
    branchesSet.add("Mechanical");
    matchedCount++;
  }

  if (civilKeywords.some(kw => normalizedRole.includes(kw))) {
    branchesSet.add("Civil");
    matchedCount++;
  }

  if (chemicalKeywords.some(kw => normalizedRole.includes(kw))) {
    branchesSet.add("Chemical");
    matchedCount++;
  }

  // 3. Fallback to context scanning if no direct match in role title
  if (branchesSet.size === 0 && context) {
    if (lowerContext.includes("computer science") || lowerContext.includes("cse")) {
      branchesSet.add("Computer Science");
    }
    if (lowerContext.includes("information technology") || lowerContext.includes("it")) {
      branchesSet.add("Information Technology");
    }
    if (lowerContext.includes("electronics") || lowerContext.includes("ece")) {
      branchesSet.add("Electronics");
    }
    if (lowerContext.includes("electrical") || lowerContext.includes("eee")) {
      branchesSet.add("Electrical");
    }
    if (lowerContext.includes("mechanical") || lowerContext.includes("mech")) {
      branchesSet.add("Mechanical");
    }
    if (lowerContext.includes("civil")) {
      branchesSet.add("Civil");
    }
    if (lowerContext.includes("chemical")) {
      branchesSet.add("Chemical");
    }
  }

  // 4. Default fallback: If technical but unclassified, default to CS, IT, Electronics
  if (branchesSet.size === 0) {
    // If it looks technical (e.g. has "engineer", "technician", "developer", "scientist", "intern")
    const techWords = ["engineer", "technician", "developer", "scientist", "intern", "analyst", "specialist", "member of technical staff", "mts"];
    if (techWords.some(w => normalizedRole.includes(w))) {
      return {
        branches: ["Computer Science", "Information Technology", "Electronics"],
        confidence: 0.5
      };
    }
    return { branches: [], confidence: 1.0 }; // Empty for non-tech/unclassified roles
  }

  // Calculate confidence: single strong classification yields higher confidence
  const confidence = matchedCount === 1 ? 0.95 : 0.85;

  return {
    branches: Array.from(branchesSet),
    confidence
  };
}

/**
 * Checks if a student's branch is eligible given the allowed branches
 */
export function isStudentEligible(
  studentBranch: string | string[],
  allowedBranches: string[]
): boolean {
  const studentBranches = Array.isArray(studentBranch) ? studentBranch : [studentBranch];
  const normalizedStudent = studentBranches.map(normalizeBranch);
  const normalizedAllowed = allowedBranches.map(normalizeBranch);

  return normalizedStudent.some(sb => normalizedAllowed.includes(sb));
}

