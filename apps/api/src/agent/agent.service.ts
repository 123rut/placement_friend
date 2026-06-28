import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { AgentChatResponse, CandidateProfileRecord, ConversationMessage, JobMatchResult } from "../careerpilot.types";
import { DB_POOL } from "../db/db.module";
import { JobsService } from "../jobs/jobs.service";
import { ResumeService } from "../resume/resume.service";
import { fetchWithRetry } from "../utils/fetch-retry";
import { fetchGroqWithRotation } from "../utils/groq-keys";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_resume",
      description: "Read the candidate profile from the database. Always call this first.",
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
1. Always call read_resume before search_jobs or compute_match.
2. If the user asks how to prepare, improve, learn, roadmap, resume tips, or interview advice, answer from the resume first. Do not force a job search.
3. For job-finding requests, search for relevant jobs, then compute_match for the strongest options.
4. Be specific about strengths, gaps, and next steps.
5. Keep answers practical and concise.
6. If no profile or jobs are available, explain the missing step in plain language.`;

@Injectable()
export class AgentService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly jobsService: JobsService,
    private readonly resumeService: ResumeService,
  ) {}

  async chat(userId: string, userMessage: string, conversationId?: string): Promise<AgentChatResponse> {
    const conversation = await this.loadOrCreateConversation(userId, conversationId);
    const messages = [...conversation.messages];
    messages.push({ role: "user", content: userMessage, timestamp: new Date().toISOString() });

    let reply: { reply: string; toolsUsed: string[] };
    try {
      if (process.env.GROQ_API_KEY) {
        reply = await this.runGroqPlanner(userId, userMessage, messages);
      } else if (process.env.GEMINI_API_KEY) {
        reply = await this.runGeminiPlanner(userId, userMessage, messages);
      } else {
        reply = await this.runDeterministicPlanner(userId, userMessage);
      }
    } catch {
      reply = await this.runDeterministicPlanner(userId, userMessage);
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
      return this.runDeterministicPlanner(userId, userMessage);
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
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.2,
          max_tokens: 1800,
        });

        const response = await fetchGroqWithRotation(body, AbortSignal.timeout(30000));

        if (!response.ok) {
          return this.runDeterministicPlanner(userId, userMessage);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;
        if (!message) {
          break;
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
          const args = JSON.parse(toolCall.function?.arguments || "{}");
          const result = await this.executeTool(toolName, args, userId);
          toolsUsed.push(toolName);
          groqMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }

      return this.runDeterministicPlanner(userId, userMessage);
    } catch {
      return this.runDeterministicPlanner(userId, userMessage);
    }
  }

  private async runGeminiPlanner(
    userId: string,
    userMessage: string,
    history: ConversationMessage[],
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return this.runDeterministicPlanner(userId, userMessage);
    }

    const profile = await this.resumeService.getProfile(userId);
    const inferredLocation = this.extractLocation(userMessage) || (profile ? profile.preferredLocation : undefined);
    const jobs = await this.jobsService.searchJobs(userMessage, {
      location: inferredLocation || undefined,
      employmentType: this.extractEmploymentType(userMessage),
      limit: 5,
    });

    const matchResults: JobMatchResult[] = [];
    const toolsUsed = ["read_resume"];
    if (jobs.length > 0) {
      toolsUsed.push("search_jobs");
    }

    if (profile && jobs.length > 0) {
      for (const job of jobs.slice(0, 3)) {
        const match = await this.jobsService.matchJobToProfile(job.id, userId);
        if (!("error" in match)) {
          matchResults.push(match);
        }
      }
      if (matchResults.length > 0) {
        toolsUsed.push("compute_match");
      }
    }

    let skillGap: any = null;
    if (profile && matchResults.length > 0) {
      const topTarget = matchResults[0]?.jobTitle || jobs[0].title;
      skillGap = await this.jobsService.analyzeSkillGap(userId, topTarget);
      if (skillGap) {
        toolsUsed.push("get_skill_gap");
      }
    }

    const contextLines = [
      `User Profile: ${profile ? JSON.stringify({
        skills: profile.skills,
        preferredLocation: profile.preferredLocation,
        experience: profile.experience?.map(e => ({ company: e.company, role: e.role, description: e.description })),
        projects: profile.projects?.map(p => ({ name: p.name, tech: p.tech, description: p.description }))
      }) : "No resume/profile uploaded yet."}`,
      `Searched Jobs Context: ${JSON.stringify(jobs.map(j => ({ id: j.id, title: j.title, company: j.company_name, location: j.location })))}`,
      `Job Match Analysis (Resume Match Scores): ${JSON.stringify(matchResults.map(m => ({ jobTitle: m.jobTitle, company: m.company, matchScore: m.matchScore, strengths: m.strengths, missingSkills: m.missingSkills })))}`,
      `Skill Gap Roadmap: ${skillGap ? JSON.stringify(skillGap) : "None"}`
    ];

    const formattedHistory = history.map(m => `${m.role === "user" ? "Candidate" : "CareerPilot"}: ${m.content}`).join("\n");

    const prompt = `You are CareerPilot, an AI career assistant for software engineers.

Voice:
- Sound like a thoughtful career coach, not a database report.
- Use natural, encouraging language without overpromising.
- Start with the user's situation, then give the best options and next step.
- Avoid exposing internal tool names, endpoint names, raw JSON, or implementation details.

Workflow rules:
1. Answer questions based on the candidate's resume and job matches.
2. If the user asks how to prepare, improve, learn, roadmap, resume tips, or interview advice, base your response on the candidate's actual profile details.
3. Be specific about strengths, gaps, and next steps.
4. Keep answers practical, concise, and structured.

Candidate Database Context:
${contextLines.join("\n\n")}

Conversation History:
${formattedHistory}

CareerPilot:`;

    try {
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!response.ok) {
        return this.runDeterministicPlanner(userId, userMessage);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return this.runDeterministicPlanner(userId, userMessage);
      }

      return {
        reply: text.trim(),
        toolsUsed,
      };
    } catch {
      return this.runDeterministicPlanner(userId, userMessage);
    }
  }

  private async runDeterministicPlanner(
    userId: string,
    userMessage: string,
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    const profile = await this.resumeService.getProfile(userId);
    if (!profile) {
      return {
        reply:
          "I can help with that, but I need your resume first so I can understand your skills and experience. Upload it in the CareerPilot panel, then ask me again and I will rank the best roles for you.",
        toolsUsed: ["read_resume"],
      };
    }

    if (this.isPreparationQuestion(userMessage)) {
      return {
        reply: this.buildPreparationReply(profile, userMessage),
        toolsUsed: ["read_resume"],
      };
    }

    const inferredLocation = this.extractLocation(userMessage) || profile.preferredLocation || undefined;
    const jobs = await this.jobsService.searchJobs(userMessage, {
      location: inferredLocation || undefined,
      employmentType: this.extractEmploymentType(userMessage),
      limit: 3,
    });

    if (jobs.length === 0) {
      return {
        reply:
          `I checked your profile, but I do not see good matches in the saved job cache yet${inferredLocation ? ` for ${inferredLocation}` : ""}. Try syncing the job cache first, then ask for a role and location like "backend jobs in Bangalore" so I can compare real openings against your resume.`,
        toolsUsed: ["read_resume", "search_jobs"],
      };
    }

    const matchResults: JobMatchResult[] = [];
    for (const job of jobs.slice(0, 3)) {
      const match = await this.jobsService.matchJobToProfile(job.id, userId);
      if ("error" in match) {
        continue;
      }
      matchResults.push(match);
    }

    const topTarget = matchResults[0]?.jobTitle || jobs[0].title;
    const skillGap = await this.jobsService.analyzeSkillGap(userId, topTarget);
    const missingSkills =
      "missingSkills" in skillGap && Array.isArray(skillGap.missingSkills)
        ? skillGap.missingSkills.slice(0, 3).filter((skill): skill is string => typeof skill === "string")
        : [];
    const matchedSkillPreview = profile.skills.slice(0, 4).join(", ");
    const locationText = inferredLocation ? ` near ${inferredLocation}` : "";
    const bestMatches = matchResults.length > 0 ? matchResults : [];

    const replyLines = [
      `I found a few roles that look worth your time${locationText}. Based on your resume${matchedSkillPreview ? `, especially ${matchedSkillPreview}` : ""}, these are the strongest bets right now:`,
      "",
      ...bestMatches.map((match, index) => {
        const strengths = match.strengths.length ? ` Your edge: ${match.strengths.slice(0, 3).join(", ")}.` : "";
        const gaps = match.missingSkills.length
          ? ` Before applying, brush up on ${match.missingSkills.slice(0, 2).join(" and ")}.`
          : " I do not see any major skill gaps from the saved description.";
        return `${index + 1}. ${match.jobTitle} at ${match.company} - ${match.matchScore}% fit.${strengths} ${gaps}`;
      }),
      "",
      missingSkills.length
        ? `My suggested next move: spend a little time tightening ${missingSkills.join(", ")} in your resume or project examples, then apply to the top match first.`
        : "My suggested next move: apply to the top match first, and tailor your resume summary to mirror the role title and the strongest matching skills.",
    ];

    return {
      reply: replyLines.join("\n").replace(/\n{3,}/g, "\n\n"),
      toolsUsed: ["read_resume", "search_jobs", "compute_match", "get_skill_gap"],
    };
  }

  private async executeTool(name: string, args: Record<string, unknown>, userId: string): Promise<unknown> {
    const resolvedUserId = String(args.userId || userId);

    switch (name) {
      case "read_resume":
        return this.resumeService.getProfile(resolvedUserId);
      case "search_jobs":
        return this.jobsService.searchJobs(String(args.query || ""), {
          location: typeof args.location === "string" ? args.location : undefined,
          employmentType: typeof args.employmentType === "string" ? args.employmentType : undefined,
          limit: typeof args.limit === "number" ? args.limit : 5,
        });
      case "compute_match":
        return this.jobsService.matchJobToProfile(String(args.jobId || ""), resolvedUserId);
      case "get_skill_gap":
        return this.jobsService.analyzeSkillGap(resolvedUserId, String(args.targetRole || ""));
      default:
        return { error: `Unknown tool: ${name}` };
    }
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

  private isPreparationQuestion(message: string): boolean {
    return /\b(prepare|preparation|roadmap|learn|improve|practice|interview|resume|cv|project|skill|skills|gap|ready)\b/i.test(
      message,
    );
  }

  private buildPreparationReply(profile: CandidateProfileRecord, userMessage: string): string {
    const targetRole = this.extractTargetRole(userMessage);
    const skills = profile.skills.slice(0, 6);
    const experienceCount = profile.experience.length;
    const projectCount = profile.projects.length;
    const skillText = skills.length ? skills.join(", ") : "the skills already present in your resume";
    const roleText = targetRole ? ` for ${targetRole}` : "";

    const projectAdvice =
      projectCount > 0
        ? "Pick your strongest project and rewrite it around impact: problem, tech choices, measurable result, and what you personally owned."
        : "Add one solid project that matches your target role. Keep it practical: a real user flow, database, authentication, tests, and a short deployment link.";

    const experienceAdvice =
      experienceCount > 0
        ? "Turn each experience bullet into outcome language: what you built, scale or users, and the result."
        : "Since your resume does not show much experience yet, let projects do the heavy lifting. Make them specific enough that an interviewer can ask deep questions.";

    return [
      `Yes. You can prepare${roleText} without waiting for the job cache. From your resume, I would build around ${skillText}.`,
      "",
      `1. Strengthen the resume story. ${experienceAdvice}`,
      `2. Sharpen one proof project. ${projectAdvice}`,
      "3. Practice interviews in layers: first explain your project clearly, then review core CS/DSA, then practice role-specific system design or API/database questions.",
      "4. Apply with a small routine: shortlist roles, tailor the top 4-5 resume lines to each JD, and track what skill each rejection or interview is asking for.",
      "",
      "For the next 7 days: spend 2 days polishing the resume, 3 days improving one project, and 2 days doing mock interview questions from your target role. After that, sync jobs and I can rank real openings against your profile.",
    ].join("\n");
  }

  private extractTargetRole(message: string): string | null {
    const lower = message.toLowerCase();
    const roles = [
      "backend engineer",
      "frontend engineer",
      "full stack engineer",
      "software engineer",
      "data analyst",
      "data scientist",
      "devops engineer",
      "machine learning engineer",
      "internship",
    ];
    return roles.find((role) => lower.includes(role)) || null;
  }

  private extractLocation(message: string): string | null {
    const cities = ["bangalore", "bengaluru", "mumbai", "pune", "hyderabad", "chennai", "delhi", "gurgaon"];
    const lower = message.toLowerCase();
    const match = cities.find((city) => lower.includes(city));
    if (!match) {
      return null;
    }
    return match === "bengaluru" ? "Bangalore" : match[0].toUpperCase() + match.slice(1);
  }

  private extractEmploymentType(message: string): string | undefined {
    const lower = message.toLowerCase();
    if (lower.includes("intern")) {
      return "internship";
    }
    if (lower.includes("contract")) {
      return "contract";
    }
    return undefined;
  }
}
