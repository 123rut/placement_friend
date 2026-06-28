import { careerPilotCompanies } from "../../../../packages/domain/src/careerpilot-companies.js";

export interface SyncCompanySeed {
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

export const companySeedData: SyncCompanySeed[] = careerPilotCompanies;
