import { fetchWithRetry } from "./fetch-retry";

export async function fetchGroqWithRotation(
  body: string,
  signal?: AbortSignal,
  maxRetriesPerKey = 2,
): Promise<Response> {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    throw new Error("No Groq API keys configured");
  }

  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[attempt];
    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };

    try {
      if (signal?.aborted) {
        throw new Error("AbortSignal already aborted");
      }

      console.log(`[Groq Rotation] Trying key ${attempt + 1}/${keys.length}...`);

      const res = await fetchWithRetry(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers,
          body,
          signal,
        },
        maxRetriesPerKey,
        1000,
      );

      if (res.status === 429) {
        lastResponse = res;
        console.warn(`[Groq Rotation] Key ${attempt + 1}/${keys.length} rate limited (429). Rotating...`);
        continue;
      }

      return res;
    } catch (error) {
      console.warn(
        `[Groq Rotation] Error on key ${attempt + 1}/${keys.length}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (attempt === keys.length - 1) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw new Error("All Groq keys rate limited.");
}
