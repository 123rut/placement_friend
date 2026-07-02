import { Inject, Injectable } from "@nestjs/common";
import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { Pool } from "pg";
import { CandidateProfileRecord, CareerStage, ParsedProfile } from "../careerpilot.types";
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

const SKILL_ALIASES: Record<string, string> = {
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  "spring boot": "Spring Boot",
  reactjs: "React",
  "react.js": "React",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  docker: "Docker",
  kubernetes: "Kubernetes",
};

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
      const prompt = `Extract structured data from this resume for a general-purpose career platform. Do not assume the candidate is a student. Read the entire resume text and identify all technical skills, programming languages, databases, frameworks, libraries, cloud providers, tools, certifications, achievements, publications, roles, and industries mentioned anywhere in the text. Return only valid JSON with this exact shape:
{
  "personal": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "portfolio": "", "website": "" },
  "summary": "",
  "skills": ["skill1", "skill2"],
  "experience": [{ "company": "", "role": "", "normalizedRole": "", "years": 0, "startDate": "", "endDate": "", "current": false, "durationMonths": 0, "description": "" }],
  "education": [{ "degree": "", "normalizedDegree": "", "branch": "", "college": "", "year": 0 }],
  "certifications": [{ "name": "", "issuer": "", "year": 0 }],
  "projects": [{ "name": "", "tech": [], "description": "", "role": "", "duration": "" }],
  "achievements": [{ "title": "", "description": "" }],
  "publications": [{ "title": "", "venue": "", "year": 0, "url": "" }],
  "languages": [],
  "preferredRoles": [],
  "preferredIndustries": [],
  "workAuthorization": "",
  "totalExperienceYears": 0,
  "currentRole": "",
  "currentCompany": "",
  "careerStage": "Entry Level"
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
    const prompt = `Extract structured data from this resume text for a general-purpose career platform. Do not assume the candidate is a student. Read the entire resume text and identify all technical skills, programming languages, databases, frameworks, libraries, cloud providers, tools, certifications, achievements, publications, roles, and industries mentioned anywhere in the text. Return a JSON object with this exact shape:
{
  "personal": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "portfolio": "", "website": "" },
  "summary": "",
  "skills": ["skill1", "skill2"],
  "experience": [{ "company": "", "role": "", "normalizedRole": "", "years": 0, "startDate": "", "endDate": "", "current": false, "durationMonths": 0, "description": "" }],
  "education": [{ "degree": "", "normalizedDegree": "", "branch": "", "college": "", "year": 0 }],
  "certifications": [{ "name": "", "issuer": "", "year": 0 }],
  "projects": [{ "name": "", "tech": [], "description": "", "role": "", "duration": "" }],
  "achievements": [{ "title": "", "description": "" }],
  "publications": [{ "title": "", "venue": "", "year": 0, "url": "" }],
  "languages": [],
  "preferredRoles": [],
  "preferredIndustries": [],
  "workAuthorization": "",
  "totalExperienceYears": 0,
  "currentRole": "",
  "currentCompany": "",
  "careerStage": "Entry Level"
}

Resume Text:
${rawText.slice(0, 8000)}`;

    try {
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`,
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
      `Summary: ${profile.summary}`,
      `Career stage: ${profile.careerStage}`,
      `Current role: ${profile.currentRole} at ${profile.currentCompany}`,
      `Skills: ${profile.skills.join(", ")}`,
      `Certifications: ${profile.certifications.map((item) => item.name).join(", ")}`,
      `Preferred roles: ${profile.preferredRoles.join(", ")}`,
      `Preferred industries: ${profile.preferredIndustries.join(", ")}`,
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
             personal = $7,
             summary = $8,
             certifications = $9,
             achievements = $10,
             publications = $11,
             languages = $12,
             preferred_roles = $13,
             preferred_industries = $14,
             work_authorization = $15,
             total_experience_years = $16,
             "current_role" = $17,
             current_company = $18,
             career_stage = $19,
             embedding = COALESCE($20::vector, embedding),
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
          JSON.stringify(profile.personal),
          profile.summary,
          JSON.stringify(profile.certifications),
          JSON.stringify(profile.achievements),
          JSON.stringify(profile.publications),
          profile.languages,
          profile.preferredRoles,
          profile.preferredIndustries,
          profile.workAuthorization,
          profile.totalExperienceYears,
          profile.currentRole,
          profile.currentCompany,
          profile.careerStage,
          embeddingParam,
        ],
      );

      await this.pool.query(
        `DELETE FROM job_matches WHERE user_id = $1::uuid`,
        [userId]
      );

      return { profileId: updateResult.rows[0].id, profile };
    }

    const insertResult = await this.pool.query<{ id: string }>(
      `INSERT INTO candidate_profiles (
          user_id,
          resume_raw_text,
          skills,
          experience,
          education,
          projects,
          personal,
          summary,
          certifications,
          achievements,
          publications,
          languages,
          preferred_roles,
          preferred_industries,
          work_authorization,
          total_experience_years,
          "current_role",
          current_company,
          career_stage,
          embedding
        )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::vector)
       RETURNING id`,
      [
        userId,
        rawText,
        profile.skills,
        JSON.stringify(profile.experience),
        JSON.stringify(profile.education),
        JSON.stringify(profile.projects),
        JSON.stringify(profile.personal),
        profile.summary,
        JSON.stringify(profile.certifications),
        JSON.stringify(profile.achievements),
        JSON.stringify(profile.publications),
        profile.languages,
        profile.preferredRoles,
        profile.preferredIndustries,
        profile.workAuthorization,
        profile.totalExperienceYears,
        profile.currentRole,
        profile.currentCompany,
        profile.careerStage,
        embeddingParam,
      ],
    );

    await this.pool.query(
      `DELETE FROM job_matches WHERE user_id = $1::uuid`,
      [userId]
    );

    return { profileId: insertResult.rows[0].id, profile };
  }

  async updateExperience(
    userId: string,
    experience: any[],
  ): Promise<CandidateProfileRecord> {
    const existing = await this.getProfile(userId);

    let profile: CandidateProfileRecord;
    if (existing) {
      profile = {
        ...existing,
        experience,
      };
    } else {
      profile = {
        id: "",
        userId,
        personal: { name: "", email: "", phone: "", location: "" },
        summary: "",
        skills: [],
        experience,
        education: [],
        projects: [],
        certifications: [],
        achievements: [],
        publications: [],
        languages: [],
        preferredRoles: [],
        preferredIndustries: [],
        workAuthorization: "",
        totalExperienceYears: 0,
        currentRole: "",
        currentCompany: "",
        careerStage: "New Graduate",
        createdAt: new Date().toISOString(),
      };
    }

    const embeddingText = this.buildEmbeddingText(profile);
    const embedding = await this.generateEmbedding(embeddingText);
    const embeddingParam = embedding ? `[${embedding.join(",")}]` : null;

    if (existing) {
      await this.pool.query(
        `UPDATE candidate_profiles
         SET experience = $2,
             embedding = COALESCE($3::vector, embedding),
             updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId, JSON.stringify(experience), embeddingParam]
      );
    } else {
      await this.pool.query(
        `INSERT INTO candidate_profiles (
          user_id,
          experience,
          embedding,
          personal,
          education,
          projects,
          certifications,
          achievements,
          publications,
          skills,
          languages,
          preferred_roles,
          preferred_industries,
          work_authorization,
          total_experience_years,
          "current_role",
          current_company,
          career_stage
        )
        VALUES (
          $1::uuid, $2, $3::vector, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )`,
        [
          userId,
          JSON.stringify(experience),
          embeddingParam,
          JSON.stringify(profile.personal),
          JSON.stringify(profile.education),
          JSON.stringify(profile.projects),
          JSON.stringify(profile.certifications),
          JSON.stringify(profile.achievements),
          JSON.stringify(profile.publications),
          profile.skills,
          profile.languages,
          profile.preferredRoles,
          profile.preferredIndustries,
          profile.workAuthorization,
          profile.totalExperienceYears,
          profile.currentRole,
          profile.currentCompany,
          profile.careerStage,
        ]
      );
    }

    await this.pool.query(
      `DELETE FROM job_matches WHERE user_id = $1::uuid`,
      [userId]
    );

    const updated = await this.getProfile(userId);
    if (!updated) {
      throw new Error("Failed to load updated profile");
    }
    return updated;
  }

  private buildEmbeddingText(profile: any): string {
    const parts: string[] = [];

    if (profile.summary) {
      parts.push(profile.summary);
    }

    if (profile.skills?.length) {
      parts.push(`Skills: ${profile.skills.join(", ")}`);
    }

    if (profile.experience?.length) {
      const expText = profile.experience
        .map((e: any) => `${e.title || e.role || ""} at ${e.company}. ${e.description ?? ""}`)
        .join("\n");
      parts.push(`Experience:\n${expText}`);
    }

    if (profile.education?.length) {
      const eduText = profile.education
        .map((e: any) => `${e.degree} in ${e.branch} from ${e.college}`)
        .join("\n");
      parts.push(`Education:\n${eduText}`);
    }

    if (profile.projects?.length) {
      const projText = profile.projects
        .map((p: any) => `${p.name}: ${p.description ?? ""} (${p.tech?.join(", ")})`)
        .join("\n");
      parts.push(`Projects:\n${projText}`);
    }

    const text = parts.join("\n\n").trim();

    if (!text) {
      return `Candidate profile with no information provided yet.`;
    }

    return text;
  }

  async getProfile(userId: string): Promise<CandidateProfileRecord | null> {
    const res = await this.pool.query(
      `SELECT id,
              user_id,
              skills,
              experience,
              education,
              projects,
              personal,
              summary,
              certifications,
              achievements,
              publications,
              languages,
              preferred_roles,
              preferred_industries,
              work_authorization,
              total_experience_years,
              current_role,
              current_company,
              career_stage,
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

    const normalized = this.normalizeProfile({
      personal: row.personal,
      summary: row.summary,
      skills: row.skills,
      experience: row.experience,
      education: row.education,
      certifications: row.certifications,
      projects: row.projects,
      achievements: row.achievements,
      publications: row.publications,
      languages: row.languages,
      preferredRoles: row.preferred_roles,
      preferredIndustries: row.preferred_industries,
      workAuthorization: row.work_authorization,
      totalExperienceYears: Number(row.total_experience_years),
      currentRole: row.current_role,
      currentCompany: row.current_company,
      careerStage: row.career_stage,
    });

    return {
      id: row.id,
      userId: row.user_id,
      ...normalized,
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
        normalizedRole: this.normalizeJobTitle(this.extractRoleName(line)),
        years: this.extractYears(line),
        startDate: "",
        endDate: "",
        current: /present|current/i.test(line),
        durationMonths: this.extractYears(line) * 12,
        description: line,
      }),
    );

    const education = this.collectSectionItems(lines, ["education", "academics"], 2).map((line) => ({
      degree: this.extractDegree(line),
      normalizedDegree: this.normalizeDegree(this.extractDegree(line)),
      branch: this.extractBranch(line),
      college: this.extractCollege(line),
      year: this.extractYear(line),
    }));

    const projects = this.collectSectionItems(lines, ["projects", "project"], 3).map((line) => ({
      name: line.split(":")[0]?.slice(0, 80) || "Project",
      tech: skills.slice(0, 4),
      description: line,
      role: "",
      duration: "",
    }));

    return this.normalizeProfile({
      skills,
      experience,
      education,
      projects,
    });
  }

  private normalizeProfile(input: Partial<ParsedProfile>): ParsedProfile {
    const experience = Array.isArray(input.experience)
      ? input.experience.map((item) => {
          const role = typeof item?.role === "string" ? item.role : "";
          const years = typeof item?.years === "number" ? item.years : 0;
          const durationMonths =
            typeof item?.durationMonths === "number" && item.durationMonths > 0
              ? item.durationMonths
              : Math.round(years * 12);

          return {
            company: typeof item?.company === "string" ? item.company : "",
            role,
            normalizedRole:
              typeof item?.normalizedRole === "string" && item.normalizedRole
                ? item.normalizedRole
                : this.normalizeJobTitle(role),
            years,
            startDate: typeof item?.startDate === "string" ? item.startDate : "",
            endDate: typeof item?.endDate === "string" ? item.endDate : "",
            current: typeof item?.current === "boolean" ? item.current : false,
            durationMonths,
            description: typeof item?.description === "string" ? item.description : "",
          };
        })
      : [];
    const totalExperienceYears =
      typeof input.totalExperienceYears === "number" && input.totalExperienceYears > 0
        ? input.totalExperienceYears
        : this.calculateTotalExperienceYears(experience);
    const currentExperience = experience.find((item) => item.current) || experience[0];
    const currentRole =
      typeof input.currentRole === "string" && input.currentRole
        ? input.currentRole
        : currentExperience?.role || "";
    const currentCompany =
      typeof input.currentCompany === "string" && input.currentCompany
        ? input.currentCompany
        : currentExperience?.company || "";

    return {
      personal: {
        name: typeof input.personal?.name === "string" ? input.personal.name : "",
        email: typeof input.personal?.email === "string" ? input.personal.email : "",
        phone: typeof input.personal?.phone === "string" ? input.personal.phone : "",
        location: typeof input.personal?.location === "string" ? input.personal.location : "",
        linkedin: typeof input.personal?.linkedin === "string" ? input.personal.linkedin : "",
        github: typeof input.personal?.github === "string" ? input.personal.github : "",
        portfolio: typeof input.personal?.portfolio === "string" ? input.personal.portfolio : "",
        website: typeof input.personal?.website === "string" ? input.personal.website : "",
      },
      summary: typeof input.summary === "string" ? input.summary : "",
      skills: this.uniqueStrings(Array.isArray(input.skills) ? input.skills.map((skill) => this.normalizeSkill(skill)) : []),
      experience,
      education: Array.isArray(input.education)
        ? input.education.map((item) => ({
            degree: typeof item?.degree === "string" ? item.degree : "",
            normalizedDegree:
              typeof item?.normalizedDegree === "string" && item.normalizedDegree
                ? item.normalizedDegree
                : this.normalizeDegree(typeof item?.degree === "string" ? item.degree : ""),
            branch: typeof item?.branch === "string" ? item.branch : "",
            college: typeof item?.college === "string" ? item.college : "",
            year: typeof item?.year === "number" ? item.year : 0,
          }))
        : [],
      certifications: Array.isArray(input.certifications)
        ? input.certifications.map((item) => ({
            name: typeof item?.name === "string" ? item.name : "",
            issuer: typeof item?.issuer === "string" ? item.issuer : "",
            year: typeof item?.year === "number" ? item.year : 0,
          }))
        : [],
      projects: Array.isArray(input.projects)
        ? input.projects.map((item) => ({
            name: typeof item?.name === "string" ? item.name : "",
            tech: this.uniqueStrings(Array.isArray(item?.tech) ? item.tech.map((skill) => this.normalizeSkill(skill)) : []),
            description: typeof item?.description === "string" ? item.description : "",
            role: typeof item?.role === "string" ? item.role : "",
            duration: typeof item?.duration === "string" ? item.duration : "",
          }))
        : [],
      achievements: Array.isArray(input.achievements)
        ? input.achievements.map((item) => ({
            title: typeof item?.title === "string" ? item.title : "",
            description: typeof item?.description === "string" ? item.description : "",
          }))
        : [],
      publications: Array.isArray(input.publications)
        ? input.publications.map((item) => ({
            title: typeof item?.title === "string" ? item.title : "",
            venue: typeof item?.venue === "string" ? item.venue : "",
            year: typeof item?.year === "number" ? item.year : 0,
            url: typeof item?.url === "string" ? item.url : "",
          }))
        : [],
      languages: this.uniqueStrings(Array.isArray(input.languages) ? input.languages : []),
      preferredRoles: this.uniqueStrings(Array.isArray(input.preferredRoles) ? input.preferredRoles : []),
      preferredIndustries: this.uniqueStrings(Array.isArray(input.preferredIndustries) ? input.preferredIndustries : []),
      workAuthorization: typeof input.workAuthorization === "string" ? input.workAuthorization : "",
      totalExperienceYears,
      currentRole,
      currentCompany,
      careerStage: this.normalizeCareerStage(input.careerStage, totalExperienceYears, currentRole, input.summary),
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

  private normalizeSkill(value: unknown): string {
    if (typeof value !== "string") {
      return "";
    }

    const cleaned = value.trim();
    const key = cleaned.toLowerCase().replace(/\s+/g, " ");
    return SKILL_ALIASES[key] || this.toDisplayCase(cleaned);
  }

  private normalizeDegree(value: string): string {
    const lower = value.toLowerCase();
    if (/\b(b\.?tech|b\.?e\.?|bachelor|b\.?s\.?|bsc|bca)\b/i.test(lower)) {
      return "Bachelor";
    }
    if (/\b(m\.?tech|m\.?e\.?|master|m\.?s\.?|msc)\b/i.test(lower)) {
      return "Master";
    }
    if (/\bmca\b/i.test(lower)) {
      return "MCA";
    }
    if (/\bmba\b/i.test(lower)) {
      return "MBA";
    }
    if (/\b(ph\.?d|doctorate)\b/i.test(lower)) {
      return "PhD";
    }
    return value;
  }

  private normalizeJobTitle(value: string): string {
    const lower = value.toLowerCase();
    if (/\b(manager|engineering manager|head|director|vp)\b/i.test(lower)) {
      return "Manager";
    }
    if (/\b(lead|staff|principal|architect)\b/i.test(lower)) {
      return "Lead Engineer";
    }
    if (/\b(senior|sr\.?)\b/i.test(lower)) {
      return "Senior Software Engineer";
    }
    if (/\b(backend|front.?end|full.?stack|sde|software engineer|software developer|developer)\b/i.test(lower)) {
      return "Software Engineer";
    }
    if (/\b(data scientist|machine learning|ml engineer)\b/i.test(lower)) {
      return "Machine Learning Engineer";
    }
    if (/\b(devops|site reliability|sre)\b/i.test(lower)) {
      return "DevOps Engineer";
    }
    return value;
  }

  private calculateTotalExperienceYears(
    experience: Array<{ years: number; durationMonths: number }>,
  ): number {
    const months = experience.reduce((sum, item) => {
      if (item.durationMonths > 0) {
        return sum + item.durationMonths;
      }
      return sum + Math.round(item.years * 12);
    }, 0);

    return Math.round((months / 12) * 10) / 10;
  }

  private normalizeCareerStage(
    value: unknown,
    totalExperienceYears: number,
    currentRole: string,
    summary: unknown,
  ): CareerStage {
    const allowed: CareerStage[] = [
      "Student",
      "Intern",
      "New Graduate",
      "Entry Level",
      "Mid Level",
      "Senior",
      "Lead",
      "Manager",
      "Executive",
      "Career Switcher",
    ];
    if (typeof value === "string") {
      const match = allowed.find((stage) => stage.toLowerCase() === value.toLowerCase());
      if (match) {
        return match;
      }
    }

    const text = `${currentRole} ${typeof summary === "string" ? summary : ""}`.toLowerCase();
    if (/\b(founder|ceo|cto|vp|vice president|executive)\b/i.test(text)) {
      return "Executive";
    }
    if (/\b(manager|head|director)\b/i.test(text)) {
      return "Manager";
    }
    if (/\b(lead|staff|principal|architect)\b/i.test(text)) {
      return "Lead";
    }
    if (/\b(intern|internship)\b/i.test(text)) {
      return "Intern";
    }
    if (/\b(student|campus)\b/i.test(text)) {
      return "Student";
    }
    if (/\b(career switch|transitioning|transitioned)\b/i.test(text)) {
      return "Career Switcher";
    }
    if (totalExperienceYears >= 12) {
      return "Manager";
    }
    if (totalExperienceYears >= 8) {
      return "Lead";
    }
    if (totalExperienceYears >= 5) {
      return "Senior";
    }
    if (totalExperienceYears >= 2) {
      return "Mid Level";
    }
    if (totalExperienceYears > 0) {
      return "Entry Level";
    }
    return "New Graduate";
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
