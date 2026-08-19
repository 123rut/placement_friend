import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "../../../lib/supabase/server";
import { ProfileEditShell } from "./profile-edit-shell";
import { getMergedColleges } from "../../../lib/supabase/colleges";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Authenticate user session
  if (!user) {
    redirect("/login");
  }

  // 2. Query student profile from the database using authenticated session client
  let student: any = null;

  const { data: authStudent } = await supabase
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  student = authStudent;

  if (!student && user.email) {
    const { data: emailStudent } = await supabase
      .from("students")
      .select("*")
      .eq("college_email", user.email)
      .maybeSingle();
    student = emailStudent;
  }

  if (!student && process.env.NEXT_PRIVATE_SUPABASE_SERVICE_KEY) {
    try {
      const adminDb = createAdminClient();
      const { data: adminStudent } = await adminDb
        .from("students")
        .select("*")
        .or(`id.eq.${user.id},college_email.eq.${user.email}`)
        .maybeSingle();
      if (adminStudent) student = adminStudent;
    } catch {}
  }

  // If student profile does not exist yet, prepare clean default profile
  const defaultStudent = student || {
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
    is_new: true,
  };




  // 3. Query all colleges from database and merge with domain catalog (deduplicated)
  const allColleges = await getMergedColleges(supabase);

  // 4. Query all companies from companies table to keep in sync with database records
  const { data: dbCompanies } = await supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });

  const mappedCompanies = (dbCompanies || []).map((c: any) => {
    let branches: string[] = [];
    if (typeof c.eligible_branches === "string") {
      try {
        const parsed = JSON.parse(c.eligible_branches);
        branches = Array.isArray(parsed) ? parsed : [c.eligible_branches];
      } catch {
        branches = c.eligible_branches.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(c.eligible_branches)) {
      branches = c.eligible_branches;
    }

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      category: c.category,
      eligibleBranches: branches,
      minCgpa: c.min_cgpa ? parseFloat(c.min_cgpa) : null,
      avgPackageLpa: c.avg_package ? parseFloat(c.avg_package) : null,
    };
  });

  // 5. Query candidate_profiles (resume, skills, experience, preferences)
  let candidateProfile: any = null;
  const { data: authCandidateProfile } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  candidateProfile = authCandidateProfile;

  if (!candidateProfile && process.env.NEXT_PRIVATE_SUPABASE_SERVICE_KEY) {
    try {
      const adminDb = createAdminClient();
      const { data: adminCandidateProfile } = await adminDb
        .from("candidate_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (adminCandidateProfile) candidateProfile = adminCandidateProfile;
    } catch {}
  }


  // 6. Query tracked companies from student_company_targets table
  const { data: targets } = await supabase
    .from("student_company_targets")
    .select("company_id")
    .eq("student_id", user.id);

  const initialSelectedCompanyIds = targets?.map(t => t.company_id) || [];

  return (
    <ProfileEditShell
      user={user}
      profile={defaultStudent}
      initialCandidateProfile={candidateProfile}
      colleges={allColleges}
      companies={mappedCompanies as any}
      initialSelectedCompanyIds={initialSelectedCompanyIds}
    />
  );
}


