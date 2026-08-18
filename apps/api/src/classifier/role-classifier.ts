import rules from "../config/classification_rules.json";
import { ParsedJobSections } from "./section-parser";

export type RoleClassificationState = "TECHNICAL" | "NON_TECHNICAL" | "AMBIGUOUS" | "CONFLICT";

export interface RoleClassificationResult {
  state: RoleClassificationState;
  score: number;
  titleScore: number;
  seniorityScore: number;
  earlyCareerScore: number;
  reasons: string[];
}

export class RoleClassifier {
  static classify(
    title: string,
    sections: ParsedJobSections,
    category?: string | null,
  ): RoleClassificationResult {
    const reasons: string[] = [];
    const normalizedTitle = title.toLowerCase().trim();
    const normalizedCategory = (category || "").toLowerCase().trim();

    const {
      technical_roles,
      negative_roles,
      seniority_keywords,
      early_career_keywords,
      weights,
      thresholds,
    } = rules;

    // 1. Calculate Title Score
    let titleScore = 0;

    // Check negative role patterns on title (e.g. Sales, Compliance, BDR, Recruiting)
    for (const [pattern, weight] of Object.entries(negative_roles)) {
      const regex = new RegExp(`\\b${pattern.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (regex.test(normalizedTitle)) {
        titleScore += weight;
        reasons.push(`Title matches non-technical keyword: "${pattern}" (${weight})`);
      }
    }

    // Check technical role patterns on title (e.g. Software Engineer, Backend, ML)
    for (const [pattern, weight] of Object.entries(technical_roles)) {
      const regex = new RegExp(`\\b${pattern.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (regex.test(normalizedTitle)) {
        titleScore += weight;
        reasons.push(`Title matches technical keyword: "${pattern}" (+${weight})`);
      }
    }

    // 2. Calculate Seniority and Early Career signals on title
    let seniorityScore = 0;
    for (const [pattern, weight] of Object.entries(seniority_keywords)) {
      const regex = new RegExp(`\\b${pattern.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (regex.test(normalizedTitle)) {
        seniorityScore += weight;
        reasons.push(`Title matches seniority keyword: "${pattern}" (${weight})`);
      }
    }

    let earlyCareerScore = 0;
    for (const [pattern, weight] of Object.entries(early_career_keywords)) {
      const regex = new RegExp(`\\b${pattern.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (regex.test(normalizedTitle)) {
        earlyCareerScore += weight;
        reasons.push(`Title matches early-career keyword: "${pattern}" (+${weight})`);
      }
    }

    // 3. Category / Metadata Score
    let metadataScore = 0;
    if (normalizedCategory) {
      for (const [pattern, weight] of Object.entries(negative_roles)) {
        if (normalizedCategory.includes(pattern)) {
          metadataScore += weight;
          reasons.push(`Category contains non-technical keyword: "${pattern}" (${weight})`);
        }
      }
      for (const [pattern, weight] of Object.entries(technical_roles)) {
        if (normalizedCategory.includes(pattern)) {
          metadataScore += weight;
          reasons.push(`Category contains technical keyword: "${pattern}" (+${weight})`);
        }
      }
    }

    // 4. Section scores (Requirements & Responsibilities)
    let requirementsScore = 0;
    const reqText = sections.requirementsText.toLowerCase();
    if (reqText) {
      for (const [pattern, weight] of Object.entries(technical_roles)) {
        if (reqText.includes(pattern)) {
          requirementsScore += Math.min(weight, 1.5);
        }
      }
    }

    let responsibilitiesScore = 0;
    const respText = sections.responsibilitiesText.toLowerCase();
    if (respText) {
      for (const [pattern, weight] of Object.entries(technical_roles)) {
        if (respText.includes(pattern)) {
          responsibilitiesScore += Math.min(weight, 1.5);
        }
      }
    }

    // 5. Generic overview content (very low weight to avoid tech-stack keyword stuffing)
    let genericScore = 0;
    const overviewText = sections.overviewText.toLowerCase();
    if (overviewText) {
      for (const [pattern] of Object.entries(technical_roles)) {
        if (overviewText.includes(pattern)) {
          genericScore += 0.5;
        }
      }
    }

    // Combine Weighted Score
    const finalScore =
      titleScore * weights.title_weight +
      metadataScore * weights.metadata_weight +
      requirementsScore * weights.requirements_weight +
      responsibilitiesScore * weights.responsibilities_weight +
      genericScore * weights.generic_weight +
      seniorityScore +
      earlyCareerScore;

    // Hard Override: If title has strong non-technical signal (e.g. Sales, Compliance, Recruiter)
    // and no explicit early-career engineering title, reject immediately
    if (titleScore <= -4) {
      return {
        state: "NON_TECHNICAL",
        score: finalScore,
        titleScore,
        seniorityScore,
        earlyCareerScore,
        reasons,
      };
    }

    // Hard Override: If title has strong technical signal and no negative title signals
    if (titleScore >= 3 && titleScore > Math.abs(seniorityScore)) {
      return {
        state: "TECHNICAL",
        score: finalScore,
        titleScore,
        seniorityScore,
        earlyCareerScore,
        reasons,
      };
    }

    // General Thresholding
    if (finalScore >= thresholds.technical_threshold) {
      return {
        state: "TECHNICAL",
        score: finalScore,
        titleScore,
        seniorityScore,
        earlyCareerScore,
        reasons,
      };
    } else if (finalScore <= thresholds.non_technical_threshold) {
      return {
        state: "NON_TECHNICAL",
        score: finalScore,
        titleScore,
        seniorityScore,
        earlyCareerScore,
        reasons,
      };
    }

    return {
      state: "AMBIGUOUS",
      score: finalScore,
      titleScore,
      seniorityScore,
      earlyCareerScore,
      reasons,
    };
  }
}
