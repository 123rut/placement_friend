import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { JobMatchResult, JobSearchResult } from "../careerpilot.types";
import { JobsService } from "./jobs.service";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** POST /api/jobs/search — semantic job search */
  @Post("search")
  async search(
    @Body("query") query: string,
    @Body("location") location?: string,
    @Body("employmentType") employmentType?: string,
    @Body("earlyCareerOnly") earlyCareerOnly?: boolean,
    @Body("limit") limit?: number
  ): Promise<{ count: number; results: JobSearchResult[] } | { error: string }> {
    if (!query) return { error: "query is required" };
    const results = await this.jobsService.searchJobs(query, { location, employmentType, earlyCareerOnly, limit });
    return { count: results.length, results };
  }

  /** POST /api/jobs/match — match a specific job to a user's profile */
  @Post("match")
  async matchJob(@Body("jobId") jobId: string, @Body("userId") userId: string): Promise<JobMatchResult | { error: string }> {
    if (!jobId || !userId) return { error: "jobId and userId are required" };
    return this.jobsService.matchJobToProfile(jobId, userId);
  }

  /** GET /api/jobs/matches/:userId — get all cached matches for a user */
  @Get("matches/:userId")
  async getMatches(@Param("userId") userId: string, @Query("limit") limit?: string): Promise<Record<string, unknown>[]> {
    return this.jobsService.getTopMatches(userId, limit ? parseInt(limit) : 20);
  }
}
