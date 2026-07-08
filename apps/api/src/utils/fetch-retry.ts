export const sleep = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

const maxDelayMs = 15000;

/**
 * Calculates the next backoff delay in milliseconds using exponential growth capped at maxDelayMs,
 * with a 50%-100% randomized jitter factor added to avoid thundering herd issues.
 */
function nextDelay(current: number): number {
  const base = Math.min(current * 2, maxDelayMs);
  const jitter = base * (0.5 + Math.random() * 0.5); // 50–100% of base
  return Math.min(jitter, maxDelayMs);
}

/**
 * Checks if a thrown exception is safe/retryable.
 * Retries are allowed for network-level failures (TypeError in fetch) and local timeouts.
 * Programming errors (e.g. ReferenceError, SyntaxError) are thrown immediately.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "TimeoutError") return true;
  if (error instanceof TypeError) return true;
  return false;
}

/**
 * A sleep helper that resolves immediately if the abort signal triggers during the wait time.
 */
function sleepOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return sleep(ms);
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason || new DOMException("The user aborted a request.", "AbortError"));
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException("The user aborted a request.", "AbortError"));
    };

    timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Fetches a URL with a retry policy (Max retries, exponential backoff with jitter).
 * Retries on:
 * - Transient HTTP response status codes: Rate limits (429) or Server errors (500+).
 * - Retryable network/timeout exceptions (TypeError or DOMException TimeoutError).
 * 
 * Throws a final error once max attempts are reached without a successful response.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit & { signal?: AbortSignal; timeoutMs?: number },
  maxRetries = 3,
  initialDelayMs = 1500,
): Promise<Response> {
  const { signal: parentSignal, timeoutMs: attemptTimeout, ...fetchOptions } = init || {};
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    // 1. Immediate exit if parent signal has already aborted
    if (parentSignal?.aborted) {
      throw parentSignal.reason || new DOMException("The user aborted a request.", "AbortError");
    }

    // 2. Create a fresh controller for this specific attempt
    const localController = new AbortController();

    // 3. Link parent signal to the local attempt controller
    let onParentAbort: (() => void) | null = null;
    if (parentSignal) {
      onParentAbort = () => {
        localController.abort(parentSignal.reason || new DOMException("The user aborted a request.", "AbortError"));
      };
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }

    // 4. Set a timeout for this specific attempt (if specified)
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (attemptTimeout) {
      timeoutId = setTimeout(() => {
        localController.abort(new DOMException(`Request timed out after ${attemptTimeout}ms`, "TimeoutError"));
      }, attemptTimeout);
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: localController.signal,
      });

      const isTransient = response.status >= 500 && response.status <= 599;
      if (isTransient) {
        if (attempt === maxRetries) {
          throw new Error(`Request to ${url} failed with status ${response.status} after ${maxRetries} attempts`);
        }
        console.warn(`[fetchWithRetry] HTTP ${response.status} on attempt ${attempt} for ${url}. Retrying in ${Math.round(delay)}ms...`);
        await sleepOrAbort(delay, parentSignal);
        delay = nextDelay(delay);
        continue;
      }

      return response;
    } catch (error: any) {
      // 5. If the parent signal was the reason for the abort, do NOT retry
      if (parentSignal?.aborted) {
        throw error;
      }

      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      console.warn(
        `[fetchWithRetry] Retryable error on attempt ${attempt} for ${url}: ${error?.message || String(error)}. Retrying in ${Math.round(delay)}ms...`,
      );
      await sleepOrAbort(delay, parentSignal);
      delay = nextDelay(delay);
    } finally {
      // Clean up listeners and timeouts
      if (parentSignal && onParentAbort) {
        parentSignal.removeEventListener("abort", onParentAbort);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  throw new Error("Max retries reached without response");
}
