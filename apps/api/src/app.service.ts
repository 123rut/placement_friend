import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: "CareerPilot API",
      status: "ok",
      endpoints: [
        "/api/resume/parse",
        "/api/jobs/search",
        "/api/jobs/match",
        "/api/agent/chat",
        "/api/worker/sync",
      ],
    };
  }
}
