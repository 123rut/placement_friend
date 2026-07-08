import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DbModule } from "./db/db.module";
import { SyncModule } from "./sync/sync.module";
import { ResumeModule } from "./resume/resume.module";
import { JobsModule } from "./jobs/jobs.module";
import { AgentModule } from "./agent/agent.module";
import { CompaniesModule } from './companies/companies.module';

@Module({
  imports: [
    DbModule,
    SyncModule,
    ResumeModule,
    JobsModule,
    AgentModule,
    CompaniesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
