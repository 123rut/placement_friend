import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";

export default async function HomePage() {
  try {
    console.log("Step 1: Creating Supabase client");
    const supabase = await createClient();

    console.log("Step 2: Getting user");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("getUser error:", userError);
      throw userError;
    }

    console.log("User:", user?.id);

    if (!user) {
      redirect("/login");
    }

    console.log("Step 3: Querying students table");

    const { data: studentProfile, error: profileError } = await supabase
      .from("students")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Student query error:", profileError);
      throw profileError;
    }

    console.log("Profile exists:", !!studentProfile);

    if (studentProfile) {
      redirect("/dashboard");
    }

    redirect("/profile");
  } catch (err) {
    console.error("HOME PAGE ERROR:", err);
    throw err;
  }
}