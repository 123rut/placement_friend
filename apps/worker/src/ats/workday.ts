import { URL } from "url";
import { ScrapedOpportunity } from "../agent";

export function detectProvider(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host.includes("myworkdayjobs.com");
  } catch {
    return false;
  }
}

export async function extractJobs(urlStr: string): Promise<ScrapedOpportunity[]> {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname; // e.g. workday.wd5.myworkdayjobs.com
    const subdomain = host.replace(".myworkdayjobs.com", ""); // e.g. workday.wd5
    const tenant = subdomain.split(".")[0]; // e.g. workday

    const parts = parsed.pathname.split("/").filter(Boolean);
    // The slug is typically the path segment representing the section (e.g. Careers, Workday)
    // Avoid using language prefixes like 'en-US' as the slug.
    let slug = "careers";
    for (const part of parts) {
      if (part !== "en-US" && part !== "en-GB" && part !== "en" && part.length > 3) {
        slug = part;
        break;
      }
    }

    const apiUrl = `https://${host}/wday/cxs/${tenant}/${slug}/jobs`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 50,
        offset: 0,
        searchText: ""
      })
    });

    if (!response.ok) {
      console.warn(`Workday API returned HTTP ${response.status} for URL: ${apiUrl}`);
      return [];
    }

    const data = await response.json();
    const postings = data.jobPostings || [];

    return postings.map((posting: any) => {
      const externalPath = posting.externalPath || "";
      const cleanPath = externalPath.startsWith("/") ? externalPath : `/${externalPath}`;
      
      // Workday paths are relative, make them absolute
      const applyUrl = `https://${host}${cleanPath}`;

      return {
        role: posting.title,
        eligibility: "Computer Science, Information Technology, Electronics",
        deadline: null,
        applyUrl
      };
    });
  } catch (error) {
    console.error("Error extracting jobs from Workday:", error);
    return [];
  }
}
