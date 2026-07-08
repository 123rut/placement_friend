import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Redirect immediately if not authenticated
  if (!user) {
    redirect("/login");
  }

  // 2. Query students table for profile existence
  const { data: studentProfile } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // 3. Redirect to dashboard if profile exists, otherwise to profile setup
  if (studentProfile) {
    redirect("/dashboard");
  } else {
    redirect("/profile");
  }
}

