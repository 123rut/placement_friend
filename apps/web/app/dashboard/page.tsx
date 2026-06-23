import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import DashboardClient from "../../components/DashboardClient";

const categoryLabels: Record<string, string> = {
  "it-product": "IT Product",
  "it-service": "IT Service",
  core: "Core",
  consulting: "Consulting",
  bfsi: "BFSI",
  startup: "Startup"
};

const isEligible = (student: any, company: any) => {
  const eligibleBranches = company.eligible_branches
    ? company.eligible_branches.split(',').map((s: string) => s.trim())
    : [];
  
  const branchEligible =
    eligibleBranches.length === 0 || eligibleBranches.includes(student.branch);
    
  const minCgpa = company.min_cgpa ? parseFloat(company.min_cgpa) : null;
  const studentCgpa = student.cgpa ? parseFloat(student.cgpa) : 0;
  
  const cgpaEligible = minCgpa === null || studentCgpa >= minCgpa;
  return branchEligible && cgpaEligible;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Query student profile with college relationship
  console.log("DASHBOARD - User ID in session:", user.id);
  const { data: student, error } = await supabase
    .from("students")
    .select("*, colleges(name)")
    .eq("id", user.id)
    .maybeSingle();
  console.log("DASHBOARD - Query student data:", student);
  if (error) {
    console.error("DASHBOARD - Query student error:", error);
  }

  // If student profile is missing, redirect to onboarding form at root
  if (!student) {
    console.log("DASHBOARD - Profile missing. Redirecting to onboarding...");
    redirect("/");
  }

  // 3. Query colleges count for stats
  const { count: collegesCount } = await supabase
    .from("colleges")
    .select("*", { count: "exact", head: true });

  // 4. Query companies
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .eq("is_active", true);

  // 5. Query user's company targets with notification preferences
  const { data: targets } = await supabase
    .from("student_company_targets")
    .select("company_id, notify_email, notify_dashboard, companies(name, category)")
    .eq("student_id", user.id);

  const activeCompanies = companies || [];
  const eligibleCompanies = activeCompanies.filter(c => isEligible(student, c));

  const companyTargets = (targets || []).map((t: any) => ({
    company_id: t.company_id,
    name: t.companies?.name || "Unknown Company",
    category: t.companies?.category || "core",
    notify_email: t.notify_email ?? true,
    notify_dashboard: t.notify_dashboard ?? true
  }));

  const categoryCounts = Object.entries(categoryLabels).map(([key, label]) => ({
    category: key,
    label,
    count: activeCompanies.filter(c => c.category === key).length
  }));

  const collegeName = (student.colleges as any)?.name || "Unknown College";

  return (
    <DashboardClient
      student={student as any}
      collegesCount={collegesCount || 0}
      initialTargets={companyTargets}
      eligibleCount={eligibleCompanies.length}
      categoryCounts={categoryCounts}
      collegeName={collegeName}
    />
  );
}
