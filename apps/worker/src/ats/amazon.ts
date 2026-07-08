// ats/amazon.ts
import { ScrapedOpportunity } from "../agent";
import { guessEligibilityFromRole } from "../validator";
import { fetchWithTimeout } from "../fetchWithTimeout";

export function detectProvider(urlStr: string): boolean {
  return urlStr.includes("amazon.jobs");
}

export async function extractJobs(urlStr: string): Promise<ScrapedOpportunity[]> {
  try {
    const apiUrl = `https://www.amazon.jobs/en/search.json?base_query=&result_limit=100&offset=0`;
    
    const response = await fetchWithTimeout(apiUrl, { timeout: 15000 });
    if (!response.ok) {
      console.warn(`Amazon Jobs API returned HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const jobs = data.jobs || [];

    return jobs.map((job: any) => ({
      role: job.title,
      eligibility: guessEligibilityFromRole(job.title).branches.join(", "),
      deadline: null,
      applyUrl: `https://www.amazon.jobs${job.job_path}`
    }));
  } catch (error) {
    console.error("Error extracting jobs from Amazon:", error);
    return [];
  }
}
