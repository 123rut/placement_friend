export type RoleType = "internship" | "full-time";

export type CompanyCategory =
  | "it-product"
  | "it-service"
  | "core"
  | "consulting"
  | "bfsi"
  | "startup";

export type CompanySource = "seed" | "user-added" | "crowdsourced";

export type NotificationChannel = "email" | "whatsapp" | "telegram" | "dashboard";

export type College = {
  id: string;
  name: string;
  domain: string;
  city: string;
  state: string;
  type: "government" | "private" | "deemed";
};

export type StudentProfile = {
  id: string;
  fullName: string;
  email: string;
  collegeId: string;
  collegeName: string;
  branch: string;
  cgpa: number;
  batchYear: number;
  isVerified: boolean;
  trackedCompanyIds: string[];
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  careersUrl: string;
  category: CompanyCategory;
  eligibleBranches: string[];
  minCgpa: number | null;
  avgPackageLpa: number | null;
  source: CompanySource;
  urlVerifiedAt: string | null;
  isActive: boolean;
};

export type StudentCompanyTarget = {
  studentId: string;
  companyId: string;
  notifyVia: NotificationChannel[];
};

export type Opportunity = {
  id: string;
  companyId: string;
  title: string;
  roleType: RoleType;
  location: string;
  description: string;
  applicationUrl: string;
  sourceUrl: string;
  deadline: string | null;
  minCgpa: number | null;
  allowedBranches: string[];
  allowedBatchYears: number[];
  postedAt: string;
};

export type OpportunityMatch = {
  opportunityId: string;
  studentId: string;
  qualifies: boolean;
  reasons: string[];
};

export type ScrapedOpportunityInput = {
  companyId: string;
  title: string;
  roleType: RoleType;
  location: string;
  description: string;
  applicationUrl: string;
  sourceUrl: string;
  deadline?: string | null;
  minCgpa?: number | null;
  allowedBranches?: string[];
  allowedBatchYears?: number[];
  postedAt?: string;
};
