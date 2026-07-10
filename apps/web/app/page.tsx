import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let user = null;
  let studentProfile = null;

  try {
    console.log("Step 1: Creating Supabase client");
    const supabase = await createClient();

    console.log("Step 2: Getting user");
    const {
      data: { user: supabaseUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.log("getUser status:", userError.message);
    }

    user = supabaseUser;

    if (user) {
      console.log("Step 3: Querying students table");
      const { data: profile, error: profileError } = await supabase
        .from("students")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Student query error:", profileError);
        throw profileError;
      }

      console.log("Profile exists:", !!profile);
      studentProfile = profile;
    }
  } catch (err) {
    console.error("HOME PAGE ERROR:", err);
    throw err;
  }

  // Handle redirects outside the try-catch block so Next.js redirect errors are not caught
  if (!user) {
    redirect("/login");
  }

  if (studentProfile) {
    redirect("/dashboard");
  }

  redirect("/profile");
}