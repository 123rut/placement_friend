import { URL } from "url";
import { ScrapedOpportunity } from "../agent";

export function detectProvider(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host.includes("greenhouse.io");
  } catch {
    return false;
  }
}

export async function extractJobs(urlStr: string): Promise<ScrapedOpportunity[]> {
  try {
    const parsed = new URL(urlStr);
    let boardToken = "";

    // Extract board token from path (e.g., /google) or query param
    if (parsed.pathname.startsWith("/embed/")) {
      boardToken = parsed.searchParams.get("board_token") || "";
    } else {
      const parts = parsed.pathname.split("/").filter(Boolean);
      boardToken = parts[0] || "";
    }

    if (!boardToken) {
      console.warn("Could not extract Greenhouse board token from:", urlStr);
      return [];
    }

    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.warn(`Greenhouse API returned HTTP ${response.status} for board ${boardToken}`);
      return [];
    }

    const data = await response.json();
    const jobs = data.jobs || [];

    return jobs.map((job: any) => ({
      role: job.title,
      eligibility: "Computer Science, Information Technology, Electronics",
      deadline: null,
      applyUrl: job.absolute_url
    }));
  } catch (error) {
    console.error("Error extracting jobs from Greenhouse:", error);
    return [];
  }
}
