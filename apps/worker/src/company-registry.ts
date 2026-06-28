import { careerPilotCompanies } from "../../../packages/domain/src/careerpilot-companies.js";

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

export const companySeedData: CompanySeed[] = careerPilotCompanies;
