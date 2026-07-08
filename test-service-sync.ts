import { NestFactory } from "@nestjs/core";
import { AppModule } from "./apps/api/src/app.module";
import { SyncService } from "./apps/api/src/sync/sync.service";

async function run() {
  console.log("Bootstrapping NestJS application context...");
  const app = await NestFactory.createApplicationContext(AppModule);
  const syncService = app.get(SyncService);
  
  // Patch getCompanies to only return the first 3 companies for testing speed
  const originalGetCompanies = syncService.getCompanies.bind(syncService);
  syncService.getCompanies = async (activeOnly) => {
    const all = await originalGetCompanies(activeOnly);
    console.log(`[Test Patch] Original active companies count: ${all.length}. Slicing to first 3 for fast verification.`);
    return all.slice(0, 3);
  };
  
  const userId = '8eacbdf4-62b4-4d8e-8906-286e3e1faee7';
  console.log(`Calling syncAll for user: ${userId}...`);
  
  const start = Date.now();
  const res = await syncService.syncAll(userId);
  const duration = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log(`\nSync completed in ${duration}s.`);
  console.log(`Results length: ${res.length}`);
  console.log("Results summary:", JSON.stringify(res.map(r => ({
    companyName: r.companyName,
    status: r.status,
    jobsFound: r.jobsFound,
    jobsNew: r.jobsNew,
    error: r.error
  })), null, 2));
  
  await app.close();
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
