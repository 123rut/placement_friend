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
      const { data: profile } = await supabase
        .from("students")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      studentProfile = profile;

      if (!studentProfile && user.email) {
        const { data: emailProfile } = await supabase
          .from("students")
          .select("*")
          .eq("college_email", user.email)
          .maybeSingle();
        studentProfile = emailProfile;
      }

      console.log("Profile exists:", !!studentProfile);
    }
  } catch (err) {
    console.error("HOME PAGE ERROR:", err);
  }


  // Handle redirects outside the try-catch block so Next.js redirect errors are not caught
  if (!user) {
    redirect("/login");
  }

  const hasCgpa = studentProfile?.cgpa !== null && studentProfile?.cgpa !== undefined && studentProfile?.cgpa !== "";
  const hasCollege = Boolean(studentProfile?.college_id || studentProfile?.custom_institution_name);
  const isProfileComplete = Boolean(
    studentProfile &&
    studentProfile.full_name?.trim() &&
    studentProfile.branch?.trim() &&
    hasCgpa &&
    hasCollege
  );

  if (isProfileComplete) {
    redirect("/dashboard");
  }

  redirect("/profile");
}