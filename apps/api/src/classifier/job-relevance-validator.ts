import { LanguageDetector } from "./language-detector";
import { SectionParser } from "./section-parser";
import { RoleClassifier, RoleClassificationResult } from "./role-classifier";
import { ExperienceParser, ExperienceClassificationResult } from "./experience-parser";
import { fetchGroqWithRotation } from "../utils/groq-keys";

export interface JobToEvaluate {
  title: string;
  description: string;
  company?: string;
  category?: string | null;
  location?: string | null;
}

export interface JobEvaluationResult {
  status: "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  isTechnical: boolean;
  requiredExperienceYears: number;
  hasStructuredSections: boolean;
  evaluationMethod: "DETERMINISTIC" | "LLM_FALLBACK";
  logSummary: string;
}

export class JobRelevanceValidator {
  static async evaluateJob(
    job: JobToEvaluate,
    options: { allowLlmFallback?: boolean } = { allowLlmFallback: true },
  ): Promise<JobEvaluationResult> {
    const rawTitle = job.title || "";
    const rawDesc = job.description || "";

    // 1. Language Detection
    const langResult = LanguageDetector.detect(rawDesc);

    // 2. Section Parsing
    const parsedSections = SectionParser.parse(rawDesc);

    // 3. Role Classification
    const roleResult: RoleClassificationResult = RoleClassifier.classify(
      rawTitle,
      parsedSections,
      job.category,
    );

    // 4. Experience Parsing
    const expResult: ExperienceClassificationResult = ExperienceParser.parse(
      rawTitle,
      parsedSections,
    );

    // --- DETERMINISTIC REJECTIONS (Zero Token Waste) ---

    // A. Clearly Non-Technical (Even in Non-English, e.g. Sales, HR, Compliance)
    if (roleResult.state === "NON_TECHNICAL") {
      const reason = `non_technical_role (${roleResult.reasons[0] || "Title or category matches non-technical keywords"})`;
      return {
        status: "REJECTED",
        rejectionReason: reason,
        isTechnical: false,
        requiredExperienceYears: expResult.minYears,
        hasStructuredSections: parsedSections.hasStructuredSections,
        evaluationMethod: "DETERMINISTIC",
        logSummary: `[Job Filter] Rejected: "${rawTitle}" — Reason: ${reason}`,
      };
    }

    // B. Clearly Required 3+ Years of Professional Experience
    if (expResult.state === "EXPERIENCE_REQUIRED" && expResult.minYears >= 3) {
      const reason = `required_experience_${expResult.minYears}_years`;
      return {
        status: "REJECTED",
        rejectionReason: reason,
        isTechnical: roleResult.state === "TECHNICAL",
        requiredExperienceYears: expResult.minYears,
        hasStructuredSections: parsedSections.hasStructuredSections,
        evaluationMethod: "DETERMINISTIC",
        logSummary: `[Job Filter] Rejected: "${rawTitle}" — Reason: ${reason}`,
      };
    }

    // --- DETERMINISTIC ACCEPTANCES ---
    if (
      roleResult.state === "TECHNICAL" &&
      expResult.state !== "EXPERIENCE_UNCERTAIN" &&
      expResult.state !== "EXPERIENCE_CONFLICT" &&
      langResult.language === "ENGLISH"
    ) {
      return {
        status: "APPROVED",
        rejectionReason: null,
        isTechnical: true,
        requiredExperienceYears: expResult.minYears,
        hasStructuredSections: parsedSections.hasStructuredSections,
        evaluationMethod: "DETERMINISTIC",
        logSummary: `[Job Filter] Accepted: "${rawTitle}" — Reason: technical_role + no_experience_violation`,
      };
    }

    // --- AMBIGUOUS / CONFLICT CASES -> LLM FALLBACK ---
    if (options.allowLlmFallback) {
      try {
        const llmResult = await this.evaluateAmbiguousWithLlm(rawTitle, rawDesc, job.company);
        
        // Final Hard Validator Enforcement:
        // LLM can NEVER override deterministic experience violations
        if (expResult.state === "EXPERIENCE_REQUIRED" && expResult.minYears >= 3) {
          const reason = `required_experience_${expResult.minYears}_years (LLM override blocked)`;
          return {
            status: "REJECTED",
            rejectionReason: reason,
            isTechnical: llmResult.isTechnical,
            requiredExperienceYears: expResult.minYears,
            hasStructuredSections: parsedSections.hasStructuredSections,
            evaluationMethod: "LLM_FALLBACK",
            logSummary: `[Job Filter] Rejected (Final Validator): "${rawTitle}" — Reason: ${reason}`,
          };
        }

        if (llmResult.status === "REJECTED") {
          return {
            status: "REJECTED",
            rejectionReason: llmResult.rejectionReason || "llm_classified_ineligible",
            isTechnical: llmResult.isTechnical,
            requiredExperienceYears: llmResult.requiredExperienceYears || expResult.minYears,
            hasStructuredSections: parsedSections.hasStructuredSections,
            evaluationMethod: "LLM_FALLBACK",
            logSummary: `[Job Filter] Rejected (LLM): "${rawTitle}" — Reason: ${llmResult.rejectionReason}`,
          };
        }

        return {
          status: "APPROVED",
          rejectionReason: null,
          isTechnical: llmResult.isTechnical,
          requiredExperienceYears: llmResult.requiredExperienceYears || expResult.minYears,
          hasStructuredSections: parsedSections.hasStructuredSections,
          evaluationMethod: "LLM_FALLBACK",
          logSummary: `[Job Filter] Accepted (LLM): "${rawTitle}" — Reason: ${llmResult.reason || "technical_verified"}`,
        };
      } catch (err: any) {
        console.warn(`[Job Filter] LLM fallback failed for "${rawTitle}":`, err.message);
      }
    }

    // Default Conservative Fallback if LLM unavailable
    if (roleResult.state === "TECHNICAL") {
      return {
        status: "APPROVED",
        rejectionReason: null,
        isTechnical: true,
        requiredExperienceYears: expResult.minYears,
        hasStructuredSections: parsedSections.hasStructuredSections,
        evaluationMethod: "DETERMINISTIC",
        logSummary: `[Job Filter] Accepted: "${rawTitle}" — Reason: technical_role_fallback`,
      };
    }

    return {
      status: "REJECTED",
      rejectionReason: "ambiguous_non_technical_fallback",
      isTechnical: false,
      requiredExperienceYears: expResult.minYears,
      hasStructuredSections: parsedSections.hasStructuredSections,
      evaluationMethod: "DETERMINISTIC",
      logSummary: `[Job Filter] Rejected: "${rawTitle}" — Reason: ambiguous_non_technical_fallback`,
    };
  }

  private static async evaluateAmbiguousWithLlm(
    title: string,
    description: string,
    company?: string,
  ): Promise<{
    status: "APPROVED" | "REJECTED";
    isTechnical: boolean;
    requiredExperienceYears: number;
    rejectionReason: string | null;
    reason: string;
  }> {
    const prompt = `Analyze this job posting for a college student / early career platform.
Determine if:
1. Is this a Technical / Software Engineering / IT / Data / AI / Systems / Security / QA / DevOps role? (Reject pure Sales, HR, Legal, Recruiting, Marketing, Accounting, Customer Support).
2. Does this role STRICTLY REQUIRE 3 or more years of prior professional work experience? (Ignore preferred/nice-to-have experience and university project experience).

Job Title: ${title}
Company: ${company || "Unknown"}
Description Excerpt:
${description.slice(0, 1500)}

Return JSON only:
{
  "isTechnical": true,
  "requiredExperienceYears": 0,
  "status": "APPROVED",
  "reason": "Brief explanation"
}`;

    const body = JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 400,
    });

    const res = await fetchGroqWithRotation(body, AbortSignal.timeout(15000));
    if (!res.ok) {
      throw new Error(`Groq returned status ${res.status}`);
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    const isTech = !!parsed.isTechnical;
    const reqYears = Number(parsed.requiredExperienceYears) || 0;
    const isApproved = isTech && reqYears < 3 && parsed.status === "APPROVED";

    return {
      status: isApproved ? "APPROVED" : "REJECTED",
      isTechnical: isTech,
      requiredExperienceYears: reqYears,
      rejectionReason: !isTech ? "non_technical_role" : reqYears >= 3 ? `required_experience_${reqYears}_years` : null,
      reason: String(parsed.reason || ""),
    };
  }
}
