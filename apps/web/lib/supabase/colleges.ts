import { SupabaseClient } from "@supabase/supabase-js";
import { colleges as domainColleges, findCollegeById, getCollegeByEmail, type College } from "@piaa/domain";

export interface CollegeDb {
  id: string;
  name: string;
  email_domain: string;
  city: string;
  state: string;
  type: string;
  created_at?: string;
}

/**
 * Merges raw database college rows with the static domain catalog,
 * ensuring deduplication by ID with database records taking precedence.
 */
export function mergeColleges(dbColleges: any[] = []): College[] {
  const collegeMap = new Map<string, College>();

  // Add domain catalog colleges first
  for (const c of domainColleges) {
    collegeMap.set(c.id.toLowerCase(), c);
  }

  // Database colleges override domain catalog
  for (const c of dbColleges) {
    if (!c || !c.id) continue;
    collegeMap.set(c.id.toLowerCase(), {
      id: c.id,
      name: c.name,
      emailDomain: c.email_domain ?? c.emailDomain ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      type: c.type ?? "private",
    });
  }

  return Array.from(collegeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Retrieves all college records from the database merged with the domain catalog.
 */
export async function getMergedColleges(supabase: SupabaseClient): Promise<College[]> {
  try {
    const { data, error } = await supabase
      .from("colleges")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      return mergeColleges(data);
    }
  } catch (err) {
    console.error("Error loading colleges from database:", err);
  }

  return mergeColleges([]);
}

function toCollegeDb(college: College): CollegeDb {
  return {
    id: college.id,
    name: college.name,
    email_domain: college.emailDomain,
    city: college.city,
    state: college.state,
    type: college.type,
  };
}

/**
 * Resolves a college record based on the email address's domain.
 * Queries Supabase database first, then falls back to static domain catalog.
 */
export async function getCollegeByEmailDb(supabase: SupabaseClient, email: string): Promise<CollegeDb | null> {
  if (!email || typeof email !== "string" || !email.includes("@")) return null;
  const parts = email.trim().toLowerCase().split("@");
  const domain = parts[parts.length - 1];
  if (!domain) return null;
  
  try {
    const { data, error } = await supabase
      .from("colleges")
      .select("*")
      .eq("email_domain", domain)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.error("Error fetching college by email domain from DB:", err);
  }

  // Fallback to domain catalog
  const fallback = getCollegeByEmail(email);
  return fallback ? toCollegeDb(fallback) : null;
}

/**
 * Resolves a college record by its ID.
 */
export async function getCollegeByIdDb(supabase: SupabaseClient, id: string): Promise<CollegeDb | null> {
  if (!id || typeof id !== "string") return null;

  try {
    const { data, error } = await supabase
      .from("colleges")
      .select("*")
      .eq("id", id.trim())
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.error("Error fetching college by id from DB:", err);
  }

  const fallback = findCollegeById(id);
  return fallback ? toCollegeDb(fallback) : null;
}


/**
 * Retrieves all college records from the database.
 */
export async function getAllCollegesDb(supabase: SupabaseClient): Promise<CollegeDb[]> {
  try {
    const { data, error } = await supabase
      .from("colleges")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.error("Error fetching all colleges from DB:", err);
  }
  return [];
}


