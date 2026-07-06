import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import DashboardShell from "../../components/DashboardShell";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const supabase = await createClient();

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

  // 3. If student profile does not exist yet, they must onboard first at root "/"
  if (!student) {
    redirect("/");
  }

  return (
    <DashboardShell student={student as any} user={user}>
      {children}
    </DashboardShell>
  );
}
