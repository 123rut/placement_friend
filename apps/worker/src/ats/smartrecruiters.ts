import { URL } from "url";
import { ScrapedOpportunity } from "../agent";

export function detectProvider(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host.includes("smartrecruiters.com");
  } catch {
    return false;
  }
}

export async function extractJobs(urlStr: string): Promise<ScrapedOpportunity[]> {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const companyId = parts[0] || "";

    if (!companyId) {
      console.warn("Could not extract SmartRecruiters company identifier from:", urlStr);
      return [];
    }

    const apiUrl = `https://api.smartrecruiters.com/v1/companies/${companyId}/postings`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.warn(`SmartRecruiters API returned HTTP ${response.status} for company ${companyId}`);
      return [];
    }

    const data = await response.json();
    const postings = data.content || [];

    return postings.map((posting: any) => {
      const applyUrl = `https://jobs.smartrecruiters.com/${companyId}/${posting.id}`;
      return {
        role: posting.name,
        eligibility: "Computer Science, Information Technology, Electronics",
        deadline: null,
        applyUrl
      };
    });
  } catch (error) {
    console.error("Error extracting jobs from SmartRecruiters:", error);
    return [];
  }
}
