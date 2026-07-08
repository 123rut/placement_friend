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

    // Create a fresh local controller for this attempt
    const attemptController = new AbortController();

    // Link parent abort signal to this attempt's controller
    let onParentAbort: (() => void) | null = null;
    if (signal) {
      if (signal.aborted) {
        throw signal.reason || new DOMException("The user aborted a request.", "AbortError");
      }
      onParentAbort = () => {
        attemptController.abort(signal.reason || new DOMException("The user aborted a request.", "AbortError"));
      };
      signal.addEventListener("abort", onParentAbort, { once: true });
    }

    // Set an independent timeout budget of 10 seconds for this key
    const attemptTimeout = setTimeout(() => {
      attemptController.abort(new DOMException("Groq API key attempt timed out after 10000ms", "TimeoutError"));
    }, 10000);

    try {
      console.log(`[Groq Rotation] Trying key ${attempt + 1}/${keys.length}...`);

      const res = await fetchWithRetry(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers,
          body,
          signal: attemptController.signal,
        },
        maxRetriesPerKey,
        1000,
      );

      if (!res.ok) {
        let errorDetails = "";
        try {
          errorDetails = await res.text();
        } catch {
          errorDetails = "Failed to read response body";
        }

        console.error(
          `[Groq Rotation] Key ${attempt + 1}/${keys.length}\n` +
          `Status: ${res.status}\n` +
          `Reason: ${errorDetails.slice(0, 500)}\n` +
          `Rotating to next key...`
        );

        if (res.status === 429 || res.status === 401 || res.status === 403) {
          lastResponse = res;
          continue;
        }

        // For other non-success codes, we also rotate
        lastResponse = res;
        continue;
      }

      return res;
    } catch (error: any) {
      console.error(
        `[Groq Rotation] Exception on key ${attempt + 1}/${keys.length}: ${error?.message || String(error)}`
      );

      // If the parent operation signal was the cause of abort, exit immediately
      if (signal?.aborted) {
        throw error;
      }

      if (attempt === keys.length - 1) {
        throw error;
      }
    } finally {
      clearTimeout(attemptTimeout);
      if (signal && onParentAbort) {
        signal.removeEventListener("abort", onParentAbort);
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw new Error("All Groq keys failed or were rate limited.");
}
