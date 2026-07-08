import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import {
  CandidateProfileRecord,
  JobMatchResult,
  JobSearchFilters,
  JobSearchResult,
  MatchExplanation,
  PreferredRequirementMatch,
  RequirementCheck,
} from "../careerpilot.types";
import { DB_POOL } from "../db/db.module";
import { fetchWithRetry } from "../utils/fetch-retry";
import { fetchGroqWithRotation } from "../utils/groq-keys";

const JOB_SKILL_TERMS = [
  "java",
  "spring boot",
  "spring",
  "node",
  "typescript",
  "python",
  "react",
  "aws",
  "docker",
  "kubernetes",
  "postgresql",
  "mysql",
  "redis",
  "graphql",
  "microservices",
  "system design",
  "distributed systems",
];

const EARLY_CAREER_POSITIVE_PATTERN =
  "(intern|internship|graduate|new grad|new graduate|fresher|freshers|entry level|entry-level|campus|university|student|trainee|associate|junior)";
const SENIOR_EXPERIENCE_PATTERN =
  "([3-9]|[1-9][0-9])\\s*\\+?\\s*(years|yrs|year)\\s*(of\\s*)?(experience|exp)?|([3-9]|[1-9][0-9])\\s*-\\s*([4-9]|[1-9][0-9])\\s*(years|yrs)";

@Injectable()
export class JobsService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async searchJobs(query: string, filters: JobSearchFilters = {}): Promise<JobSearchResult[]> {
    const limit = filters.limit || 20;
    const embedding = await this.embedQuery(query);

    if (embedding) {
      const embStr = `[${embedding.join(",")}]`;
      let sql = `
        SELECT j.id,
               j.title,
               j.location,
               j.remote,
               j.employment_type,
               j.salary_min,
               j.salary_max,
               j.url,
               j.posted_at,
               c.name AS company_name,
               c.industry,
               1 - (j.embedding <=> $1::vector) AS similarity_score
        FROM jobs j
        JOIN companies c ON j.company_id = c.id
        WHERE j.embedding IS NOT NULL
      `;
      const params: Array<string | number> = [embStr];

      if (filters.location) {
        params.push(`%${filters.location}%`);
        sql += ` AND j.location ILIKE $${params.length}`;
      }

      if (filters.employmentType) {
        params.push(filters.employmentType);
        sql += ` AND j.employment_type = $${params.length}`;
      }

      if (filters.earlyCareerOnly) {
        sql += this.earlyCareerSqlClause();
      }

      params.push(limit);
      sql += ` ORDER BY j.embedding <=> $1::vector LIMIT $${params.length}`;

      const res = await this.pool.query(sql, params);
      return res.rows;
    }

    const clauses = [
      `LOWER(j.title || ' ' || COALESCE(j.description, '')) LIKE LOWER($1)`,
    ];
    const params: Array<string | number> = [`%${query}%`];

    if (filters.location) {
      params.push(`%${filters.location}%`);
      clauses.push(`j.location ILIKE $${params.length}`);
    }

    if (filters.employmentType) {
      params.push(filters.employmentType);
      clauses.push(`j.employment_type = $${params.length}`);
    }

    if (filters.earlyCareerOnly) {
      clauses.push(this.earlyCareerSqlClause());
    }

    params.push(limit);

    const res = await this.pool.query(
      `SELECT j.id,
              j.title,
              j.location,
              j.remote,
              j.employment_type,
              j.salary_min,
              j.salary_max,
              j.url,
              j.posted_at,
              j.job_number,
              c.name AS company_name,
              c.industry,
              NULL::float AS similarity_score
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE ${clauses.join(" AND ")}
       ORDER BY j.posted_at DESC NULLS LAST
       LIMIT $${params.length}`,
      params,
    );

    return res.rows;
  }

  private earlyCareerSqlClause(): string {
    return `(
      j.employment_type = 'internship'
      OR (j.title || ' ' || COALESCE(j.description, '')) ~* '${EARLY_CAREER_POSITIVE_PATTERN}'
      OR NOT ((j.title || ' ' || COALESCE(j.description, '')) ~* '${SENIOR_EXPERIENCE_PATTERN}')
    )`;
  }

  async matchJobToProfile(
    jobId: string,
    userId: string,
    options: { fast?: boolean } = {},
  ): Promise<JobMatchResult | { error: string }> {
    const profileRes = await this.pool.query(
      `SELECT id,
              user_id,
              skills,
              experience,
              education,
              projects,
              preferred_location,
              created_at,
              embedding::text
       FROM candidate_profiles
       WHERE user_id = $1::uuid`,
      [userId],
    );

    if (!profileRes.rows[0]) {
      return { error: "Profile not found. Upload your resume first." };
    }

    const profile = this.mapProfile(profileRes.rows[0]);

    const jobRes = await this.pool.query(
      `SELECT j.*,
              c.name AS company_name
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE j.id = $1::uuid`,
      [jobId],
    );

    if (!jobRes.rows[0]) {
      return { error: "Job not found." };
    }

    const job = jobRes.rows[0];
    let vectorScore: number | null = null;

    if (profileRes.rows[0].embedding && job.embedding) {
      const simRes = await this.pool.query(
        `SELECT 1 - (p.embedding <=> j.embedding) AS score
         FROM candidate_profiles p, jobs j
         WHERE p.user_id = $1::uuid AND j.id = $2::uuid`,
        [userId, jobId],
      );
      vectorScore = simRes.rows[0]?.score ?? null;
    }

    let studentRecord: { batchYear: number | null; branch: string | null } = {
      batchYear: null,
      branch: null,
    };
    try {
      const studentRes = await this.pool.query(
        "SELECT batch_year, branch FROM students WHERE id = $1",
        [userId]
      );
      if (studentRes.rows[0]) {
        studentRecord = {
          batchYear: Number(studentRes.rows[0].batch_year),
          branch: studentRes.rows[0].branch || null,
        };
      }
    } catch {
      // ignore
    }

    if (!studentRecord.batchYear && profile.education) {
      const years = profile.education.map((e) => Number(e.year)).filter((y) => !isNaN(y) && y > 2000);
      if (years.length > 0) {
        studentRecord.batchYear = Math.max(...years);
      }
    }

    const jobText = `${String(job.title || "")} ${String(job.description || "")}`.toLowerCase();
    const hardRequirements = this.buildHardRequirementChecks(
      profile,
      jobText,
      String(job.title || ""),
      String(job.location || ""),
      studentRecord,
    );
    const failedChecks = hardRequirements.filter((check) => !check.passed);
    const preferredRequirements = this.buildPreferredRequirementMatches(profile, jobText);
    const missingSkills = preferredRequirements.filter((item) => !item.matched).map((item) => item.skill);

    if (failedChecks.length > 0) {
      await this.pool.query(
        `DELETE FROM job_matches WHERE user_id = $1::uuid AND job_id = $2::uuid`,
        [userId, jobId]
      );

      const rejectionReasons = failedChecks.map((check) => check.detail);
      return {
        jobId,
        jobTitle: job.title,
        company: job.company_name,
        eligible: false,
        matchScore: null,
        vectorSimilarity: vectorScore === null ? null : Math.round(vectorScore * 100),
        explanation: `This role is not eligible for your profile yet. ${rejectionReasons.join(" ")}`,
        strengths: profile.skills.slice(0, 3),
        missingSkills,
        hardRequirements,
        preferredRequirements,
        recommendation: "Skip this role for now and focus on jobs where the mandatory requirements match your profile.",
        rejectionReasons,
        applyUrl: job.url,
      };
    }

    const explanation = options.fast
      ? this.buildHeuristicMatch(profile, job, vectorScore, studentRecord.batchYear)
      : await this.generateMatchExplanation(profile, job, vectorScore, studentRecord.batchYear);
    const preferredScore = this.calculatePreferredRequirementScore(preferredRequirements);
    const finalScore = Math.round(explanation.matchScore * 0.65 + preferredScore * 0.35);

    await this.pool.query(
      `INSERT INTO job_matches (user_id, job_id, match_score, explanation, strengths, missing_skills)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
       ON CONFLICT (user_id, job_id) DO UPDATE SET
         match_score = EXCLUDED.match_score,
         explanation = EXCLUDED.explanation,
         strengths = EXCLUDED.strengths,
         missing_skills = EXCLUDED.missing_skills,
         created_at = NOW()`,
      [
        userId,
        jobId,
        finalScore,
        explanation.explanation,
        explanation.strengths,
        missingSkills,
      ],
    );

    return {
      jobId,
      jobTitle: job.title,
      company: job.company_name,
      eligible: true,
      matchScore: finalScore,
      vectorSimilarity: vectorScore === null ? null : Math.round(vectorScore * 100),
      explanation: explanation.explanation,
      strengths: explanation.strengths,
      missingSkills,
      hardRequirements,
      preferredRequirements,
      recommendation:
        missingSkills.length > 0
          ? `Improve ${missingSkills.slice(0, 3).join(", ")} to raise your confidence score for similar roles.`
          : "You satisfy the detected hard requirements and match the main preferred skills for this role.",
      rejectionReasons: [],
      applyUrl: job.url,
    };
  }

  async getTopMatches(userId: string, limit = 20): Promise<Record<string, unknown>[]> {
    const res = await this.pool.query(
      `SELECT jm.*,
              j.title,
              j.url,
              j.location,
              c.name AS company_name
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       WHERE jm.user_id = $1::uuid AND jm.match_score > 20
       ORDER BY jm.match_score DESC
       LIMIT $2`,
      [userId, limit],
    );

    return res.rows;
  }

  async analyzeSkillGap(userId: string, targetRole: string): Promise<Record<string, unknown>> {
    const profileRes = await this.pool.query(
      `SELECT id, user_id, skills, experience, education, projects, preferred_location, created_at
       FROM candidate_profiles
       WHERE user_id = $1::uuid`,
      [userId],
    );

    if (!profileRes.rows[0]) {
      return { error: "Profile not found. Upload your resume first." };
    }

    const profile = this.mapProfile(profileRes.rows[0]);
    const missingSkills = this.findMissingSkills(profile.skills, targetRole);

    return {
      missingSkills,
      learningRoadmap: missingSkills.slice(0, 4).map((skill, index) => ({
        week: index + 1,
        focus: skill,
        resources: [`Build one focused project using ${skill}.`],
      })),
      estimatedWeeks: Math.max(2, missingSkills.length),
      summary:
        missingSkills.length === 0
          ? `Your current profile already lines up well with ${targetRole}.`
          : `You are close to ${targetRole}, but the biggest gaps are ${missingSkills.join(", ")}.`,
    };
  }

  private async embedQuery(text: string): Promise<number[] | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return null;
    }

    try {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/gemini-embedding-2",
            content: { parts: [{ text: text.slice(0, 2000) }] },
            outputDimensionality: 768,
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

  private async generateMatchExplanation(
    profile: CandidateProfileRecord,
    job: Record<string, unknown>,
    vectorScore: number | null,
    batchYear: number | null,
  ): Promise<MatchExplanation> {
    const defaultResult = this.buildHeuristicMatch(profile, job, vectorScore, batchYear);
    const hasGroqKeys = !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3);

    let finalExplanation = defaultResult;

    if (hasGroqKeys) {
      const skills = profile.skills.join(", ");
      const exp = profile.experience.map((item) => `${item.role} at ${item.company}`).join(", ");
      const prompt = `Candidate skills: ${skills}
Candidate experience: ${exp}
Candidate graduation batch year: ${batchYear || "N/A"}
Job: ${String(job.title || "")} at ${String(job.company_name || "")}
Job description (excerpt): ${String(job.description || "").slice(0, 700)}
Vector similarity score: ${vectorScore === null ? "N/A" : `${Math.round(vectorScore * 100)}%`}

Rule: If the candidate's graduation year is 2025, 2026, or 2027 (meaning they are a student), and the job is a senior/lead/staff role or requires multiple years of professional experience (e.g. 3+, 5+, or 8+ years), the matchScore MUST be very low (between 5 and 15) and the explanation must state that the candidate is ineligible due to being a student.

Return JSON only:
{
  "matchScore": 85,
  "explanation": "2-3 sentence explanation of the match",
  "strengths": ["skill1", "skill2"],
  "missingSkills": ["gap1", "gap2"]
}`;

      try {
        const body = JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });

        const res = await fetchGroqWithRotation(body, AbortSignal.timeout(20000));

        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}") as Partial<MatchExplanation>;
          finalExplanation = {
            matchScore: typeof parsed.matchScore === "number" ? parsed.matchScore : defaultResult.matchScore,
            explanation: typeof parsed.explanation === "string" ? parsed.explanation : defaultResult.explanation,
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : defaultResult.strengths,
            missingSkills: Array.isArray(parsed.missingSkills)
              ? parsed.missingSkills.slice(0, 5)
              : defaultResult.missingSkills,
          };
        }
      } catch {
        // Fall back to defaultResult
      }
    }

    // Safety Override: Enforce student batch graduation vs senior experience hard constraint & compulsory requirements verification
    const jobText = `${String(job.title || "")} ${String(job.description || "")}`.toLowerCase();
    const verification = this.verifyCompulsoryRequirements(profile, jobText, String(job.title || ""), batchYear);

    if (!verification.ok) {
      finalExplanation.matchScore = 12;
      finalExplanation.explanation = `Compulsory check failed: ${verification.mismatches.join(" ")}`;
    }

    return finalExplanation;
  }

  private buildHeuristicMatch(
    profile: CandidateProfileRecord,
    job: Record<string, unknown>,
    vectorScore: number | null,
    batchYear: number | null,
  ): MatchExplanation {
    const jobText = `${String(job.title || "")} ${String(job.description || "")}`.toLowerCase();
    const normalizedSkills = profile.skills.map((skill) => skill.toLowerCase());
    const matchedSkills = profile.skills.filter((skill) => jobText.includes(skill.toLowerCase())).slice(0, 5);
    const missingSkills = this.findMissingSkills(normalizedSkills, jobText);
    const baseScore = vectorScore === null ? 55 : Math.round(vectorScore * 100);
    const scoreBoost = Math.min(25, matchedSkills.length * 8);

    // Run compulsory checks
    const verification = this.verifyCompulsoryRequirements(profile, jobText, String(job.title || ""), batchYear);

    if (!verification.ok) {
      return {
        matchScore: 12,
        explanation: `Compulsory check failed: ${verification.mismatches.join(" ")}`,
        strengths: profile.skills.slice(0, 2),
        missingSkills,
      };
    }

    const studentPenalty = this.hasSeniorExperienceRequirement(jobText) ? 25 : 0;
    const matchScore = Math.max(20, Math.min(98, baseScore + scoreBoost - missingSkills.length * 3 - studentPenalty));

    return {
      matchScore,
      explanation:
        studentPenalty > 0
          ? "This role appears to ask for several years of prior experience, so I would treat it as a stretch role for a student profile unless the description also mentions internships, graduate hiring, or campus roles."
          : matchedSkills.length > 0
            ? `Your profile already matches ${matchedSkills.join(", ")} for this role. Focus next on ${missingSkills.slice(0, 2).join(", ") || "deepening project depth"} to improve your odds.`
            : "This role is directionally relevant, but the job description does not strongly overlap with the skills extracted from your resume yet.",
      strengths: matchedSkills.length > 0 ? matchedSkills : profile.skills.slice(0, 3),
      missingSkills,
    };
  }

  private verifyCompulsoryRequirements(
    profile: CandidateProfileRecord,
    jobText: string,
    jobTitle: string,
    batchYear: number | null,
  ): { ok: boolean; mismatches: string[] } {
    const mismatches: string[] = [];

    // 1. Check Experience Requirement
    const isStudent = batchYear && (batchYear >= 2025 && batchYear <= 2028);
    const requiredYears = this.extractRequiredYearsOfExperience(jobText);
    const candidateYears = this.getCandidateExperienceYears(profile);

    if (requiredYears > 0) {
      if (isStudent && requiredYears >= 2) {
        mismatches.push(`Job requires ${requiredYears}+ years of experience, but you are a graduating student of the ${batchYear} batch.`);
      } else if (candidateYears < requiredYears) {
        mismatches.push(`Job requires ${requiredYears}+ years of experience, but your resume shows only ${candidateYears} year(s).`);
      }
    }

    // 2. Check Degree Requirements
    const requiredDegrees = this.extractRequiredDegrees(jobText);
    if (requiredDegrees.length > 0) {
      const degreesList = profile.education || [];
      if (degreesList.length > 0) {
        const degreeMatched = this.matchCandidateDegree(degreesList, requiredDegrees);
        if (!degreeMatched) {
          mismatches.push(`Job requires a ${requiredDegrees.join(" or ")}, but your resume shows: ${degreesList.map((e) => e.degree || "Degree").join(", ")}.`);
        }
      }
    }

    // 3. Check Senior Title Constraint
    const isSenior = this.isSeniorRoleFromTitle(jobTitle);
    if (isSenior && isStudent) {
      mismatches.push("This is a Senior/Lead/Staff level role, which is unsuitable for a graduating student profile.");
    }

    return {
      ok: mismatches.length === 0,
      mismatches,
    };
  }

  private buildHardRequirementChecks(
    profile: CandidateProfileRecord,
    jobText: string,
    jobTitle: string,
    jobLocation: string,
    studentRecord: { batchYear: number | null; branch: string | null },
  ): RequirementCheck[] {
    const checks: RequirementCheck[] = [];
    const batchYear = studentRecord.batchYear;
    const isStudent = !!batchYear && batchYear >= 2025 && batchYear <= 2028;
    const requiredYears = this.extractRequiredYearsOfExperience(jobText);
    const candidateYears = this.getCandidateExperienceYears(profile);

    checks.push({
      label: "Experience",
      passed: requiredYears === 0 || (!isStudent && candidateYears >= requiredYears) || (isStudent && requiredYears < 2),
      detail:
        requiredYears === 0
          ? "No explicit experience minimum was detected."
          : candidateYears >= requiredYears
            ? `Resume shows ${candidateYears} year(s) against a ${requiredYears}+ year requirement.`
            : `Job requires ${requiredYears}+ years of experience, but your resume shows ${candidateYears} year(s).`,
    });

    const requiredDegrees = this.extractRequiredDegrees(jobText);
    const degreeMatched = requiredDegrees.length === 0 || this.matchCandidateDegree(profile.education || [], requiredDegrees);
    checks.push({
      label: "Degree",
      passed: degreeMatched,
      detail:
        requiredDegrees.length === 0
          ? "No explicit degree requirement was detected."
          : degreeMatched
            ? `Detected degree requirement matched: ${requiredDegrees.join(" or ")}.`
            : `Job requires ${requiredDegrees.join(" or ")}, but your parsed education does not show a match.`,
    });

    const requiredBranches = this.extractRequiredBranches(jobText);
    const candidateBranches = [
      studentRecord.branch,
      ...profile.education.map((item) => item.branch),
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.toLowerCase());
    const branchMatched =
      requiredBranches.length === 0 ||
      requiredBranches.some((branch) => candidateBranches.some((candidateBranch) => candidateBranch.includes(branch)));
    checks.push({
      label: "Branch",
      passed: branchMatched,
      detail:
        requiredBranches.length === 0
          ? "No explicit branch requirement was detected."
          : branchMatched
            ? `Detected branch requirement matched: ${requiredBranches.join(" or ")}.`
            : `Job expects ${requiredBranches.join(" or ")}, but your profile branch does not show a match.`,
    });

    const requiredBatchYears = this.extractRequiredBatchYears(jobText);
    const batchMatched = requiredBatchYears.length === 0 || (!!batchYear && requiredBatchYears.includes(batchYear));
    checks.push({
      label: "Graduation year",
      passed: batchMatched,
      detail:
        requiredBatchYears.length === 0
          ? "No explicit graduation-year requirement was detected."
          : batchMatched
            ? `Your ${batchYear} batch matches the detected graduation-year requirement.`
            : `Job expects batch ${requiredBatchYears.join(" or ")}, but your profile shows ${batchYear || "no batch year"}.`,
    });

    const locationMatched = this.matchesLocationRequirement(profile.preferredLocation, jobLocation, jobText);
    checks.push({
      label: "Location",
      passed: locationMatched,
      detail: locationMatched
        ? "Location is compatible with the job location or no strict location requirement was detected."
        : `Job appears location-specific for ${jobLocation}, but your preferred location is ${profile.preferredLocation || "not set"}.`,
    });

    const isSenior = this.isSeniorRoleFromTitle(jobTitle);
    checks.push({
      label: "Seniority",
      passed: !(isSenior && isStudent),
      detail:
        isSenior && isStudent
          ? "This is a Senior/Lead/Staff level role, which is unsuitable for a graduating student profile."
          : "No seniority conflict was detected.",
    });

    return checks;
  }

  private buildPreferredRequirementMatches(
    profile: CandidateProfileRecord,
    jobText: string,
  ): PreferredRequirementMatch[] {
    const profileSkills = new Set(
      [
        ...profile.skills,
        ...profile.projects.flatMap((project) => project.tech || []),
      ].map((skill) => skill.toLowerCase()),
    );

    return JOB_SKILL_TERMS
      .filter((skill) => jobText.includes(skill))
      .slice(0, 8)
      .map((skill) => ({
        skill: this.toDisplayCase(skill),
        matched: profileSkills.has(skill),
        weight: this.preferredSkillWeight(skill),
      }));
  }

  private calculatePreferredRequirementScore(requirements: PreferredRequirementMatch[]): number {
    if (requirements.length === 0) {
      return 70;
    }

    const totalWeight = requirements.reduce((sum, item) => sum + item.weight, 0);
    const matchedWeight = requirements
      .filter((item) => item.matched)
      .reduce((sum, item) => sum + item.weight, 0);

    return Math.round((matchedWeight / totalWeight) * 100);
  }

  private preferredSkillWeight(skill: string): number {
    if (["java", "python", "typescript", "node"].includes(skill)) {
      return 25;
    }
    if (["react", "spring boot", "spring", "graphql"].includes(skill)) {
      return 20;
    }
    if (["aws", "docker", "kubernetes"].includes(skill)) {
      return 15;
    }
    return 10;
  }

  private extractRequiredYearsOfExperience(jobText: string): number {
    const patterns = [
      /(\d+)\s*\+?\s*(?:years|yrs|year)\b/i,
      /(\d+)\s*-\s*(\d+)\s*(?:years|yrs|year)\b/i,
      /minimum\s*(?:of\s*)?(\d+)\s*(?:years|yrs|year)\b/i,
      /required\s*(?:of\s*)?(\d+)\s*(?:years|yrs|year)\b/i,
    ];
    for (const pattern of patterns) {
      const match = jobText.match(pattern);
      if (match) {
        const years = parseInt(match[1], 10);
        if (!isNaN(years)) return years;
      }
    }
    return 0;
  }

  private extractRequiredBatchYears(jobText: string): number[] {
    const matches = jobText.match(/\b20(2[4-9]|3[0-2])\b/g) || [];
    const batchContext = /\b(batch|graduate|graduation|class of|passing out|passout)\b/i.test(jobText);
    if (!batchContext) {
      return [];
    }

    return [...new Set(matches.map((year) => Number.parseInt(year, 10)))];
  }

  private extractRequiredBranches(jobText: string): string[] {
    const branches: Array<{ key: string; patterns: RegExp[] }> = [
      { key: "computer science", patterns: [/\bcse\b/i, /computer science/i] },
      { key: "information technology", patterns: [/\bit\b/i, /information technology/i] },
      { key: "electronics", patterns: [/\bece\b/i, /electronics/i] },
      { key: "electrical", patterns: [/\beee\b/i, /electrical/i] },
      { key: "data science", patterns: [/data science/i] },
    ];

    return branches
      .filter((branch) => branch.patterns.some((pattern) => pattern.test(jobText)))
      .map((branch) => branch.key);
  }

  private matchesLocationRequirement(
    preferredLocation: string | null | undefined,
    jobLocation: string,
    jobText: string,
  ): boolean {
    const normalizedJobLocation = jobLocation.toLowerCase();
    if (!normalizedJobLocation || normalizedJobLocation.includes("remote")) {
      return true;
    }

    const strictLocation = /\b(on-site|onsite|hybrid|relocation required|must be located|based in)\b/i.test(jobText);
    if (!strictLocation) {
      return true;
    }

    if (!preferredLocation) {
      return false;
    }

    return normalizedJobLocation.includes(preferredLocation.toLowerCase());
  }

  private isSeniorRoleFromTitle(title: string): boolean {
    const lower = title.toLowerCase();
    return /\b(senior|sr|lead|staff|principal|manager|architect|director|head|vp)\b/i.test(lower);
  }

  private extractRequiredDegrees(jobText: string): string[] {
    const degrees: string[] = [];
    const lower = jobText.toLowerCase();

    if (/\b(b\.?tech|b\.?e\.?\b|bachelor|b\.s\.)/i.test(lower)) {
      degrees.push("Bachelor's");
    }
    if (/\b(m\.?tech|m\.?e\.?\b|master|m\.s\.)/i.test(lower)) {
      degrees.push("Master's");
    }
    if (/\bmca\b/i.test(lower)) {
      degrees.push("MCA");
    }
    if (/\b(ph\.?d|doctorate)/i.test(lower)) {
      degrees.push("PhD");
    }
    return degrees;
  }

  private matchCandidateDegree(candidateEducation: any[], requiredDegrees: string[]): boolean {
    if (requiredDegrees.length === 0) return true;

    return candidateEducation.some((edu) => {
      const deg = String(edu.degree || "").toLowerCase();

      return requiredDegrees.some((req) => {
        if (req === "Bachelor's") {
          return /\b(b\.?tech|b\.?e\.?\b|bachelor|b\.s\.)/i.test(deg);
        }
        if (req === "Master's") {
          return /\b(m\.?tech|m\.?e\.?\b|master|m\.s\.)/i.test(deg);
        }
        if (req === "MCA") {
          return /\bmca\b/i.test(deg);
        }
        if (req === "PhD") {
          return /\b(ph\.?d|doctorate)/i.test(deg);
        }
        return false;
      });
    });
  }

  private getCandidateExperienceYears(profile: CandidateProfileRecord): number {
    let total = 0;
    if (Array.isArray(profile.experience)) {
      for (const exp of profile.experience) {
        const expAny = exp as any;
        let years = Number(expAny.years);
        if (isNaN(years) && expAny.startYear) {
          const startMonth = Number(expAny.startMonth) || 1;
          const startYear = Number(expAny.startYear);
          const current = !!expAny.current;
          const endYear = current ? new Date().getFullYear() : (Number(expAny.endYear) || startYear);
          const endMonth = current ? (new Date().getMonth() + 1) : (Number(expAny.endMonth) || startMonth);
          const months = (endYear - startYear) * 12 + (endMonth - startMonth);
          years = months > 0 ? Math.round((months / 12) * 100) / 100 : 0;
        }
        if (!isNaN(years) && years > 0) {
          total += years;
        }
      }
    }
    return total;
  }

  private hasSeniorExperienceRequirement(jobText: string): boolean {
    return new RegExp(SENIOR_EXPERIENCE_PATTERN, "i").test(jobText);
  }

  private findMissingSkills(profileSkills: string[], targetText: string): string[] {
    const profileSet = new Set(profileSkills.map((skill) => skill.toLowerCase()));
    return JOB_SKILL_TERMS
      .filter((skill) => targetText.toLowerCase().includes(skill) && !profileSet.has(skill))
      .slice(0, 5)
      .map((skill) => this.toDisplayCase(skill));
  }

  private mapProfile(row: Record<string, any>): CandidateProfileRecord {
    return {
      id: row.id,
      userId: row.user_id,
      personal: row.personal && typeof row.personal === "object"
        ? row.personal
        : { name: "", email: "", phone: "", location: "" },
      summary: typeof row.summary === "string" ? row.summary : "",
      skills: Array.isArray(row.skills) ? row.skills : [],
      experience: Array.isArray(row.experience) ? row.experience : [],
      education: Array.isArray(row.education) ? row.education : [],
      certifications: Array.isArray(row.certifications) ? row.certifications : [],
      projects: Array.isArray(row.projects) ? row.projects : [],
      achievements: Array.isArray(row.achievements) ? row.achievements : [],
      publications: Array.isArray(row.publications) ? row.publications : [],
      languages: Array.isArray(row.languages) ? row.languages : [],
      preferredRoles: Array.isArray(row.preferred_roles) ? row.preferred_roles : [],
      preferredIndustries: Array.isArray(row.preferred_industries) ? row.preferred_industries : [],
      workAuthorization: typeof row.work_authorization === "string" ? row.work_authorization : "",
      totalExperienceYears: Number(row.total_experience_years) || this.getCandidateExperienceYears({
        id: row.id,
        userId: row.user_id,
        personal: { name: "", email: "", phone: "", location: "" },
        summary: "",
        skills: [],
        experience: Array.isArray(row.experience) ? row.experience : [],
        education: [],
        certifications: [],
        projects: [],
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
      }),
      currentRole: typeof row.current_role === "string" ? row.current_role : "",
      currentCompany: typeof row.current_company === "string" ? row.current_company : "",
      careerStage: this.toCareerStage(row.career_stage),
      preferredLocation: row.preferred_location,
      createdAt: row.created_at?.toISOString?.() ?? String(row.created_at ?? ""),
    };
  }

  private toCareerStage(value: unknown): CandidateProfileRecord["careerStage"] {
    const allowed: Array<CandidateProfileRecord["careerStage"]> = [
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

    return "New Graduate";
  }

  private toDisplayCase(skill: string): string {
    return skill
      .split(" ")
      .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
      .join(" ");
  }
}
