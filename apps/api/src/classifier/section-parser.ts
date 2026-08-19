export type SectionType =
  | "REQUIREMENTS"
  | "PREFERRED_QUALIFICATIONS"
  | "RESPONSIBILITIES"
  | "OVERVIEW"
  | "GENERAL";

export interface JobSection {
  type: SectionType;
  heading: string;
  content: string;
}

export interface ParsedJobSections {
  hasStructuredSections: boolean;
  sections: JobSection[];
  requirementsText: string;
  preferredText: string;
  responsibilitiesText: string;
  overviewText: string;
  fullCleanText: string;
}

const SECTION_HEADER_PATTERNS: Array<{ type: SectionType; pattern: RegExp }> = [
  {
    type: "PREFERRED_QUALIFICATIONS",
    pattern: /^(?:#{1,4}\s*)?(?:preferred|nice to have|bonus|bonus points|good to have|desired|preferred qualifications|preferred experience|preferred skills|additional qualifications)\b/i,
  },
  {
    type: "REQUIREMENTS",
    pattern: /^(?:#{1,4}\s*)?(?:requirements|basic qualifications|minimum qualifications|required qualifications|what you need|what you'll need|must have|what we're looking for|who you are|candidate profile|qualifications|eligibility)\b/i,
  },
  {
    type: "RESPONSIBILITIES",
    pattern: /^(?:#{1,4}\s*)?(?:responsibilities|what you will do|what you'll do|your role|the role|key responsibilities|duties|what we expect)\b/i,
  },
  {
    type: "OVERVIEW",
    pattern: /^(?:#{1,4}\s*)?(?:about us|about the company|who we are|our mission|company overview|about the team|our team|join us)\b/i,
  },
];

export class SectionParser {
  static parse(rawDescription: string): ParsedJobSections {
    if (!rawDescription || !rawDescription.trim()) {
      return {
        hasStructuredSections: false,
        sections: [],
        requirementsText: "",
        preferredText: "",
        responsibilitiesText: "",
        overviewText: "",
        fullCleanText: "",
      };
    }

    // Strip basic HTML tags while keeping section line breaks
    const cleanText = rawDescription
      .replace(/<\/?(?:h[1-6]|p|div|li|section|article)[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\r\n/g, "\n");

    const lines = cleanText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const sections: JobSection[] = [];
    let currentType: SectionType = "GENERAL";
    let currentHeading = "General";
    let currentLines: string[] = [];

    for (const line of lines) {
      let matchedHeader: { type: SectionType; pattern: RegExp } | null = null;

      // Only lines that look like headings (short line or starts with markdown #)
      if (line.length <= 60 || /^#{1,4}\s+/i.test(line) || /^[A-Z\s,/-]{3,40}:?$/i.test(line)) {
        for (const hp of SECTION_HEADER_PATTERNS) {
          if (hp.pattern.test(line.replace(/[:\-#*]/g, "").trim())) {
            matchedHeader = hp;
            break;
          }
        }
      }

      if (matchedHeader) {
        if (currentLines.length > 0) {
          sections.push({
            type: currentType,
            heading: currentHeading,
            content: currentLines.join("\n"),
          });
          currentLines = [];
        }
        currentType = matchedHeader.type;
        currentHeading = line.replace(/^[#*\s]+|[:*]+$/g, "").trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push({
        type: currentType,
        heading: currentHeading,
        content: currentLines.join("\n"),
      });
    }

    const textByType: Record<SectionType, string[]> = {
      REQUIREMENTS: [],
      PREFERRED_QUALIFICATIONS: [],
      RESPONSIBILITIES: [],
      OVERVIEW: [],
      GENERAL: [],
    };
    let structuredCount = 0;

    for (const section of sections) {
      textByType[section.type]?.push(section.content);
      if (section.type !== "GENERAL") {
        structuredCount++;
      }
    }

    return {
      hasStructuredSections: structuredCount >= 1,
      sections,
      requirementsText: textByType.REQUIREMENTS.join("\n"),
      preferredText: textByType.PREFERRED_QUALIFICATIONS.join("\n"),
      responsibilitiesText: textByType.RESPONSIBILITIES.join("\n"),
      overviewText: textByType.OVERVIEW.join("\n"),
      fullCleanText: cleanText,
    };
  }
}
