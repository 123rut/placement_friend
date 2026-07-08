import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { AgentChatResponse, ConversationMessage } from "../careerpilot.types";
import { DB_POOL } from "../db/db.module";
import { JobsService } from "../jobs/jobs.service";
import { ResumeService } from "../resume/resume.service";
import { fetchWithRetry } from "../utils/fetch-retry";
import { fetchGroqWithRotation } from "../utils/groq-keys";

type AgentToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type AgentTool = {
  definition: AgentToolDefinition;
  execute: (args: Record<string, unknown>, userId: string) => Promise<unknown>;
};

const TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_resume",
      description: "Read the candidate profile from the database. Use only when the user's profile, resume, experience, goals, or saved preferences are needed.",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string", description: "The user's UUID" },
        },
        required: ["userId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_jobs",
      description: "Search jobs using the existing job cache and semantic matching when embeddings exist.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          location: { type: "string" },
          employmentType: { type: "string", enum: ["fulltime", "internship", "contract"] },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compute_match",
      description: "Compute a job match score for a specific job and candidate.",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string" },
          jobId: { type: "string" },
        },
        required: ["userId", "jobId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_skill_gap",
      description: "Identify missing skills for a target role and propose a short roadmap.",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string" },
          targetRole: { type: "string" },
        },
        required: ["userId", "targetRole"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are CareerPilot, an AI career assistant for software engineers.

Voice:
- Sound like a thoughtful career coach, not a database report.
- Use natural, encouraging language without overpromising.
- Start with the user's situation, then give the best options and next step.
- Avoid exposing internal tool names, endpoint names, raw JSON, or implementation details.

Workflow rules:
1. Decide whether tools are needed from the user's actual intent. Do not run a fixed pipeline.
2. For general technical questions, explanations, definitions, and casual conversation, answer directly without tools.
3. Use read_resume only when the user's profile is needed, such as resume review, career advice, personalized preparation, skill gaps, or job fit.
4. Use search_jobs only when the user is actually looking for jobs or opportunities.
5. Use compute_match only after search_jobs returns candidate jobs or the user gives a specific job id.
6. Use get_skill_gap only when the user asks about gaps, roadmaps, improvement, or after evaluating a specific target role.
7. After tool results, continue reasoning and either call another useful tool or produce the final answer.
8. Keep answers practical, concise, and specific.
9. If a tool returns null or an error, explain the missing prerequisite and continue helpfully instead of pretending the tool succeeded.
10. Never say that you searched jobs, scored matches, or read a resume unless a tool result in the conversation shows that happened.
11. When recommending jobs, you MUST format each job using this exact structure:
- [<title>](<url>) at <company> <!-- fit-id: <id> -->

Rules:
- If "url" is missing or empty for a job, render the title as plain text (no brackets/link).
- Never print or display any UUIDs, requisition codes, or job numbers (such as Job ID, System ID, or Job Code) in plain visible text.
- Always include the comment `<!-- fit-id: <id> -->` exactly as shown at the end of each recommended job line if the id exists.
- Never invent, guess, or fabricate a URL. Only use values provided in the retrieved job data.`;

@Injectable()
export class AgentService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly jobsService: JobsService,
    private readonly resumeService: ResumeService,
  ) { }

  private readonly tools: Record<string, AgentTool> = {
    read_resume: {
      definition: TOOL_DEFINITIONS[0],
      execute: async (_args, userId) => this.resumeService.getProfile(userId),
    },
    search_jobs: {
      definition: TOOL_DEFINITIONS[1],
      execute: async (args) =>
        this.jobsService.searchJobs(String(args.query || ""), {
          location: typeof args.location === "string" ? args.location : undefined,
          employmentType: typeof args.employmentType === "string" ? args.employmentType : undefined,
          limit: typeof args.limit === "number" ? args.limit : 5,
        }),
    },
    compute_match: {
      definition: TOOL_DEFINITIONS[2],
      execute: async (args, userId) => this.jobsService.matchJobToProfile(String(args.jobId || ""), userId),
    },
    get_skill_gap: {
      definition: TOOL_DEFINITIONS[3],
      execute: async (args, userId) => this.jobsService.analyzeSkillGap(userId, String(args.targetRole || "")),
    },
  };

  async chat(userId: string, userMessage: string, conversationId?: string): Promise<AgentChatResponse> {
    const conversation = await this.loadOrCreateConversation(userId, conversationId);
    const messages = [...conversation.messages];
    messages.push({ role: "user", content: userMessage, timestamp: new Date().toISOString() });

    let reply: { reply: string; toolsUsed: string[] };
    try {
      const mode = process.env.CAREERPILOT_AGENT_MODE || "llm";
      if (mode === "llm" && (process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3)) {
        reply = await this.runGroqPlanner(userId, userMessage, messages);
      } else if (mode === "llm" && process.env.GEMINI_API_KEY) {
        reply = await this.runGeminiPlanner(userId, userMessage, messages);
      } else {
        reply = this.runNoToolFallback(userMessage);
      }
    } catch (err) {
      console.error("Agent planner error, falling back to no-tool response:", err);
      reply = this.runNoToolFallback(userMessage);
    }

    messages.push({ role: "assistant", content: reply.reply, timestamp: new Date().toISOString() });
    await this.saveConversation(conversation.id, userId, messages, this.buildConversationTitle(messages));

    return {
      reply: reply.reply,
      conversationId: conversation.id,
      toolsUsed: reply.toolsUsed,
    };
  }

  async getConversations(userId: string): Promise<Record<string, unknown>[]> {
    const res = await this.pool.query(
      `SELECT id, title, updated_at, jsonb_array_length(messages) AS message_count
       FROM conversations
       WHERE user_id = $1::uuid
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId],
    );

    return res.rows;
  }

  private async runGroqPlanner(
    userId: string,
    userMessage: string,
    history: ConversationMessage[],
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    const hasGroqKeys = !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3);
    if (!hasGroqKeys) {
      return this.runBackupPlanner(userId, userMessage, history);
    }

    const groqMessages: Array<Record<string, unknown>> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
    const toolsUsed: string[] = [];

    try {
      for (let iteration = 0; iteration < 5; iteration += 1) {
        const body = JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          tools: this.getToolDefinitions(),
          tool_choice: "auto",
          temperature: 0.2,
          max_tokens: 1800,
        });

        const response = await fetchGroqWithRotation(body, AbortSignal.timeout(30000));

        if (!response.ok) {
          console.warn(`[CareerPilot Agent] Groq planner returned HTTP ${response.status}; trying backup planner.`);
          return this.runBackupPlanner(userId, userMessage, history);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;
        if (!message) {
          return this.generateGroqFinalAnswer(groqMessages, toolsUsed);
        }

        groqMessages.push(message);

        if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
          return {
            reply: message.content || "I could not generate a response.",
            toolsUsed,
          };
        }

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function?.name as string;
          const args = this.parseToolArgs(toolCall.function?.arguments);
          const result = await this.executeTool(toolName, args, userId);
          toolsUsed.push(toolName);
          groqMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }

      return this.generateGroqFinalAnswer(groqMessages, toolsUsed);
    } catch (error) {
      console.warn(
        `[CareerPilot Agent] Groq planner failed; trying backup planner: ${error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.runBackupPlanner(userId, userMessage, history);
    }
  }

  private async runGeminiPlanner(
    userId: string,
    userMessage: string,
    history: ConversationMessage[],
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return this.runNoToolFallback(userMessage);
    }

    const plannerMessages: Array<{ role: string; content: string }> = history.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const toolsUsed: string[] = [];

    try {
      for (let iteration = 0; iteration < 6; iteration += 1) {
        const prompt = this.buildGeminiPlannerPrompt(plannerMessages);
        const response = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(30000),
          },
        );

        if (!response.ok) {
          return this.generateGeminiFinalAnswer(plannerMessages, toolsUsed);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          return this.generateGeminiFinalAnswer(plannerMessages, toolsUsed);
        }

        const decision = this.parsePlannerDecision(text);
        if (decision.final) {
          return {
            reply: decision.final,
            toolsUsed,
          };
        }

        if (!decision.tool) {
          return this.generateGeminiFinalAnswer(plannerMessages, toolsUsed);
        }

        const result = await this.executeTool(decision.tool.name, decision.tool.args || {}, userId);
        toolsUsed.push(decision.tool.name);
        plannerMessages.push({
          role: "assistant",
          content: JSON.stringify({ tool: decision.tool }),
        });
        plannerMessages.push({
          role: "tool",
          content: JSON.stringify({ tool: decision.tool.name, result }),
        });
      }

      return this.generateGeminiFinalAnswer(plannerMessages, toolsUsed);
    } catch {
      return this.runNoToolFallback(userMessage);
    }
  }

  private async runBackupPlanner(
    userId: string,
    userMessage: string,
    history: ConversationMessage[],
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    if (process.env.GEMINI_API_KEY) {
      return this.runGeminiPlanner(userId, userMessage, history);
    }

    return this.runNoToolFallback(userMessage);
  }

  private async generateGroqFinalAnswer(
    messages: Array<Record<string, unknown>>,
    toolsUsed: string[],
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    try {
      const finalMessages = [
        ...messages,
        {
          role: "user",
          content:
            "Stop calling tools now. Write the best final answer for the user using only the conversation and tool results already available. If something is missing, say what is missing briefly and give the next useful step.",
        },
      ];

      const body = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: finalMessages,
        temperature: 0.2,
        max_tokens: 1200,
      });

      const response = await fetchGroqWithRotation(body, AbortSignal.timeout(20000), 1);
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          return { reply: content.trim(), toolsUsed };
        }
      }
    } catch (error) {
      console.warn(
        `[CareerPilot Agent] Groq final-answer synthesis failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.runNoToolFallback("");
  }

  private async generateGeminiFinalAnswer(
    messages: Array<{ role: string; content: string }>,
    toolsUsed: string[],
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return this.runNoToolFallback("");
    }

    const formattedMessages = messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    try {
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${SYSTEM_PROMPT}

The tool-planning loop has already run. Do not request another tool. Write the final answer for the user using only this conversation and tool context. If required information is missing, say that briefly and give the next useful step.

Conversation and tool context:
${formattedMessages}`,
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(20000),
        },
        1,
      );

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof content === "string" && content.trim()) {
          return { reply: content.trim(), toolsUsed };
        }
      }
    } catch (error) {
      console.warn(
        `[CareerPilot Agent] Gemini final-answer synthesis failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.runNoToolFallback("");
  }

  private buildGeminiPlannerPrompt(messages: Array<{ role: string; content: string }>): string {
    const formattedMessages = messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    return `${SYSTEM_PROMPT}

Available tools:
${JSON.stringify(this.getToolDefinitions().map((tool) => tool.function), null, 2)}

You are controlling a tool-using agent. Decide the next step.

Return JSON only in one of these shapes:

To call a tool:
{
  "tool": {
    "name": "read_resume",
    "args": { "userId": "${"{userId}"}" }
  }
}

To answer the user:
{
  "final": "Natural language answer to the user."
}

Important:
- Do not call tools for general technical explanations, definitions, or casual chat.
- Use only one tool call per JSON response.
- Use the exact userId only if a tool requires it; the backend will also fill it safely.
- Do not expose JSON, tool names, or implementation details in final answers.

Conversation and tool context:
${formattedMessages}`;
  }

  private parsePlannerDecision(text: string): {
    final?: string;
    tool?: { name: string; args?: Record<string, unknown> };
  } {
    try {
      const parsed = JSON.parse(text) as {
        final?: unknown;
        tool?: { name?: unknown; args?: unknown };
      };

      if (typeof parsed.final === "string" && parsed.final.trim()) {
        return { final: parsed.final.trim() };
      }

      if (parsed.tool && typeof parsed.tool.name === "string") {
        return {
          tool: {
            name: parsed.tool.name,
            args:
              parsed.tool.args && typeof parsed.tool.args === "object" && !Array.isArray(parsed.tool.args)
                ? parsed.tool.args as Record<string, unknown>
                : {},
          },
        };
      }
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return this.parsePlannerDecision(jsonMatch[0]);
      }
    }

    return {};
  }

  private async executeTool(name: string, args: Record<string, unknown>, userId: string): Promise<unknown> {
    const tool = this.tools[name];
    if (!tool) {
      return { error: `Unknown tool: ${name}` };
    }

    return tool.execute(args, userId);
  }

  private getToolDefinitions(): AgentToolDefinition[] {
    return Object.values(this.tools).map((tool) => tool.definition);
  }

  private parseToolArgs(rawArgs: unknown): Record<string, unknown> {
    if (typeof rawArgs !== "string" || !rawArgs.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawArgs);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  private runNoToolFallback(userMessage: string): { reply: string; toolsUsed: string[] } {
    return {
      reply:
        "I am having trouble reaching the AI planner right now. Please try again in a moment; if it keeps happening, check the API logs for the Groq/Gemini error.",
      toolsUsed: [],
    };
  }

  private async loadOrCreateConversation(userId: string, conversationId?: string): Promise<{
    id: string;
    messages: ConversationMessage[];
  }> {
    if (conversationId) {
      const existing = await this.pool.query(
        `SELECT id, messages
         FROM conversations
         WHERE id = $1::uuid AND user_id = $2::uuid`,
        [conversationId, userId],
      );

      if (existing.rows[0]) {
        return {
          id: existing.rows[0].id,
          messages: Array.isArray(existing.rows[0].messages) ? existing.rows[0].messages : [],
        };
      }
    }

    const created = await this.pool.query(
      `INSERT INTO conversations (user_id, messages)
       VALUES ($1::uuid, '[]')
       RETURNING id`,
      [userId],
    );

    return { id: created.rows[0].id, messages: [] };
  }

  private async saveConversation(
    conversationId: string,
    _userId: string,
    messages: ConversationMessage[],
    title: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE conversations
       SET messages = $1,
           title = COALESCE(NULLIF(title, ''), $2),
           updated_at = NOW()
       WHERE id = $3::uuid`,
      [JSON.stringify(messages), title, conversationId],
    );
  }

  private buildConversationTitle(messages: ConversationMessage[]): string {
    const firstUserMessage = messages.find((message) => message.role === "user")?.content || "Career chat";
    return firstUserMessage.slice(0, 60);
  }
}
