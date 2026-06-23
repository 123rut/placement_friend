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
  console.log("HOMEPAGE - User ID in session:", user.id);
  console.log("HOMEPAGE - User email in session:", user.email);
  const { data: studentProfile, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  console.log("HOMEPAGE - Query studentProfile data:", studentProfile);
  if (error) {
    console.error("HOMEPAGE - Query studentProfile error:", error);
  }

  // 3. Skip onboarding and go directly to dashboard if profile exists
  if (studentProfile) {
    console.log("HOMEPAGE - Profile found. Redirecting to dashboard...");
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
