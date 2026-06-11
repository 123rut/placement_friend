import { seedCompanies } from "@piaa/domain";
import type { Company, ScrapedOpportunityInput, StudentProfile } from "@piaa/domain";

export const trackedCompanies: Company[] = seedCompanies.filter((company) =>
  ["google", "atlassian"].includes(company.id)
);

export const students: StudentProfile[] = [
  {
    id: "student-001",
    fullName: "Riya Sharma",
    email: "riya.sharma@nitt.edu",
    collegeId: "nit-trichy",
    collegeName: "National Institute of Technology Tiruchirappalli",
    branch: "Computer Science",
    cgpa: 8.6,
    batchYear: 2027,
    isVerified: true,
    trackedCompanyIds: ["google", "atlassian"]
  }
];

export const scrapedInputs: ScrapedOpportunityInput[] = [
  {
    companyId: "google",
    title: "Software Engineering Intern",
    roleType: "internship",
    location: "Bengaluru",
    description: "Distributed systems internship from Google Careers.",
    applicationUrl: "https://careers.google.com/jobs/results/123",
    sourceUrl: "https://careers.google.com/jobs/results/123",
    minCgpa: 8,
    allowedBranches: ["Computer Science", "Information Technology"],
    allowedBatchYears: [2027],
    deadline: "2026-06-22T23:59:00.000Z"
  },
  {
    companyId: "atlassian",
    title: "Backend Engineering Intern",
    roleType: "internship",
    location: "Remote",
    description: "Backend systems internship from Atlassian careers.",
    applicationUrl: "https://www.atlassian.com/company/careers/details/789",
    sourceUrl: "https://www.atlassian.com/company/careers/details/789",
    minCgpa: 8.2,
    allowedBranches: ["Computer Science"],
    allowedBatchYears: [2027],
    deadline: "2026-06-26T23:59:00.000Z"
  }
];
