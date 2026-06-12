import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
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

  // 3. Query tracked companies from student_company_targets table
  const { data: targets } = await supabase
    .from("student_company_targets")
    .select("company_id")
    .eq("student_id", user.id);

  const initialSelectedCompanyIds = targets?.map(t => t.company_id) || [];

  return (
    <ProfileEditShell
      user={user}
      profile={student}
      companies={seedCompanies}
      initialSelectedCompanyIds={initialSelectedCompanyIds}
    />
  );
}
