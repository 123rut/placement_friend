import { Body, Controller, Get, InternalServerErrorException, Param, Post } from "@nestjs/common";
import { AgentChatResponse } from "../careerpilot.types";
import { AgentService } from "./agent.service";

@Controller("agent")
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post("chat")
  async chat(
    @Body("userId") userId: string,
    @Body("message") message: string,
    @Body("conversationId") conversationId?: string,
  ): Promise<AgentChatResponse | { error: string }> {
    if (!userId || !message) {
      return { error: "userId and message are required" };
    }

    try {
      return await this.agentService.chat(userId, message, conversationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new InternalServerErrorException(`CareerPilot agent failed: ${message}`);
    }
  }

  @Get("conversations/:userId")
  async getConversations(@Param("userId") userId: string): Promise<Record<string, unknown>[]> {
    return this.agentService.getConversations(userId);
  }
}
