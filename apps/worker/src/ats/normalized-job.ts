/**
 * CareerPilot AI — Normalized Job Interface
 * Shared across all ATS adapters.
 */
export interface NormalizedJob {
  title: string;
  location: string | null;
  remote: boolean;
  employmentType: "fulltime" | "internship" | "contract" | "unknown";
  description: string;        // full JD text — critical for embeddings
  salaryMin: number | null;
  salaryMax: number | null;
  url: string;
  postedAt: Date | null;
}

/**
 * Detect employment type from job title or description text.
 */
export function detectEmploymentType(title: string, description: string = ""): NormalizedJob["employmentType"] {
  const text = (title + " " + description).toLowerCase();
  if (text.includes("intern") || text.includes("internship") || text.includes("trainee")) return "internship";
  if (text.includes("contract") || text.includes("contractor") || text.includes("freelance")) return "contract";
  if (text.includes("full time") || text.includes("full-time") || text.includes("permanent")) return "fulltime";
  return "fulltime"; // default assumption
}

/**
 * Strip HTML tags from job description.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
