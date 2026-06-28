import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { rateLimitGemini, rateLimitGroq } from "./rateLimiter";
import { guessEligibilityFromRole, isStudentEligible, isGeneralCareersUrl, isGenericRoleName } from "./validator";
import { fetchWithTimeout } from "./fetchWithTimeout";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

/**
 * Strips non-content tags from HTML before sending to LLM.
 * Removes scripts, styles, nav, header, footer, noscript and comments.
 * Expected to reduce token count by ~60-70%.
 */
/**
 * Aggressively extracts only job-relevant text + links from HTML.
 * Drops all tag markup, attributes, scripts, styles, etc.
 * Reduces token count by ~85-95% vs raw HTML.
 */
function cleanHtmlForAI(html: string): string {
  // 1. Remove entire noisy blocks
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<picture[\s\S]*?<\/picture>/gi, "")
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, "")
    .replace(/<video[\s\S]*?<\/video>/gi, "")
    .replace(/<audio[\s\S]*?<\/audio>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // 2. Extract href + text from anchor tags BEFORE stripping all tags
  //    Preserves applyUrl info in a compact format the LLM can read
  html = html.replace(
    /<a[\s\S]*?href=["']([^"']+)["'][\s\S]*?>([\s\S]*?)<\/a>/gi,
    (_, href, inner) => {
      const text = inner.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      if (!text) return "";
      return `[${text}](${href}) `;
    }
  );

  // 3. Strip all remaining HTML tags
  html = html.replace(/<[^>]{1,300}>/g, " ");

  // 4. Decode common HTML entities
  html = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ");

  // 5. Collapse whitespace
  html = html.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // 6. Hard cap — LLMs rarely need more than ~12k chars to find job listings
  return html.slice(0, 12000);
}

/**
 * Parses the retry-after duration from a Groq 429 error message.
 * e.g. "Please try again in 13.26s" → 16 (ceil + 2s buffer)
 */
function parseRetryAfter(errorText: string): number {
  const match = errorText.match(/try again in ([\d.]+)s/);
  return match ? Math.ceil(parseFloat(match[1])) + 2 : 15;
}

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
  studentBranch?: string | null,
  careersUrl?: string | null
): Promise<ScrapedOpportunity[]> {
  // Clean HTML before sending to any LLM — strips scripts, styles, nav, etc.
  const rawLen = text.length;
  text = cleanHtmlForAI(text);
  console.log(`[${companyId}] HTML cleanup: ${rawLen} → ${text.length} chars`);
  // Collect all available Groq keys — rotate through them on 429 to triple effective TPM
  const groqKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ].filter(Boolean) as string[];
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Fix 2: Skip LLM entirely when the page has no job-related keywords.
  // Saves ~2,000 tokens per empty landing page (Accenture, Bosch, Deloitte, etc.)
  const JOB_SIGNAL = /intern|engineer|developer|analyst|scientist|architect|consultant|associate|graduate|placement/i;
  if (!JOB_SIGNAL.test(text)) {
    console.log(`[${companyId}] No job signals in page — skipping LLM call`);
    return [];
  }

  if (groqKeys.length > 0) {
    // Compact system prompt (~80 tokens vs ~500 previously)
    const systemInstruction = `Extract job postings from HTML/text. Return JSON: {"opportunities":[{"role":"string","eligibility":"string","deadline":"ISO8601|null","applyUrl":"string"}]}
Rules: only specific roles (e.g. "SWE Intern"), not categories. applyUrl must be a direct job link, not a careers homepage. Empty array if none found.${studentBranch ? ` Only include roles relevant to ${studentBranch}.` : ""}`;

    // 6k char cap + truncate long URLs that waste tokens
    const compactText = text
      .replace(/https?:\/\/[^\s)]{50,}/g, url => url.slice(0, 50) + "\u2026")
      .slice(0, 6000);
    const prompt = `Company: ${companyId}\n\n${compactText}`;

    const groqBody = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    // Try each key in sequence — on 429 rotate to the next key immediately
    for (let i = 0; i < groqKeys.length; i++) {
      const key = groqKeys[i];
      try {
        console.log(`Using Groq API (key ${i + 1}/${groqKeys.length}) for: ${companyId}`);
        await rateLimitGroq();
        const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
          body: groqBody,
          timeout: 30000
        });

        if (response.status === 429) {
          const errText = await response.text();
          if (i < groqKeys.length - 1) {
            // More keys available — rotate immediately, no wait needed
            console.log(`[Groq key ${i + 1}] Rate limited — rotating to key ${i + 2}`);
            continue;
          }
          // Last key also hit 429 — parse wait and retry this key once before falling to Gemini
          const waitSecs = parseRetryAfter(errText);
          console.log(`[Groq] All keys rate limited. Waiting ${waitSecs}s then retrying key 1...`);
          await new Promise(r => setTimeout(r, waitSecs * 1000));
          await rateLimitGroq();
          const retryResponse = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKeys[0]}`, "Content-Type": "application/json" },
            body: groqBody,
            timeout: 30000
          });
          if (retryResponse.ok) {
            const json = await retryResponse.json();
            const content = json.choices?.[0]?.message?.content || "";
            const parsed = JSON.parse(content);
            if (parsed && Array.isArray(parsed.opportunities)) return parsed.opportunities;
          }
          break; // Fall through to next provider
        }

        if (response.ok) {
          const json = await response.json();
          const content = json.choices?.[0]?.message?.content || "";
          const parsed = JSON.parse(content);
          if (parsed && Array.isArray(parsed.opportunities)) return parsed.opportunities;
          break; // Parsed but no opportunities array — don't retry other keys
        } else {
          console.warn(`[Groq key ${i + 1}] Returned status ${response.status}`);
          break; // Non-429 error (400/500) — won't be fixed by rotating keys
        }
      } catch (err) {
        console.warn(`[Groq key ${i + 1}] Call failed:`, err);
        break;
      }
    }
  }

  if (anthropicApiKey) {
    try {
      // Fix 1: compact system prompt
      const systemInstruction = `Extract job postings from HTML/text. Return a JSON array: [{"role":"string","eligibility":"string","deadline":"ISO8601|null","applyUrl":"string"}]
Rules: only specific roles (e.g. "SWE Intern"), not categories. applyUrl must be a direct job link. Empty array if none found. Return ONLY the raw JSON array.${studentBranch ? ` Only include roles relevant to ${studentBranch}.` : ""}`;

      // Fix 3: 6k char cap + truncate long URLs
      const compactText = text
        .replace(/https?:\/\/[^\s)]{50,}/g, url => url.slice(0, 50) + "\u2026")
        .slice(0, 6000);
      const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
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
              content: `Company: ${companyId}\n\n${compactText}`
            }
          ]
        }),
        timeout: 30000
      });

      if (response.ok) {
        const json = await response.json();
        const rawText = json.content?.[0]?.text ?? "";
        const content = typeof rawText === "string" ? rawText : "";
        if (!content) {
          console.warn(`[${companyId}] Claude returned empty/null response. Skipping.`);
          return [];
        }
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
      // Fix 1: compact system prompt
      const systemInstruction = `Extract job postings from HTML/text. Return a JSON array: [{"role":"string","eligibility":"string","deadline":"ISO8601|null","applyUrl":"string"}]
Rules: only specific roles (e.g. "SWE Intern"), not categories. applyUrl must be a direct job link. Empty array if none found. Return ONLY the raw JSON array.${studentBranch ? ` Only include roles relevant to ${studentBranch}.` : ""}`;

      // Fix 3: 6k char cap + truncate long URLs
      const compactText = text
        .replace(/https?:\/\/[^\s)]{50,}/g, url => url.slice(0, 50) + "\u2026")
        .slice(0, 6000);
      const prompt = `Company: ${companyId}\n\n${compactText}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      await rateLimitGemini();
      const response = await fetchWithTimeout(url, {
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
        }),
        timeout: 30000
      });

      if (response.ok) {
        const json = await response.json();
        // Guard against null candidates (safety-blocked or empty response from Gemini)
        const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
        const rawText = candidates[0]?.content?.parts?.[0]?.text ?? "";
        const content = typeof rawText === "string" ? rawText : "";
        if (!content) {
          console.warn(`[${companyId}] Gemini returned empty/null response. Skipping.`);
          return [];
        }
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
  return regexExtractOpportunities(text, companyId, studentBranch, careersUrl);
}

function regexExtractOpportunities(
  text: string,
  companyId: string,
  studentBranch?: string | null,
  careersUrl?: string | null
): ScrapedOpportunity[] {
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
        const base = careersUrl ? new URL(careersUrl).origin : `https://careers.${companyId}.com`;
        applyUrl = base + href;
      }

      if (visited.has(applyUrl)) continue;
      visited.add(applyUrl);

      // Filter out general career landing pages or generic role names
      if (isGeneralCareersUrl(applyUrl, careersUrl) || isGenericRoleName(linkText)) {
        continue;
      }

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
    } catch { }
  }
  return null;
}

