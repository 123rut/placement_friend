import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { ProfileEditShell } from "./profile-edit-shell";
import { seedCompanies } from "@piaa/domain";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Authenticate user session
  if (!user) {
    redirect("/login");
  }

  // 2. Query student profile from the database
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // If student profile does not exist yet, they need to onboard first
  if (!student) {
    redirect("/");
  }

  // 3. Query all companies from companies table to keep in sync with database records
  const { data: dbCompanies } = await supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });

  const mappedCompanies = (dbCompanies || []).map((c: any) => {
    let branches: string[] = [];
    if (typeof c.eligible_branches === "string") {
      try {
        const parsed = JSON.parse(c.eligible_branches);
        branches = Array.isArray(parsed) ? parsed : [c.eligible_branches];
      } catch {
        branches = c.eligible_branches.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(c.eligible_branches)) {
      branches = c.eligible_branches;
    }

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      category: c.category,
      eligibleBranches: branches,
      minCgpa: c.min_cgpa ? parseFloat(c.min_cgpa) : null,
      avgPackageLpa: c.avg_package ? parseFloat(c.avg_package) : null,
    };
  });

  // 4. Query tracked companies from student_company_targets table
  const { data: targets } = await supabase
    .from("student_company_targets")
    .select("company_id")
    .eq("student_id", user.id);

  const initialSelectedCompanyIds = targets?.map(t => t.company_id) || [];

  return (
    <ProfileEditShell
      user={user}
      profile={student}
      companies={mappedCompanies as any}
      initialSelectedCompanyIds={initialSelectedCompanyIds}
    />
  );
}
