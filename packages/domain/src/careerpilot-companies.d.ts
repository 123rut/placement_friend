export type CareerPilotAts =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "smartrecruiters";

export interface CareerPilotCompany {
  id: string;
  name: string;
  ats: CareerPilotAts;
  identifier: string;
  host?: string;
  site?: string;
  careerUrl: string;
  city: string;
  country: string;
  industry: string;
}

export const careerPilotCompanies: CareerPilotCompany[];
