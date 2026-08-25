import { fetchGroqWithRotation } from "../utils/groq-keys";
import { fetchWithRetry } from "../utils/fetch-retry";

export interface JobTranslationResult {
  translated: boolean;
  title: string;
  description: string;
  detectedLanguage?: string;
}

export class JobTranslator {
  static async translateToEnglish(
    title: string,
    description: string,
    company?: string,
  ): Promise<JobTranslationResult> {
    const rawTitle = (title || "").trim();
    const rawDesc = (description || "").trim();

    if (!rawTitle) {
      return { translated: false, title: rawTitle, description: rawDesc };
    }

    const descExcerpt = rawDesc.slice(0, 1200);

    const prompt = `Translate the following international/foreign language job posting into professional English.
Job Title: ${rawTitle}
Company: ${company || "Unknown"}
Description Excerpt: ${descExcerpt}

Instructions:
1. Translate the job title and description accurately and professionally into English.
2. If the title is already in English, keep it as is.
3. Return JSON only in this format:
{
  "title": "English translated title",
  "description": "English translated description excerpt",
  "detectedLanguage": "Language name or code"
}`;

    // 1. Try Groq with key rotation
    const hasGroqKeys = !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3);
    if (hasGroqKeys) {
      try {
        const body = JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 500,
        });

        const res = await fetchGroqWithRotation(body, AbortSignal.timeout(15000));
        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
          if (typeof parsed.title === "string" && parsed.title.trim()) {
            return {
              translated: true,
              title: parsed.title.trim(),
              description: typeof parsed.description === "string" && parsed.description.trim() ? parsed.description.trim() : rawDesc,
              detectedLanguage: String(parsed.detectedLanguage || "Foreign"),
            };
          }
        }
      } catch (err: any) {
        console.warn(`[JobTranslator] Groq translation failed for "${rawTitle}":`, err.message);
      }
    }

    // 2. Try Gemini fallback
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const res = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
            signal: AbortSignal.timeout(15000),
          },
          1,
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (typeof parsed.title === "string" && parsed.title.trim()) {
              return {
                translated: true,
                title: parsed.title.trim(),
                description: typeof parsed.description === "string" && parsed.description.trim() ? parsed.description.trim() : rawDesc,
                detectedLanguage: String(parsed.detectedLanguage || "Foreign"),
              };
            }
          }
        }
      } catch (err: any) {
        console.warn(`[JobTranslator] Gemini translation failed for "${rawTitle}":`, err.message);
      }
    }

    return { translated: false, title: rawTitle, description: rawDesc };
  }
}
