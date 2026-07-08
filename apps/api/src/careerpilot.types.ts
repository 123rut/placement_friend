export type CareerStage =
  | "Student"
  | "Intern"
  | "New Graduate"
  | "Entry Level"
  | "Mid Level"
  | "Senior"
  | "Lead"
  | "Manager"
  | "Executive"
  | "Career Switcher";

export interface ParsedProfile {
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
  };
  summary: string;
  skills: string[];
  experience: Array<{
    company: string;
    role: string;
    normalizedRole: string;
    years: number;
    startDate: string;
    endDate: string;
    current: boolean;
    durationMonths: number;
    description: string;
  }>;
  education: Array<{
    degree: string;
    normalizedDegree: string;
    branch: string;
    college: string;
    year: number;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    year: number;
  }>;
  projects: Array<{
    name: string;
    tech: string[];
    description: string;
    role: string;
    duration: string;
  }>;
  achievements: Array<{
    title: string;
    description: string;
  }>;
  publications: Array<{
    title: string;
    venue: string;
    year: number;
    url?: string;
  }>;
  languages: string[];
  preferredRoles: string[];
  preferredIndustries: string[];
  workAuthorization: string;
  totalExperienceYears: number;
  currentRole: string;
  currentCompany: string;
  careerStage: CareerStage;
}

export interface CandidateProfileRecord extends ParsedProfile {
  id: string;
  userId: string;
  preferredLocation?: string | null;
  createdAt?: string;
}

export interface JobSearchFilters {
  location?: string;
  employmentType?: string;
  earlyCareerOnly?: boolean;
  limit?: number;
}

export interface JobSearchResult {
  id: string;
  title: string;
  location: string | null;
  remote: boolean;
  employment_type: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  url: string;
  posted_at: string | null;
  company_name: string;
  industry?: string | null;
  similarity_score?: number | null;
  job_number?: string | null;
}

export interface MatchExplanation {
  matchScore: number;
  explanation: string;
  strengths: string[];
  missingSkills: string[];
}

export interface RequirementCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface PreferredRequirementMatch {
  skill: string;
  matched: boolean;
  weight: number;
}

export interface JobMatchResult {
  jobId: string;
  jobTitle: string;
  company: string;
  eligible: boolean;
  matchScore: number | null;
  vectorSimilarity: number | null;
  applyUrl: string;
  explanation: string;
  strengths: string[];
  missingSkills: string[];
  hardRequirements: RequirementCheck[];
  preferredRequirements: PreferredRequirementMatch[];
  recommendation: string;
  rejectionReasons: string[];
}

export interface SyncResult {
  companyId: string;
  companyName: string;
  status: "success" | "failed";
  jobsFound: number;
  jobsNew: number;
  durationMs: number;
  error?: string;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp?: string;
}

export interface AgentChatResponse {
  reply: string;
  conversationId: string;
  toolsUsed: string[];
}
