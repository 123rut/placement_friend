import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { seedCompanies } from "@piaa/domain";
import WatchlistClient from "../../../components/WatchlistClient";

export default async function WatchlistPage() {
  const supabase = await createClient();

  // 1. Authenticate user session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Query student profile
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!student) {
    redirect("/");
  }

  return (
    <WatchlistClient
      userId={user.id}
      seedCompanies={seedCompanies}
    />
  );
}
