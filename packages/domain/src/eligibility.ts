import type { Opportunity, OpportunityMatch, ScrapedOpportunityInput, StudentProfile } from "./types.js";

const normalizeText = (value: string) => value.trim().toLowerCase();

export const buildOpportunityId = (input: ScrapedOpportunityInput) => {
  const title = normalizeText(input.title).replace(/\s+/g, "-");
  return `${input.companyId}-${title}`;
};

export const createOpportunity = (input: ScrapedOpportunityInput): Opportunity => ({
  id: buildOpportunityId(input),
  companyId: input.companyId,
  title: input.title,
  roleType: input.roleType,
  location: input.location,
  description: input.description,
  applicationUrl: input.applicationUrl,
  sourceUrl: input.sourceUrl,
  deadline: input.deadline ?? null,
  minCgpa: input.minCgpa ?? null,
  allowedBranches: input.allowedBranches ?? [],
  allowedBatchYears: input.allowedBatchYears ?? [],
  postedAt: input.postedAt ?? new Date().toISOString()
});

export const matchStudentToOpportunity = (
  student: StudentProfile,
  opportunity: Opportunity
): OpportunityMatch => {
  const reasons: string[] = [];

  if (!student.trackedCompanyIds.includes(opportunity.companyId)) {
    reasons.push("Company is not in the student's tracking list.");
  }

  if (opportunity.minCgpa !== null && student.cgpa < opportunity.minCgpa) {
    reasons.push(`CGPA ${student.cgpa} is below the minimum requirement of ${opportunity.minCgpa}.`);
  }

  if (
    opportunity.allowedBranches.length > 0 &&
    !opportunity.allowedBranches.map(normalizeText).includes(normalizeText(student.branch))
  ) {
    reasons.push("Student branch is not eligible for this role.");
  }

  if (
    opportunity.allowedBatchYears.length > 0 &&
    !opportunity.allowedBatchYears.includes(student.batchYear)
  ) {
    reasons.push("Student batch year is not eligible for this role.");
  }

  return {
    opportunityId: opportunity.id,
    studentId: student.id,
    qualifies: reasons.length === 0,
    reasons: reasons.length === 0 ? ["Student matches all current eligibility checks."] : reasons
  };
};

export const filterEligibleOpportunities = (
  student: StudentProfile,
  opportunities: Opportunity[]
) => opportunities.filter((opportunity) => matchStudentToOpportunity(student, opportunity).qualifies);
