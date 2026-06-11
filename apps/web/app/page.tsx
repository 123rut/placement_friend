import { redirect } from "next/navigation";
import { colleges, seedCompanies } from "@piaa/domain";
import { SprintOneShell } from "./sprint-one-shell";
import { createClient } from "../lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if student profile exists
  const { data: studentProfile } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <SprintOneShell
      colleges={colleges}
      companies={seedCompanies}
      user={user}
      existingProfile={studentProfile}
    />
  );
}
