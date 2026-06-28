import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CandidateProfileRecord } from "../careerpilot.types";
import { ResumeService } from "./resume.service";

@Controller("resume")
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  /**
   * POST /api/resume/parse
   * Upload PDF or DOCX resume — extracts, embeds and stores candidate profile.
   * Body: multipart/form-data { file, userId }
   */
  @Post("parse")
  @UseInterceptors(FileInterceptor("file"))
  async parseResume(
    @UploadedFile() file: Express.Multer.File,
    @Body("userId") userId: string
  ): Promise<Record<string, unknown>> {
    if (!file) throw new BadRequestException("No file uploaded");
    if (!userId) throw new BadRequestException("userId is required");

    try {
      const { profileId, profile } = await this.resumeService.parseAndStore(
        file.buffer,
        file.mimetype,
        userId
      );

      return {
        success: true,
        profileId,
        skillsExtracted: profile.skills.length,
        experienceRoles: profile.experience.length,
        profile,
      };
    } catch (error) {
      throw new InternalServerErrorException(this.toResumeErrorMessage(error));
    }
  }

  /**
   * GET /api/resume/:userId
   * Fetch stored candidate profile for a user.
   */
  @Get(":userId")
  async getProfile(@Param("userId") userId: string): Promise<CandidateProfileRecord | { error: string }> {
    try {
      const profile = await this.resumeService.getProfile(userId);
      if (!profile) return { error: "Profile not found" };
      return profile;
    } catch (error) {
      throw new InternalServerErrorException(this.toResumeErrorMessage(error));
    }
  }

  private toResumeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("candidate_profiles")) {
      return "CareerPilot database schema is incomplete. Run infra/migrate-careerpilot.sql.";
    }

    if (
      message.includes("connect EACCES") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("timeout expired")
    ) {
      return "CareerPilot database connection failed. Check DATABASE_URL and Supabase connectivity.";
    }

    return `Resume processing failed: ${message}`;
  }
}
