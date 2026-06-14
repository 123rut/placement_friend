import {
  incrementFailCount,
  updateScrapeStats,
  updateLastChecked as dbUpdateLastChecked
} from "./db";

/**
 * Log a scrape failure, increments count, and flags as url_stale if thresholds are met.
 */
export async function recordFailure(id: string, reason: string): Promise<void> {
  await incrementFailCount(id, reason);
  await dbUpdateLastChecked(id);
}

/**
 * Log a successful scrape, resetting failure counters and updating scrap counts.
 */
export async function recordSuccess(id: string, count: number): Promise<void> {
  await updateScrapeStats(id, count);
}

/**
 * Updates last checked timestamp at the start of any scrape.
 */
export async function updateLastChecked(id: string): Promise<void> {
  await dbUpdateLastChecked(id);
}
