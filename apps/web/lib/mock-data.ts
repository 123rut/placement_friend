import { createOpportunity, seedCompanies } from "@piaa/domain";
import type { Company, Opportunity, StudentProfile } from "@piaa/domain";

export const companies: Company[] = seedCompanies.filter((company) =>
  ["google", "microsoft", "atlassian"].includes(company.id)
);

export const sampleStudent: StudentProfile = {
  id: "student-001",
  fullName: "Riya Sharma",
  email: "riya.sharma@nitt.edu",
  collegeId: "nit-trichy",
  collegeName: "National Institute of Technology Tiruchirappalli",
  branch: "Computer Science",
  cgpa: 8.6,
  batchYear: 2027,
  isVerified: true,
  trackedCompanyIds: ["google", "microsoft", "atlassian"]
};

export const opportunities: Opportunity[] = [
  createOpportunity({
    companyId: "google",
    title: "Software Engineering Intern",
    roleType: "internship",
    location: "Bengaluru",
    description: "Summer internship focused on distributed systems and product engineering.",
    applicationUrl: "https://careers.google.com/jobs/results/123",
    sourceUrl: "https://careers.google.com/jobs/results/123",
    deadline: "2026-06-22T23:59:00.000Z",
    minCgpa: 8,
    allowedBranches: ["Computer Science", "Information Technology"],
    allowedBatchYears: [2027],
    postedAt: "2026-06-08T09:30:00.000Z"
  }),
  createOpportunity({
    companyId: "microsoft",
    title: "SWE Full Time",
    roleType: "full-time",
    location: "Hyderabad",
    description: "Entry-level full-time role for final-year students with strong coding fundamentals.",
    applicationUrl: "https://jobs.careers.microsoft.com/global/en/job/456",
    sourceUrl: "https://jobs.careers.microsoft.com/global/en/job/456",
    deadline: "2026-06-18T23:59:00.000Z",
    minCgpa: 7.5,
    allowedBranches: ["Computer Science", "Electronics"],
    allowedBatchYears: [2026],
    postedAt: "2026-06-07T12:00:00.000Z"
  }),
  createOpportunity({
    companyId: "atlassian",
    title: "Backend Engineering Intern",
    roleType: "internship",
    location: "Remote",
    description: "Backend internship focused on APIs, reliability, and developer tooling.",
    applicationUrl: "https://www.atlassian.com/company/careers/details/789",
    sourceUrl: "https://www.atlassian.com/company/careers/details/789",
    deadline: "2026-06-26T23:59:00.000Z",
    minCgpa: 8.2,
    allowedBranches: ["Computer Science"],
    allowedBatchYears: [2027],
    postedAt: "2026-06-09T06:30:00.000Z"
  })
];
