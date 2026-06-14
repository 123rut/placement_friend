import { URL } from "url";
import { ScrapedOpportunity } from "../agent";

export function detectProvider(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host.includes("lever.co");
  } catch {
    return false;
  }
}

export async function extractJobs(urlStr: string): Promise<ScrapedOpportunity[]> {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const slug = parts[0] || "";

    if (!slug) {
      console.warn("Could not extract Lever slug from:", urlStr);
      return [];
    }

    const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.warn(`Lever API returned HTTP ${response.status} for slug ${slug}`);
      return [];
    }

    const postings = await response.json();
    if (!Array.isArray(postings)) {
      return [];
    }

    return postings.map((posting: any) => {
      const location = posting.categories?.location || "Remote";
      return {
        role: posting.text || posting.title,
        eligibility: "Computer Science, Information Technology, Electronics",
        deadline: null,
        applyUrl: posting.hostedUrl || posting.postingsApplyUrl
      };
    });
  } catch (error) {
    console.error("Error extracting jobs from Lever:", error);
    return [];
  }
}
