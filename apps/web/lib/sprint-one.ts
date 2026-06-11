import { colleges, seedCompanies } from "@piaa/domain";
import type { Company, CompanyCategory, StudentProfile } from "@piaa/domain";

export const branchOptions = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Electrical",
  "Mechanical",
  "Civil"
];

export const categoryLabels: Record<CompanyCategory, string> = {
  "it-product": "IT Product",
  "it-service": "IT Service",
  core: "Core",
  consulting: "Consulting",
  bfsi: "BFSI",
  startup: "Startup"
};

export const sprintOneStudent: StudentProfile = {
  id: "student-001",
  fullName: "Riya Sharma",
  email: "riya.sharma@nitt.edu",
  collegeId: "nit-trichy",
  collegeName: "National Institute of Technology Tiruchirappalli",
  branch: "Computer Science",
  cgpa: 8.6,
  batchYear: 2027,
  isVerified: true,
  trackedCompanyIds: ["google", "microsoft", "atlassian", "zoho", "walmart-global-tech"]
};

export const isEligibleForSprintOneProfile = (student: StudentProfile, company: Company) => {
  const branchEligible =
    company.eligibleBranches.length === 0 || company.eligibleBranches.includes(student.branch);
  const cgpaEligible = company.minCgpa === null || student.cgpa >= company.minCgpa;
  return branchEligible && cgpaEligible;
};

export const getSprintOneDashboardData = () => {
  const trackedCompanies = seedCompanies.filter((company) =>
    sprintOneStudent.trackedCompanyIds.includes(company.id)
  );

  const eligibleCompanies = seedCompanies.filter((company) =>
    isEligibleForSprintOneProfile(sprintOneStudent, company)
  );

  const categoryCounts = Object.entries(categoryLabels).map(([key, label]) => ({
    category: key as CompanyCategory,
    label,
    count: seedCompanies.filter((company) => company.category === key).length
  }));

  return {
    student: sprintOneStudent,
    trackedCompanies,
    eligibleCompanies,
    categoryCounts,
    stats: {
      colleges: colleges.length,
      seededCompanies: seedCompanies.length,
      eligibleCompanies: eligibleCompanies.length
    }
  };
};
