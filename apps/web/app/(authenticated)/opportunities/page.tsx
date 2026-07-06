import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import OpportunitiesClient from "../../../components/OpportunitiesClient";

export default async function OpportunitiesPage() {
  const supabase = await createClient();

  // 1. Authenticate user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Query student profile from the database
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!student) {
    redirect("/");
  }

  return (
    <OpportunitiesClient student={student as any} />
  );
}
