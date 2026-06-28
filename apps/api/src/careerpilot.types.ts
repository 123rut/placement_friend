export interface ParsedProfile {
  skills: string[];
  experience: Array<{
    company: string;
    role: string;
    years: number;
    description: string;
  }>;
  education: Array<{
    degree: string;
    branch: string;
    college: string;
    year: number;
  }>;
  projects: Array<{
    name: string;
    tech: string[];
    description: string;
  }>;
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

export interface JobMatchResult extends MatchExplanation {
  jobId: string;
  jobTitle: string;
  company: string;
  vectorSimilarity: number | null;
  applyUrl: string;
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
