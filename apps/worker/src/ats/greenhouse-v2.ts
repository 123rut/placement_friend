/**
 * CareerPilot AI — Enhanced Greenhouse Adapter
 * 
 * Uses ?content=true to fetch full job descriptions.
 * Full descriptions are required for embedding-based semantic search.
 */
import { NormalizedJob, detectEmploymentType, stripHtml } from "./normalized-job";

const BASE_URL = "https://boards-api.greenhouse.io/v1/boards";

export async function fetchGreenhouseJobs(identifier: string): Promise<NormalizedJob[]> {
  const url = `${BASE_URL}/${identifier}/jobs?content=true`;

  const response = await fetch(url, {
    headers: { "User-Agent": "CareerPilot/1.0" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Greenhouse API HTTP ${response.status} for board: ${identifier}`);
  }

  const data = await response.json();
  const jobs: any[] = data.jobs || [];

  return jobs.map((job): NormalizedJob => {
    const description = stripHtml(job.content || job.description || "");
    return {
      title: job.title || "Unknown Role",
      location: job.location?.name || null,
      remote: (job.location?.name || "").toLowerCase().includes("remote"),
      employmentType: detectEmploymentType(job.title, description),
      description,
      salaryMin: null,   // Greenhouse rarely exposes salary
      salaryMax: null,
      url: job.absolute_url || "",
      postedAt: job.updated_at ? new Date(job.updated_at) : null,
    };
  }).filter(j => j.url); // drop jobs without an apply URL
}
