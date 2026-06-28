import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { SyncResult } from "../careerpilot.types";
import { SyncService } from "./sync.service";

@Controller("worker/sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /** POST /api/worker/sync — trigger full sync for all active companies */
  @Post()
  async syncAll(
    @Body("userId") userId?: string,
  ): Promise<{ success: number; failed: number; results: SyncResult[] }> {
    const results = await this.syncService.syncAll(userId);
    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;
    return { success, failed, results };
  }

  /** POST /api/worker/sync/:companyId — trigger sync for one company */
  @Post(":companyId")
  async syncOne(@Param("companyId") companyId: string): Promise<SyncResult | { error: string }> {
    const companies = await this.syncService.getCompanies(false);
    const company = companies.find((c: any) => c.id === companyId);
    if (!company) return { error: `Company ${companyId} not found` };
    return this.syncService.syncCompany(company);
  }

  /** GET /api/worker/sync/logs — sync history */
  @Get("logs")
  async getLogs(): Promise<Record<string, unknown>[]> {
    return this.syncService.getSyncLogs();
  }

  /** GET /api/worker/sync/companies — list all companies with ATS info */
  @Get("companies")
  async getCompanies(): Promise<Record<string, unknown>[]> {
    return this.syncService.getCompanies(false);
  }
}
