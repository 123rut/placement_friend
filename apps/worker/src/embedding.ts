/**
 * CareerPilot AI — Gemini Embedding Service
 * 
 * Uses Gemini text-embedding-004 (768 dimensions, free tier).
 * Used for both job descriptions and candidate profiles.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

/**
 * Generate a 768-dim embedding vector for a text string.
 * Returns null on failure (don't crash the whole sync for one bad job).
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!GEMINI_API_KEY) {
    console.warn("[Embedding] GEMINI_API_KEY not set — skipping embedding.");
    return null;
  }

  // Cap at ~8000 chars to stay within token limits
  const truncated = text.slice(0, 8000);

  try {
    const response = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: truncated }] },
        taskType: "RETRIEVAL_DOCUMENT"
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`[Embedding] Gemini returned HTTP ${response.status}: ${err.slice(0, 100)}`);
      return null;
    }

    const data = await response.json();
    return data.embedding?.values || null;
  } catch (err: any) {
    console.warn(`[Embedding] Failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate a query embedding (for semantic search at query time).
 * Uses RETRIEVAL_QUERY task type — different from RETRIEVAL_DOCUMENT.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!GEMINI_API_KEY) return null;

  try {
    const response = await fetch(EMBEDDING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: text.slice(0, 2000) }] },
        taskType: "RETRIEVAL_QUERY"
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.embedding?.values || null;
  } catch {
    return null;
  }
}

/**
 * Build a rich text string from a candidate profile for embedding.
 */
export function buildProfileEmbeddingText(profile: {
  skills: string[];
  experience: Array<{ role: string; company: string; description: string }>;
  education: Array<{ degree: string; branch: string; college: string }>;
  projects: Array<{ name: string; tech: string[]; description: string }>;
}): string {
  const parts: string[] = [];

  if (profile.skills.length > 0) {
    parts.push(`Skills: ${profile.skills.join(", ")}`);
  }

  for (const exp of profile.experience) {
    parts.push(`Experience: ${exp.role} at ${exp.company}. ${exp.description}`);
  }

  for (const edu of profile.education) {
    parts.push(`Education: ${edu.degree} in ${edu.branch} from ${edu.college}`);
  }

  for (const proj of profile.projects) {
    parts.push(`Project: ${proj.name} using ${proj.tech.join(", ")}. ${proj.description}`);
  }

  return parts.join("\n\n");
}
