export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
  maxRetries = 3,
  initialDelayMs = 1500,
): Promise<Response> {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      if (init?.signal?.aborted) {
        throw new Error("AbortSignal already aborted");
      }

      const response = await fetch(url, init);

      if (response.status === 429) {
        if (attempt === maxRetries) {
          return response;
        }
        console.warn(`[fetchWithRetry] HTTP 429 (Rate Limit) on attempt ${attempt} for ${url}. Retrying in ${delay}ms...`);
        await sleep(delay);
        delay *= 2;
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.warn(
        `[fetchWithRetry] Error on attempt ${attempt} for ${url}: ${error instanceof Error ? error.message : String(error)}. Retrying in ${delay}ms...`,
      );
      await sleep(delay);
      delay *= 2;
    }
  }

  throw new Error("Max retries reached without response");
}
