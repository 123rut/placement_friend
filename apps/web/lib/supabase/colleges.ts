import { SupabaseClient } from "@supabase/supabase-js";

export interface CollegeDb {
  id: string;
  name: string;
  email_domain: string;
  city: string;
  state: string;
  type: string;
  created_at: string;
}

/**
 * Resolves a college record based on the email address's domain.
 */
export async function getCollegeByEmailDb(supabase: SupabaseClient, email: string): Promise<CollegeDb | null> {
  if (!email || !email.includes("@")) return null;
  const domain = email.trim().toLowerCase().split("@")[1];
  
  const { data, error } = await supabase
    .from("colleges")
    .select("*")
    .eq("email_domain", domain)
    .maybeSingle();

  if (error) {
    console.error("Error fetching college by email domain:", error.message);
    return null;
  }
  return data;
}

/**
 * Retrieves all college records from the database.
 */
export async function getAllCollegesDb(supabase: SupabaseClient): Promise<CollegeDb[]> {
  const { data, error } = await supabase
    .from("colleges")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching all colleges:", error.message);
    return [];
  }
  return data || [];
}
