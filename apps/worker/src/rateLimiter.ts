import { URL } from "url";

const GLOBAL_MAX_CONCURRENCY = 5;
let activeGlobalRequests = 0;

const activeDomains = new Set<string>();
const waitingQueue: Array<{
  domain: string;
  resolve: () => void;
}> = [];

export function getDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.hostname;
  } catch {
    return "unknown";
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function acquireDomainSlot(domain: string): Promise<void> {
  while (activeGlobalRequests >= GLOBAL_MAX_CONCURRENCY || activeDomains.has(domain)) {
    await new Promise<void>((resolve) => {
      waitingQueue.push({ domain, resolve });
    });
  }

  activeGlobalRequests++;
  activeDomains.add(domain);
}

export function releaseDomainSlot(domain: string): void {
  activeGlobalRequests--;
  activeDomains.delete(domain);

  // Wake up eligible waiting promises in queue
  for (let i = 0; i < waitingQueue.length; i++) {
    const next = waitingQueue[i];
    if (activeGlobalRequests < GLOBAL_MAX_CONCURRENCY && !activeDomains.has(next.domain)) {
      waitingQueue.splice(i, 1);
      next.resolve();
      break; // Resolve one at a time to check conditions in next loop
    }
  }
}

export async function delayBetweenRequests(): Promise<void> {
  const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
  await sleep(delay);
}

let lastGeminiRequestTime = 0;
const GEMINI_MIN_INTERVAL_MS = Math.ceil(60000 / 14); // ~4286 ms to guarantee at most 14 requests per minute

export async function rateLimitGemini(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastGeminiRequestTime;
  if (timeSinceLastCall < GEMINI_MIN_INTERVAL_MS) {
    const delay = GEMINI_MIN_INTERVAL_MS - timeSinceLastCall;
    await sleep(delay);
  }
  lastGeminiRequestTime = Date.now();
}

let lastGroqRequestTime = 0;
const GROQ_MIN_INTERVAL_MS = 2000; // 2 seconds (max 30 requests per minute)

export async function rateLimitGroq(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastGroqRequestTime;
  if (timeSinceLastCall < GROQ_MIN_INTERVAL_MS) {
    const delay = GROQ_MIN_INTERVAL_MS - timeSinceLastCall;
    await sleep(delay);
  }
  lastGroqRequestTime = Date.now();
}


