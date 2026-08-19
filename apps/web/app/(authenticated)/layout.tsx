import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient, createClient } from "../../lib/supabase/server";
import DashboardShell from "../../components/DashboardShell";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const supabase = await createClient();
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";

  // 1. Authenticate user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const adminDb = createAdminClient();

  // 2. Query student profile with college name
  const { data: student, error } = await adminDb
    .from("students")
    .select("*, colleges(name)")
    .or(`id.eq.${user.id},college_email.eq.${user.email}`)
    .maybeSingle();

  const isProfileComplete = Boolean(
    student &&
    student.full_name &&
    student.branch &&
    student.cgpa &&
    (student.college_id || student.custom_institution_name)
  );

  // If profile is not complete, redirect to /profile
  if (!isProfileComplete && pathname && pathname !== "/profile" && !pathname.startsWith("/api")) {
    redirect("/profile");
  }

  // 3. Safe fallback profile for first-time profile creation layout view
  const defaultStudent = student
    ? { ...student, is_new: !isProfileComplete }
    : {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        college_email: user.email || "",
        college_id: null,
        custom_institution_name: null,
        institution_source: null,
        institution_verified: false,
        branch: "",
        cgpa: "",
        batch_year: 2027,
        colleges: null,
        is_new: true,
      };


  return (
    <DashboardShell student={defaultStudent as any} user={user}>
      {children}
    </DashboardShell>
  );
}


