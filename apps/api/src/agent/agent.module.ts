import { Module } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { JobsModule } from "../jobs/jobs.module";
import { ResumeModule } from "../resume/resume.module";

@Module({
  imports: [JobsModule, ResumeModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
