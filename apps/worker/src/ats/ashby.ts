/**
 * CareerPilot AI — Ashby Adapter (NEW)
 * Ashby is used by Anthropic, Perplexity, Mistral, etc.
 */
import { NormalizedJob, detectEmploymentType, stripHtml } from "./normalized-job";

export async function fetchAshbyJobs(identifier: string): Promise<NormalizedJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${identifier}?includeCompensation=true`;

  const response = await fetch(url, {
    headers: { "User-Agent": "CareerPilot/1.0" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Ashby API HTTP ${response.status} for: ${identifier}`);
  }

  const data = await response.json();
  const jobs: any[] = data.jobs || [];

  return jobs.map((job): NormalizedJob => {
    const description = stripHtml(job.descriptionHtml || job.description || "");
    const location = job.location || job.locationName || null;

    // Parse salary from compensation info
    const comp = job.compensation;
    const salaryMin = comp?.minValue || null;
    const salaryMax = comp?.maxValue || null;

    return {
      title: job.title || "Unknown Role",
      location,
      remote: job.isRemote || (location || "").toLowerCase().includes("remote"),
      employmentType: detectEmploymentType(job.title, description),
      description,
      salaryMin: salaryMin ? Math.round(salaryMin) : null,
      salaryMax: salaryMax ? Math.round(salaryMax) : null,
      url: job.jobUrl || job.applyUrl || "",
      postedAt: job.publishedDate ? new Date(job.publishedDate) : null,
    };
  }).filter(j => j.url);
}
