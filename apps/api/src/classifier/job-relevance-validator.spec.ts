import { LanguageDetector } from "./language-detector";
import { SectionParser } from "./section-parser";
import { RoleClassifier } from "./role-classifier";
import { ExperienceParser } from "./experience-parser";
import { LogicalJobKey } from "./logical-job-key";
import { JobRelevanceValidator } from "./job-relevance-validator";

describe("CareerPilot — Job Relevance & Experience Filtering Suite", () => {
  describe("1. Role Classification", () => {
    it("should classify standard technical roles as TECHNICAL", () => {
      const titles = [
        "Software Engineer",
        "Backend Engineer",
        "Fullstack Developer",
        "Frontend Engineer",
        "Machine Learning Engineer",
        "Data Engineer",
        "DevOps Engineer",
        "Site Reliability Engineer",
        "Software Engineer Intern",
        "Member of Technical Staff",
        "Forward Deployed Engineer",
      ];

      for (const title of titles) {
        const sections = SectionParser.parse("We are hiring a developer to build scalable systems.");
        const result = RoleClassifier.classify(title, sections);
        expect(result.state).toBe("TECHNICAL");
      }
    });

    it("should classify non-technical business roles as NON_TECHNICAL", () => {
      const nonTechTitles = [
        "Business Development Representative",
        "Compliance Manager",
        "Account Executive",
        "Talent Acquisition Specialist",
        "Technical Recruiter",
        "Marketing Manager",
        "Human Resources Coordinator",
        "Customer Support Specialist",
        "Head of Sales",
        "Product Marketing Manager",
      ];

      for (const title of nonTechTitles) {
        const sections = SectionParser.parse("Join our team to manage operations and sales.");
        const result = RoleClassifier.classify(title, sections);
        expect(result.state).toBe("NON_TECHNICAL");
      }
    });

    it("should recognize Software Engineer - Dutch Speaker as TECHNICAL (Role vs Language separation)", () => {
      const sections = SectionParser.parse("Building distributed systems with Dutch team.");
      const result = RoleClassifier.classify("Software Engineer - Dutch Speaker", sections);
      expect(result.state).toBe("TECHNICAL");
    });
  });

  describe("2. Language Detection", () => {
    it("should detect standard English descriptions", () => {
      const text = "We are looking for a software engineer with strong experience in JavaScript and cloud architectures.";
      const res = LanguageDetector.detect(text);
      expect(res.language).toBe("ENGLISH");
    });

    it("should detect non-English descriptions with foreign markers", () => {
      const text = "Buscamos un desarrollador de software con al menos 3 años de experiencia en desarrollo web y gestión de bases de datos. Requisitos mínimos.";
      const res = LanguageDetector.detect(text);
      expect(res.language).toBe("NON_ENGLISH");
    });
  });

  describe("3. Section Parsing", () => {
    it("should separate Requirements from Preferred / Bonus sections", () => {
      const text = `
About Us
We are a fast growing fintech company.

Requirements
- Bachelor's degree in Computer Science
- 1 year of programming experience

Preferred Qualifications
- 3+ years of experience in distributed systems
- Bonus Points: Experience with Kubernetes
      `;

      const parsed = SectionParser.parse(text);
      expect(parsed.hasStructuredSections).toBe(true);
      expect(parsed.requirementsText).toContain("Bachelor's degree");
      expect(parsed.preferredText).toContain("3+ years of experience in distributed systems");
    });
  });

  describe("4. Context-Aware Experience Parsing", () => {
    it("should extract mandatory 3+ years requirements", () => {
      const examples = [
        "Requires 3+ years of experience in software development",
        "Minimum 3 years of relevant experience required",
        "3-5 years of professional experience",
        "At least 3 years experience with cloud systems",
        "3 years of professional experience required",
      ];

      for (const ex of examples) {
        const sections = SectionParser.parse(`Requirements\n- ${ex}`);
        const result = ExperienceParser.parse("Software Engineer", sections);
        expect(result.state).toBe("EXPERIENCE_REQUIRED");
        expect(result.minYears).toBeGreaterThanOrEqual(3);
      }
    });

    it("should NOT treat preferred or bonus experience as hard mandatory requirement", () => {
      const text = `
Requirements
- Bachelor's in CS
- Solid knowledge of algorithms

Nice to Have
- 3+ years of experience with React is preferred
- Experience with Python preferred
      `;

      const sections = SectionParser.parse(text);
      const result = ExperienceParser.parse("Software Engineer", sections);
      expect(result.state).toBe("EXPERIENCE_PREFERRED");
      expect(result.isRequired).toBe(false);
    });

    it("should protect against false positive numbers (Web3, 50+ yrs company, Class of 2025, 3rd party)", () => {
      const text = `
About Us
Join a company with 50+ years of experience in the global finance industry.

Requirements
- Class of 2024 or 2025 graduating students
- Experience building Web3 and OAuth2 integrations
- Integration with 3rd-party APIs
      `;

      const sections = SectionParser.parse(text);
      const result = ExperienceParser.parse("Software Engineer Intern", sections);
      expect(result.state).toBe("NO_EXPERIENCE_REQUIREMENT");
      expect(result.minYears).toBe(0);
    });

    it("should detect tech-stack experience phrases as EXPERIENCE_UNCERTAIN", () => {
      const text = "Looking for a developer with 3+ years of React and Next.js.";
      const sections = SectionParser.parse(text);
      const result = ExperienceParser.parse("Frontend Developer", sections);
      expect(result.state).toBe("EXPERIENCE_UNCERTAIN");
    });
  });

  describe("5. Conservative Logical Job Key", () => {
    it("should differentiate distinct job titles and locations", () => {
      const key1 = LogicalJobKey.generate("stripe", "Software Engineer Intern", "Bangalore", "Engineering");
      const key2 = LogicalJobKey.generate("stripe", "Software Engineer Intern - AI Platform", "Bangalore", "Engineering");
      const key3 = LogicalJobKey.generate("stripe", "Software Engineer Intern", "London", "Engineering");

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toBe("stripe|software engineer intern|bangalore|engineering");
    });
  });

  describe("6. Master JobRelevanceValidator Decisions", () => {
    it("should deterministically APPROVE entry-level software engineer role without LLM call", async () => {
      const job = {
        title: "Software Engineer Intern",
        description: "Requirements: Knowledge of JavaScript, React, and Git. Class of 2025 or 2026 students.",
        company: "Google",
      };

      const result = await JobRelevanceValidator.evaluateJob(job, { allowLlmFallback: false });
      expect(result.status).toBe("APPROVED");
      expect(result.evaluationMethod).toBe("DETERMINISTIC");
      expect(result.isTechnical).toBe(true);
    });

    it("should deterministically REJECT non-technical Compliance Manager role without LLM call", async () => {
      const job = {
        title: "Compliance Manager",
        description: "Ensure regulatory compliance across European jurisdictions.",
        company: "Stripe",
      };

      const result = await JobRelevanceValidator.evaluateJob(job, { allowLlmFallback: false });
      expect(result.status).toBe("REJECTED");
      expect(result.evaluationMethod).toBe("DETERMINISTIC");
      expect(result.isTechnical).toBe(false);
    });

    it("should deterministically REJECT 5+ years senior software engineer role without LLM call", async () => {
      const job = {
        title: "Software Engineer",
        description: "Requirements: 5+ years of experience in distributed systems and cloud infrastructure.",
        company: "Amazon",
      };

      const result = await JobRelevanceValidator.evaluateJob(job, { allowLlmFallback: false });
      expect(result.status).toBe("REJECTED");
      expect(result.evaluationMethod).toBe("DETERMINISTIC");
      expect(result.rejectionReason).toContain("required_experience_5_years");
    });
  });
});
