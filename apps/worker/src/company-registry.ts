import { seedCompanies } from "../../../packages/domain/src/companies.js";

/**
 * CareerPilot AI - Company Registry
 *
 * Shared seed data for 150+ companies across supported ATS providers.
 */

export interface CompanySeed {
  id: string;
  name: string;
  ats: "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters";
  identifier: string;
  host?: string;
  site?: string;
  careerUrl: string;
  city: string;
  country: string;
  industry: string;
}

export const companySeedData: CompanySeed[] = seedCompanies.map(c => ({
  id: c.id,
  name: c.name,
  ats: c.ats as any,
  identifier: c.identifier || "",
  host: c.host || undefined,
  site: c.site || undefined,
  careerUrl: c.careersUrl,
  city: c.city || "San Francisco",
  country: c.country || "US",
  industry: c.industry || "Technology"
}));
