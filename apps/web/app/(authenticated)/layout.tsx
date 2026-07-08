import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "../../lib/supabase/server";
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

  // 2. Query student profile with college name
  const { data: student, error } = await supabase
    .from("students")
    .select("*, colleges(name)")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Layout auth query error:", error);
  }

  // 3. Safe fallback profile for first-time profile creation layout view
  const defaultStudent = student || {
    id: user.id,
    full_name: user.email?.split("@")[0] || "New Student",
    college_email: user.email || "",
    branch: "Computer Science",
    cgpa: "8.0",
    batch_year: new Date().getFullYear() + 2,
    colleges: null,
    is_new: true
  };

  return (
    <DashboardShell student={defaultStudent as any} user={user}>
      {children}
    </DashboardShell>
  );
}

