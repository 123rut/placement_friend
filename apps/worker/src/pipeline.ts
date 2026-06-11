import { createOpportunity, matchStudentToOpportunity } from "@piaa/domain";
import type { Opportunity, OpportunityMatch, StudentProfile } from "@piaa/domain";
import { scrapedInputs, students, trackedCompanies } from "./data";

type PipelineResult = {
  opportunities: Opportunity[];
  matches: OpportunityMatch[];
  notificationsToSend: Array<{
    studentId: string;
    opportunityId: string;
    channel: "email" | "dashboard";
  }>;
};

const shouldNotify = (student: StudentProfile, opportunityId: string, priorNotifications: Set<string>) =>
  !priorNotifications.has(`${student.id}:${opportunityId}`);

export const runPipeline = (): PipelineResult => {
  const activeCompanyIds = new Set(trackedCompanies.filter((company) => company.isActive).map((company) => company.id));

  const opportunities = scrapedInputs
    .filter((item) => activeCompanyIds.has(item.companyId))
    .map(createOpportunity);

  const matches = students.flatMap((student) =>
    opportunities.map((opportunity) => matchStudentToOpportunity(student, opportunity))
  );

  const priorNotifications = new Set<string>();

  const notificationsToSend = matches
    .filter((match) => match.qualifies)
    .flatMap((match) => {
      const student = students.find((item) => item.id === match.studentId);

      if (!student || !shouldNotify(student, match.opportunityId, priorNotifications)) {
        return [];
      }

      priorNotifications.add(`${student.id}:${match.opportunityId}`);

      return [
        {
          studentId: student.id,
          opportunityId: match.opportunityId,
          channel: "email" as const
        },
        {
          studentId: student.id,
          opportunityId: match.opportunityId,
          channel: "dashboard" as const
        }
      ];
    });

  return {
    opportunities,
    matches,
    notificationsToSend
  };
};
