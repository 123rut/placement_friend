import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import DashboardOverview from "../../../components/DashboardOverview";
import { getCareerPilotApiBaseUrl } from "../../api/careerpilot/_lib";

export const dynamic = "force-dynamic";

function formatTimeAgo(dateStr: string | Date) {
  if (!dateStr) return "Never";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

interface ActivityEvent {
  companyName: string;
  message: string;
  timeAgo: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Authenticate user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Query student profile
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!student) {
    redirect("/");
  }

  // 3. Query tracked company IDs
  const { data: targets } = await supabase
    .from("student_company_targets")
    .select("company_id")
    .eq("student_id", user.id);
  
  const trackedCompanyIds = (targets || []).map((t) => t.company_id);
  const targetsCount = trackedCompanyIds.length;

  // 4. Load experience details server-side from Nest API to calculate profile completeness
  let experiences = [];
  try {
    const res = await fetch(`${getCareerPilotApiBaseUrl()}/resume/${user.id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const resumeData = await res.json();
      experiences = resumeData.experience || [];
    }
  } catch (err) {
    console.error("Failed to load experiences server-side:", err);
  }

  // Calculate completeness:
  let completeness = 0;
  if (student.full_name?.trim()) completeness += 20;
  if (student.branch) completeness += 20;
  const parsedCgpa = parseFloat(student.cgpa as any);
  if (!isNaN(parsedCgpa) && parsedCgpa > 0) completeness += 20;
  if (student.batch_year) completeness += 20;
  if (experiences.length > 0) completeness += 20;

  // 5. Query dashboard summary metrics
  let newJobsTodayCount = 0;
  let lastSyncTimeStr = "Never";
  let recentActivity: ActivityEvent[] = [];

  if (trackedCompanyIds.length > 0) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query new jobs count
    const { count: newJobsCount } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .in("company_id", trackedCompanyIds)
      .gte("created_at", oneDayAgo);
    newJobsTodayCount = newJobsCount || 0;

    // Fetch company records to map company name and calculate max scraped time
    const { data: dbCompanies } = await supabase
      .from("companies")
      .select("id, name, last_scraped_at")
      .in("id", trackedCompanyIds);

    let maxLastScraped: Date | null = null;
    (dbCompanies || []).forEach((c) => {
      if (c.last_scraped_at) {
        const d = new Date(c.last_scraped_at);
        if (!maxLastScraped || d > maxLastScraped) {
          maxLastScraped = d;
        }
      }
    });

    if (maxLastScraped) {
      lastSyncTimeStr = formatTimeAgo(maxLastScraped);
    }

    // Query 5 most recent sync logs
    const { data: syncLogs } = await supabase
      .from("sync_logs")
      .select("created_at, jobs_found, jobs_new, status, company_id")
      .in("company_id", trackedCompanyIds)
      .order("created_at", { ascending: false })
      .limit(5);

    recentActivity = (syncLogs || []).map((log: any) => {
      const company = dbCompanies?.find((c) => c.id === log.company_id);
      const companyName = company?.name || log.company_id;
      let message = "Registry checked";
      if (log.status === "failed") {
        message = "Sync failed";
      } else if (log.jobs_new > 0) {
        message = `${log.jobs_new} new jobs discovered`;
      } else if (log.jobs_found > 0) {
        message = `Registry checked (${log.jobs_found} jobs found)`;
      } else {
        message = `Registry synchronized`;
      }
      return {
        companyName,
        message,
        timeAgo: formatTimeAgo(log.created_at),
      };
    });
  }

  const dashboardSummary = {
    newJobsToday: newJobsTodayCount,
    lastSync: lastSyncTimeStr,
    recentActivity,
  };

  return (
    <DashboardOverview
      student={student as any}
      initialTargetsCount={targetsCount}
      profileCompleteness={completeness}
      dashboardSummary={dashboardSummary}
    />
  );
}
