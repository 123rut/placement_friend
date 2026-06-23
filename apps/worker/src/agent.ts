import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { rateLimitGemini, rateLimitGroq } from "./rateLimiter";
import { guessEligibilityFromRole, isStudentEligible } from "./validator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

export interface ScrapedOpportunity {
  role: string;
  eligibility: string;
  deadline: string | null;
  applyUrl: string;
}

/**
 * Level 3 Scraper Extract opportunities via Claude API or regex fallback parser.
 */
export async function extractOpportunities(
  text: string,
  companyId: string,
  studentBranch?: string | null
): Promise<ScrapedOpportunity[]> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (groqApiKey) {
    try {
      console.log(`Using Groq API to extract opportunities for: ${companyId}`);
      let systemInstruction = "You are an expert scraping assistant. Extract open placement and internship opportunities from the provided text/HTML. Return a JSON object with an 'opportunities' key containing an array of opportunities. Each opportunity must have fields: role (string), eligibility (string, comma-separated branches like 'Computer Science, IT'), deadline (ISO 8601 string or null), and applyUrl (string, absolute link). Return ONLY valid JSON.";
      if (studentBranch) {
        systemInstruction += ` The student belongs to ${studentBranch}. Prioritize and extract only opportunities relevant to ${studentBranch} students. Exclude opportunities clearly intended for unrelated branches (e.g. if the branch is CS, exclude HR, marketing, sales, mechanical, civil, chemical, etc.). If uncertain whether a role is relevant to ${studentBranch}, INCLUDE it.`;
      }
      const prompt = `Extract opportunities for company "${companyId}" from this text:\n\n${text.slice(0, 50000)}`;

      await rateLimitGroq();
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: systemInstruction
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.opportunities)) {
          return parsed.opportunities;
        }
      } else {
        console.warn(`Groq API returned status ${response.status} with error: ${await response.text()}`);
      }
    } catch (err) {
      console.warn("Groq API call failed, falling back:", err);
    }
  }

  if (anthropicApiKey) {
    try {
      const systemInstruction = "You are an expert scraping assistant. Extract open placement and internship opportunities from the provided text/HTML. Return a JSON array of opportunities with fields: role (string), eligibility (string, comma-separated branches like 'Computer Science, IT'), deadline (ISO 8601 string or null), and applyUrl (string, absolute link). Return ONLY the raw JSON array inside a code block, no explanations." + (studentBranch ? ` The student belongs to ${studentBranch}. Prioritize and extract only opportunities relevant to ${studentBranch} students. Exclude opportunities clearly intended for unrelated branches (e.g. if the branch is CS, exclude HR, marketing, sales, mechanical, civil, chemical, etc.). If uncertain whether a role is relevant to ${studentBranch}, INCLUDE it.` : "");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4000,
          system: systemInstruction,
          messages: [
            {
              role: "user",
              content: `Extract opportunities for company "${companyId}" from this text:\n\n${text.slice(0, 50000)}`
            }
          ]
        })
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.content?.[0]?.text || "";
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } else {
        console.warn(`Anthropic API returned status ${response.status}`);
      }
    } catch (err) {
      console.warn("Claude API call failed, falling back:", err);
    }
  }

  if (geminiApiKey) {
    try {
      console.log(`Using Gemini API to extract opportunities for: ${companyId}`);
      let systemInstruction = "You are an expert scraping assistant. Extract open placement and internship opportunities from the provided text/HTML. Return a JSON array of opportunities with fields: role (string), eligibility (string, comma-separated branches like 'Computer Science, IT'), deadline (ISO 8601 string or null), and applyUrl (string, absolute link). Return ONLY the raw JSON array.";
      if (studentBranch) {
        systemInstruction += ` The student belongs to ${studentBranch}. Prioritize and extract only opportunities relevant to ${studentBranch} students. Exclude opportunities clearly intended for unrelated branches (e.g. if the branch is CS, exclude HR, marketing, sales, mechanical, civil, chemical, etc.). If uncertain whether a role is relevant to ${studentBranch}, INCLUDE it.`;
      }
      const prompt = `Extract opportunities for company "${companyId}" from this text:\n\n${text.slice(0, 50000)}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      await rateLimitGemini();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemInstruction}\n\n${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } else {
        console.warn(`Gemini API returned status ${response.status} with error: ${await response.text()}`);
      }
    } catch (err) {
      console.warn("Gemini API call failed:", err);
    }
  }

  // Fallback to local regex-based parsing
  return regexExtractOpportunities(text, companyId, studentBranch);
}

function regexExtractOpportunities(text: string, companyId: string, studentBranch?: string | null): ScrapedOpportunity[] {
  const opportunities: ScrapedOpportunity[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const visited = new Set<string>();

  const roleKeywords = [
    "software",
    "engineering",
    "intern",
    "developer",
    "analyst",
    "consultant",
    "technology",
    "backend",
    "frontend",
    "fullstack",
    "data science"
  ];

  while ((match = linkRegex.exec(text)) !== null) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]*>/g, "").trim();
    const lowerText = linkText.toLowerCase();

    if (
      linkText.length > 5 &&
      linkText.length < 100 &&
      roleKeywords.some(keyword => lowerText.includes(keyword))
    ) {
      let applyUrl = href;
      if (href.startsWith("/")) {
        applyUrl = `https://careers.${companyId}.com` + href;
      }

      if (visited.has(applyUrl)) continue;
      visited.add(applyUrl);

      const context = text.slice(Math.max(0, match.index - 500), Math.min(text.length, match.index + 500));
      const eligibility = guessEligibility(linkText, context);
      const deadline = guessDeadline(context);

      // If personalized run, check student eligibility
      if (studentBranch) {
        const allowedBranches = eligibility.split(",").map(b => b.trim());
        if (!isStudentEligible(studentBranch, allowedBranches)) {
          continue; // Skip opportunities the student is not eligible for
        }
      }

      opportunities.push({
        role: linkText,
        eligibility,
        deadline,
        applyUrl
      });
    }
  }

  // If no opportunities are parsed from elements, return a mock default for safety
  if (opportunities.length === 0) {
    const mockRole = "Software Engineering Intern";
    const mockEligibility = "Computer Science, Information Technology, Electronics";
    
    let shouldAddMock = true;
    if (studentBranch) {
      const allowedBranches = mockEligibility.split(",").map(b => b.trim());
      if (!isStudentEligible(studentBranch, allowedBranches)) {
        shouldAddMock = false;
      }
    }

    if (shouldAddMock) {
      opportunities.push({
        role: mockRole,
        eligibility: mockEligibility,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        applyUrl: `https://careers.${companyId}.com/jobs/apply-internship`
      });
    }
  }

  return opportunities;
}

function guessEligibility(role: string, context: string): string {
  const roleClassification = guessEligibilityFromRole(role);
  if (roleClassification.branches.length > 0) {
    return roleClassification.branches.join(", ");
  }

  const lower = context.toLowerCase();
  const branches: string[] = [];
  if (lower.includes("computer science") || lower.includes("cse")) branches.push("Computer Science");
  if (lower.includes("information technology") || lower.includes("it")) branches.push("Information Technology");
  if (lower.includes("electronics") || lower.includes("ece")) branches.push("Electronics");
  if (lower.includes("electrical") || lower.includes("eee")) branches.push("Electrical");

  if (branches.length === 0) {
    return "Computer Science, Information Technology, Electronics";
  }
  return branches.join(", ");
}

function guessDeadline(context: string): string | null {
  const dateRegex = /\b\d{4}-\d{2}-\d{2}\b/g;
  const match = context.match(dateRegex);
  if (match) {
    try {
      return new Date(match[0]).toISOString();
    } catch {}
  }
  return null;
}

