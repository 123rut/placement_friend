import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import { SprintOneShell } from "./sprint-one-shell";
import { seedCompanies } from "@piaa/domain";
import { getAllCollegesDb } from "../lib/supabase/colleges";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Authenticate user session
  if (!user) {
    redirect("/login");
  }

  // 2. Query students table for profile existence
  const { data: studentProfile } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // 3. Skip onboarding and go directly to dashboard if profile exists
  if (studentProfile) {
    redirect("/dashboard");
  }

  // 4. Fetch colleges dynamically from the live database for college selection/validation
  const collegesList = await getAllCollegesDb(supabase);

  // Convert schema format to domain format for dropdown
  const colleges = collegesList.map(c => ({
    id: c.id,
    name: c.name,
    emailDomain: c.email_domain,
    city: c.city,
    state: c.state,
    type: c.type as "government" | "private" | "deemed"
  }));

  return (
    <SprintOneShell
      colleges={colleges}
      companies={seedCompanies}
      user={user}
      existingProfile={null}
    />
  );
}
