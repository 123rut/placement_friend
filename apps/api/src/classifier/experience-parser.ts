import { ParsedJobSections } from "./section-parser";

export type ExperienceClassificationState =
  | "NO_EXPERIENCE_REQUIREMENT"
  | "EXPERIENCE_REQUIRED"
  | "EXPERIENCE_PREFERRED"
  | "EXPERIENCE_UNCERTAIN"
  | "EXPERIENCE_CONFLICT";

export interface ExperienceTier {
  level: string;
  minYears: number;
  maxYears: number | null;
}

export interface ExperienceClassificationResult {
  state: ExperienceClassificationState;
  minYears: number;
  maxYears: number | null;
  isRequired: boolean;
  isPreferred: boolean;
  isMultiTier: boolean;
  tiers: ExperienceTier[];
  reasons: string[];
}

export class ExperienceParser {
  static parse(
    jobTitle: string,
    sections: ParsedJobSections,
  ): ExperienceClassificationResult {
    const reasons: string[] = [];
    const fullText = sections.fullCleanText;

    // 1. Split text into clean lines/sentences without breaking hyphenated ranges like 3-5 years
    const sentences = fullText
      .split(/(?:\r?\n|•|\.\s+|;\s+)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    let requiredMinYears = 0;
    let requiredMaxYears: number | null = null;
    let preferredMinYears = 0;
    let hasTechStackYears = false;
    const tiers: ExperienceTier[] = [];

    // Check Multi-tier seniority markers
    const hasJuniorTier = /\b(junior|entry[- ]level|intern|graduate|associate)\b/i.test(fullText);
    const hasSeniorTier = /\b(senior|sr\.?|mid[- ]level|lead|staff)\b/i.test(fullText);

    for (const sentence of sentences) {
      // False Positive Checks:
      // a. Company history (e.g. "Join a company with 50+ years of experience in the global finance industry", "founded 20 years ago")
      if (
        /\b(?:company|firm|organization|business|legacy|heritage|founded|serving|industry)\s+(?:has|with|of)?\s*(?:\d+)\+?\s*years/i.test(sentence) ||
        /\b(?:\d+)\+?\s*years\s+of\s+(?:company|industry|business|market)\s+(?:experience|presence|heritage)\b/i.test(sentence) ||
        /\bwith\s+\d+\+?\s*years\s+of\s+(?:experience\s+in\s+the\s+)?(?:global\s+)?(?:finance|industry|market|business)\b/i.test(sentence)
      ) {
        continue;
      }
      // b. Class / batch years (e.g. "Class of 2024 or 2025")
      if (/\b(?:class of|batch of|graduating in)\s*20\d\d\b/i.test(sentence)) {
        continue;
      }
      // c. Technology version names (e.g. "Web3", "OAuth2", "ISO 27001", "3rd party")
      if (/\b(?:web3|oauth2|3rd[- ]party|tier[- ]\d|l[1-5]|level[- ]\d)\b/i.test(sentence) && !/\byears?\s+of\s+experience\b/i.test(sentence)) {
        continue;
      }

      // Check for Tech-stack specific years (e.g. "3+ years of React / Python / AWS")
      const techYearsMatch = sentence.match(/(\d+)\+?\s*(?:years|yrs|year)\s*(?:of|in|with|using|building)\s*([a-z0-9#+.\s]{2,20})/i);
      if (techYearsMatch) {
        const yrs = parseInt(techYearsMatch[1], 10);
        const tech = techYearsMatch[2].trim();
        // If it's a technology like React/Java/AWS/Cloud/Python rather than "experience"
        if (yrs >= 3 && !/^(?:experience|professional|relevant|software|engineering|work)/i.test(tech)) {
          hasTechStackYears = true;
          reasons.push(`Detected tech-stack requirement: "${yrs}+ years with ${tech}"`);
        }
      }

      // Main Experience Pattern Matches
      const expPatterns = [
        /(?:requires|requiring)\s+(\d+)\+?\s*(?:years|yrs|year)(?:\s+of)?(?:\s+(?:professional|relevant|industry|work))?\s*experience/i,
        /(\d+)\s*\+\s*(?:years|yrs|year)(?:\s+of)?(?:\s+(?:professional|relevant|industry|work))?\s*experience/i,
        /minimum\s*(?:of\s*)?(\d+)\s*(?:years|yrs|year)/i,
        /at\s*least\s*(\d+)\s*(?:years|yrs|year)/i,
        /(\d+)\s*[-–—]\s*(\d+)\s*(?:years|yrs|year)(?:\s+of)?(?:\s+(?:professional|relevant|industry|work))?\s*experience/i,
        /(\d+)\s*to\s*(\d+)\s*(?:years|yrs|year)(?:\s+of)?(?:\s+(?:professional|relevant|industry|work))?\s*experience/i,
        /(\d+)\s*(?:years|yrs|year)(?:\s+of)?(?:\s+(?:professional|relevant|industry|work))\s*experience/i,
        /(\d+)\s*(?:years|yrs|year)(?:\s+of)?\s*experience\s*(?:required|needed|mandatory)/i,
      ];

      for (const pattern of expPatterns) {
        const match = sentence.match(pattern);
        if (match) {
          const num1 = parseInt(match[1], 10);
          const num2 = match[2] ? parseInt(match[2], 10) : null;

          // Check if this sentence is inside Preferred / Bonus qualifications
          const isPreferredSentence =
            /\b(?:preferred|nice to have|plus|bonus|optional|ideal|advantage)\b/i.test(sentence) ||
            (sections.preferredText && sections.preferredText.includes(sentence));

          if (isPreferredSentence) {
            preferredMinYears = Math.max(preferredMinYears, num1);
            reasons.push(`Detected preferred experience: ${num1}${num2 ? `-${num2}` : "+"} years in "${sentence.slice(0, 80)}"`);
          } else {
            requiredMinYears = Math.max(requiredMinYears, num1);
            if (num2) requiredMaxYears = num2;
            reasons.push(`Detected required experience: ${num1}${num2 ? `-${num2}` : "+"} years in "${sentence.slice(0, 80)}"`);
          }
          break;
        }
      }
    }

    // Check Multi-tier band conflict (e.g. Junior 0-1 vs Senior 3+)
    if (hasJuniorTier && hasSeniorTier && requiredMinYears >= 3) {
      tiers.push({ level: "Junior", minYears: 0, maxYears: 1 });
      tiers.push({ level: "Senior", minYears: requiredMinYears, maxYears: requiredMaxYears });
      return {
        state: "EXPERIENCE_CONFLICT",
        minYears: requiredMinYears,
        maxYears: requiredMaxYears,
        isRequired: true,
        isPreferred: false,
        isMultiTier: true,
        tiers,
        reasons: [...reasons, "Multi-tier experience contradiction detected (Junior vs Senior tiers)"],
      };
    }

    // Determine state
    if (requiredMinYears >= 3) {
      return {
        state: "EXPERIENCE_REQUIRED",
        minYears: requiredMinYears,
        maxYears: requiredMaxYears,
        isRequired: true,
        isPreferred: false,
        isMultiTier: false,
        tiers,
        reasons,
      };
    }

    if (requiredMinYears > 0 && requiredMinYears < 3) {
      return {
        state: "EXPERIENCE_REQUIRED",
        minYears: requiredMinYears,
        maxYears: requiredMaxYears,
        isRequired: true,
        isPreferred: false,
        isMultiTier: false,
        tiers,
        reasons,
      };
    }

    if (hasTechStackYears) {
      return {
        state: "EXPERIENCE_UNCERTAIN",
        minYears: 3,
        maxYears: null,
        isRequired: false,
        isPreferred: false,
        isMultiTier: false,
        tiers,
        reasons,
      };
    }

    if (preferredMinYears > 0) {
      return {
        state: "EXPERIENCE_PREFERRED",
        minYears: preferredMinYears,
        maxYears: null,
        isRequired: false,
        isPreferred: true,
        isMultiTier: false,
        tiers,
        reasons,
      };
    }

    return {
      state: "NO_EXPERIENCE_REQUIREMENT",
      minYears: 0,
      maxYears: null,
      isRequired: false,
      isPreferred: false,
      isMultiTier: false,
      tiers,
      reasons,
    };
  }
}
