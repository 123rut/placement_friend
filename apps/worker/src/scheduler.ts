import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { executePipeline } from "./index";
import { dispatchNotifications } from "./notifier";
import { pool } from "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables from root
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

const pollInterval = parseInt(process.env.SCRAPER_POLL_INTERVAL_MS || "3600000", 10);
const notifierEnabled = process.env.NOTIFIER_ENABLED !== "false";

let isShuttingDown = false;
let isCycleRunning = false;
let nextTimeoutId: NodeJS.Timeout | null = null;

async function runCycle() {
  if (isShuttingDown) return;
  isCycleRunning = true;
  console.log(`\n==========================================`);
  console.log(`[${new Date().toISOString()}] STARTING SCHEDULER CYCLE`);
  console.log(`==========================================`);
  
  const startTime = Date.now();
  try {
    // 1. Run Scraper Pipeline
    const summary = await executePipeline();
    const scrapeDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Scraper execution complete in ${scrapeDuration}s.`);
    
    // 2. Dispatch Notifications if enabled
    if (notifierEnabled) {
      console.log("Triggering notifications dispatch...");
      const noteSummary = await dispatchNotifications();
      console.log(`Notifications dispatched successfully:
      - Matched: ${noteSummary.studentsMatched}
      - Mock Emails: ${noteSummary.emailsDispatched}
      - Dashboard Alerts: ${noteSummary.dashboardAlertsDispatched}`);
    } else {
      console.log("Notifier is disabled in configuration. Skipping notifications.");
    }
  } catch (err) {
    console.error("Error occurred during scheduler cycle:", err);
  } finally {
    isCycleRunning = false;
    console.log(`==========================================`);
    console.log(`CYCLE COMPLETE. Next run in ${pollInterval / 1000}s.`);
    console.log(`==========================================`);
    
    if (isShuttingDown) {
      console.log("Shutdown requested during execution. Exiting now.");
      cleanupAndExit();
    } else {
      nextTimeoutId = setTimeout(runCycle, pollInterval);
    }
  }
}

function cleanupAndExit() {
  console.log("Closing database connection pool...");
  pool.end()
    .then(() => {
      console.log("Database connection pool closed successfully. Graceful shutdown complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error closing database connection pool:", err);
      process.exit(1);
    });
}

function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;
  if (nextTimeoutId) {
    clearTimeout(nextTimeoutId);
  }
  if (!isCycleRunning) {
    console.log("No active scheduler cycle running. Exiting immediately.");
    cleanupAndExit();
  } else {
    console.log("Active scheduler cycle running. Waiting for current run to finish...");
  }
}

// Register shutdown signals
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

// Start loop
console.log(`Scheduler daemon initialized:
- Poll interval: ${pollInterval}ms (${pollInterval / 1000}s)
- Notifier status: ${notifierEnabled ? "ENABLED" : "DISABLED"}
`);

runCycle();
export {};
