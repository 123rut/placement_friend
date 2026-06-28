import { Inject, Injectable } from "@nestjs/common";
import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { Pool } from "pg";
import { CandidateProfileRecord, ParsedProfile } from "../careerpilot.types";
import { DB_POOL } from "../db/db.module";
import { fetchWithRetry } from "../utils/fetch-retry";
import { fetchGroqWithRotation } from "../utils/groq-keys";

const SKILL_KEYWORDS = [
  "java",
  "spring boot",
  "spring",
  "node.js",
  "node",
  "typescript",
  "javascript",
  "python",
  "go",
  "c++",
  "c#",
  "react",
  "next.js",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "graphql",
  "rest",
  "microservices",
  "system design",
  "git",
  "linux",
];

@Injectable()
export class ResumeService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async extractText(buffer: Buffer, mimetype: string): Promise<string> {
    if (mimetype === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text;
      } finally {
        await parser.destroy();
      }
    }

    if (mimetype.includes("word") || mimetype.includes("openxmlformats")) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    throw new Error("Unsupported file type. Upload a PDF or DOCX.");
  }

  async parseWithLLM(rawText: string): Promise<ParsedProfile> {
    const hasGroqKeys = !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3);
    if (hasGroqKeys) {
      const prompt = `Extract structured data from this resume. Return only valid JSON with this exact shape:
{
  "skills": ["skill1", "skill2"],
  "experience": [{ "company": "", "role": "", "years": 0, "description": "" }],
  "education": [{ "degree": "", "branch": "", "college": "", "year": 0 }],
  "projects": [{ "name": "", "tech": [], "description": "" }]
}

Resume:
${rawText.slice(0, 6000)}`;

      try {
        const body = JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
        });

        const response = await fetchGroqWithRotation(body, AbortSignal.timeout(30000));

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "{}";
          return this.normalizeProfile(JSON.parse(content));
        }
      } catch {
        // ignore and fall through
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      return this.parseWithGemini(rawText, geminiKey);
    }

    return this.extractWithHeuristics(rawText);
  }

  private async parseWithGemini(rawText: string, key: string): Promise<ParsedProfile> {
    const prompt = `Extract structured data from this resume text. Return a JSON object with this exact shape:
{
  "skills": ["skill1", "skill2"],
  "experience": [{ "company": "", "role": "", "years": 0, "description": "" }],
  "education": [{ "degree": "", "branch": "", "college": "", "year": 0 }],
  "projects": [{ "name": "", "tech": [], "description": "" }]
}

Resume Text:
${rawText.slice(0, 8000)}`;

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
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!response.ok) {
        return this.extractWithHeuristics(rawText);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        return this.extractWithHeuristics(rawText);
      }

      return this.normalizeProfile(JSON.parse(content));
    } catch {
      return this.extractWithHeuristics(rawText);
    }
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return null;
    }

    try {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: text.slice(0, 8000) }] },
            taskType: "RETRIEVAL_DOCUMENT",
          }),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data.embedding?.values || null;
    } catch {
      return null;
    }
  }

  async parseAndStore(
    buffer: Buffer,
    mimetype: string,
    userId: string,
  ): Promise<{ profileId: string; profile: ParsedProfile }> {
    const rawText = await this.extractText(buffer, mimetype);
    const profile = await this.parseWithLLM(rawText);

    const embeddingText = [
      `Skills: ${profile.skills.join(", ")}`,
      ...profile.experience.map((item) => `${item.role} at ${item.company}: ${item.description}`),
      ...profile.education.map((item) => `${item.degree} in ${item.branch} from ${item.college}`),
      ...profile.projects.map((item) => `${item.name} (${item.tech.join(", ")}): ${item.description}`),
    ].join("\n\n");

    const embedding = await this.generateEmbedding(embeddingText);
    const embeddingParam = embedding ? `[${embedding.join(",")}]` : null;

    const existing = await this.pool.query<{ id: string }>(
      `SELECT id FROM candidate_profiles WHERE user_id = $1::uuid LIMIT 1`,
      [userId],
    );

    if (existing.rows[0]) {
      const updateResult = await this.pool.query<{ id: string }>(
        `UPDATE candidate_profiles
         SET resume_raw_text = $2,
             skills = $3,
             experience = $4,
             education = $5,
             projects = $6,
             embedding = COALESCE($7::vector, embedding),
             updated_at = NOW()
         WHERE user_id = $1::uuid
         RETURNING id`,
        [
          userId,
          rawText,
          profile.skills,
          JSON.stringify(profile.experience),
          JSON.stringify(profile.education),
          JSON.stringify(profile.projects),
          embeddingParam,
        ],
      );

      return { profileId: updateResult.rows[0].id, profile };
    }

    const insertResult = await this.pool.query<{ id: string }>(
      `INSERT INTO candidate_profiles (user_id, resume_raw_text, skills, experience, education, projects, embedding)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::vector)
       RETURNING id`,
      [
        userId,
        rawText,
        profile.skills,
        JSON.stringify(profile.experience),
        JSON.stringify(profile.education),
        JSON.stringify(profile.projects),
        embeddingParam,
      ],
    );

    return { profileId: insertResult.rows[0].id, profile };
  }

  async getProfile(userId: string): Promise<CandidateProfileRecord | null> {
    const res = await this.pool.query(
      `SELECT id,
              user_id,
              skills,
              experience,
              education,
              projects,
              preferred_location,
              created_at
       FROM candidate_profiles
       WHERE user_id = $1::uuid`,
      [userId],
    );

    const row = res.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      skills: Array.isArray(row.skills) ? row.skills : [],
      experience: Array.isArray(row.experience) ? row.experience : [],
      education: Array.isArray(row.education) ? row.education : [],
      projects: Array.isArray(row.projects) ? row.projects : [],
      preferredLocation: row.preferred_location,
      createdAt: row.created_at?.toISOString?.() ?? String(row.created_at ?? ""),
    };
  }

  private extractWithHeuristics(rawText: string): ParsedProfile {
    const normalizedText = rawText.replace(/\r/g, "");
    const lines = normalizedText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const lowerText = normalizedText.toLowerCase();

    const skills = SKILL_KEYWORDS
      .filter((skill) => lowerText.includes(skill))
      .map((skill) => this.toDisplayCase(skill));

    const experience = this.collectSectionItems(lines, ["experience", "work experience", "professional experience"], 3).map(
      (line) => ({
        company: this.extractCompanyName(line),
        role: this.extractRoleName(line),
        years: this.extractYears(line),
        description: line,
      }),
    );

    const education = this.collectSectionItems(lines, ["education", "academics"], 2).map((line) => ({
      degree: this.extractDegree(line),
      branch: this.extractBranch(line),
      college: this.extractCollege(line),
      year: this.extractYear(line),
    }));

    const projects = this.collectSectionItems(lines, ["projects", "project"], 3).map((line) => ({
      name: line.split(":")[0]?.slice(0, 80) || "Project",
      tech: skills.slice(0, 4),
      description: line,
    }));

    return this.normalizeProfile({
      skills,
      experience,
      education,
      projects,
    });
  }

  private normalizeProfile(input: Partial<ParsedProfile>): ParsedProfile {
    return {
      skills: this.uniqueStrings(Array.isArray(input.skills) ? input.skills : []),
      experience: Array.isArray(input.experience)
        ? input.experience.map((item) => ({
            company: typeof item?.company === "string" ? item.company : "",
            role: typeof item?.role === "string" ? item.role : "",
            years: typeof item?.years === "number" ? item.years : 0,
            description: typeof item?.description === "string" ? item.description : "",
          }))
        : [],
      education: Array.isArray(input.education)
        ? input.education.map((item) => ({
            degree: typeof item?.degree === "string" ? item.degree : "",
            branch: typeof item?.branch === "string" ? item.branch : "",
            college: typeof item?.college === "string" ? item.college : "",
            year: typeof item?.year === "number" ? item.year : 0,
          }))
        : [],
      projects: Array.isArray(input.projects)
        ? input.projects.map((item) => ({
            name: typeof item?.name === "string" ? item.name : "",
            tech: this.uniqueStrings(Array.isArray(item?.tech) ? item.tech : []),
            description: typeof item?.description === "string" ? item.description : "",
          }))
        : [],
    };
  }

  private collectSectionItems(lines: string[], sectionNames: string[], limit: number): string[] {
    const lowerSections = sectionNames.map((name) => name.toLowerCase());
    const startIndex = lines.findIndex((line) => lowerSections.includes(line.toLowerCase()));
    if (startIndex === -1) {
      return [];
    }

    const collected: string[] = [];
    for (let index = startIndex + 1; index < lines.length && collected.length < limit; index += 1) {
      const line = lines[index];
      if (/^[A-Z][A-Za-z\s]+$/.test(line) && line.length < 40 && !line.includes(",")) {
        break;
      }
      collected.push(line);
    }

    return collected;
  }

  private uniqueStrings(values: unknown[]): string[] {
    return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];
  }

  private toDisplayCase(skill: string): string {
    return skill
      .split(" ")
      .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
      .join(" ");
  }

  private extractCompanyName(line: string): string {
    const atSplit = line.split(" at ");
    if (atSplit.length > 1) {
      return atSplit[1].split("|")[0].trim();
    }
    return line.split("|")[0].trim();
  }

  private extractRoleName(line: string): string {
    return line.split(" at ")[0].split("|")[0].trim();
  }

  private extractYears(line: string): number {
    const match = line.match(/(\d+)(?:\+)?\s*(?:years|yrs)/i);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  private extractDegree(line: string): string {
    const knownDegrees = ["B.Tech", "B.E", "M.Tech", "M.S", "B.Sc", "MCA", "MBA"];
    return knownDegrees.find((degree) => line.toLowerCase().includes(degree.toLowerCase())) ?? line;
  }

  private extractBranch(line: string): string {
    const knownBranches = [
      "Computer Science",
      "Information Technology",
      "Electronics",
      "Electrical",
      "Mechanical",
      "Civil",
      "Data Science",
    ];
    return knownBranches.find((branch) => line.toLowerCase().includes(branch.toLowerCase())) ?? "";
  }

  private extractCollege(line: string): string {
    const parts = line.split(",");
    return parts.length > 1 ? parts[0].trim() : line;
  }

  private extractYear(line: string): number {
    const match = line.match(/\b(19|20)\d{2}\b/);
    return match ? Number.parseInt(match[0], 10) : 0;
  }
}
