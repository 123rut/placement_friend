/**
 * CareerPilot AI — Lever Adapter
 */
import { NormalizedJob, detectEmploymentType, stripHtml } from "./normalized-job";

export async function fetchLeverJobs(identifier: string): Promise<NormalizedJob[]> {
  const url = `https://api.lever.co/v0/postings/${identifier}?mode=json`;

  const response = await fetch(url, {
    headers: { "User-Agent": "CareerPilot/1.0" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Lever API HTTP ${response.status} for: ${identifier}`);
  }

  const jobs: any[] = await response.json();

  return jobs.map((job): NormalizedJob => {
    const descriptionHtml = [
      job.descriptionPlain || "",
      ...(job.lists || []).map((l: any) => l.content || "")
    ].join("\n");
    const description = stripHtml(descriptionHtml);

    const location = job.categories?.location || job.workplaceType || null;
    return {
      title: job.text || "Unknown Role",
      location,
      remote: (location || "").toLowerCase().includes("remote") || job.workplaceType === "remote",
      employmentType: detectEmploymentType(job.text, description),
      description,
      salaryMin: job.salaryRange?.min || null,
      salaryMax: job.salaryRange?.max || null,
      url: job.hostedUrl || job.applyUrl || "",
      postedAt: job.createdAt ? new Date(job.createdAt) : null,
    };
  }).filter(j => j.url);
}
