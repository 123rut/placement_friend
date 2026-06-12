import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

const categoryLabels: Record<string, string> = {
  "it-product": "IT Product",
  "it-service": "IT Service",
  core: "Core",
  consulting: "Consulting",
  bfsi: "BFSI",
  startup: "Startup"
};

const isEligible = (student: any, company: any) => {
  const eligibleBranches = company.eligible_branches
    ? company.eligible_branches.split(',').map((s: string) => s.trim())
    : [];
  
  const branchEligible =
    eligibleBranches.length === 0 || eligibleBranches.includes(student.branch);
    
  const minCgpa = company.min_cgpa ? parseFloat(company.min_cgpa) : null;
  const studentCgpa = student.cgpa ? parseFloat(student.cgpa) : 0;
  
  const cgpaEligible = minCgpa === null || studentCgpa >= minCgpa;
  return branchEligible && cgpaEligible;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Query student profile with college relationship
  const { data: student } = await supabase
    .from("students")
    .select("*, colleges(name)")
    .eq("id", user.id)
    .maybeSingle();

  // If student profile is missing, redirect to onboarding form at root
  if (!student) {
    redirect("/");
  }

  // 3. Query colleges count for stats
  const { count: collegesCount } = await supabase
    .from("colleges")
    .select("*", { count: "exact", head: true });

  // 4. Query companies
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .eq("is_active", true);

  // 5. Query user's company targets
  const { data: targets } = await supabase
    .from("student_company_targets")
    .select("company_id")
    .eq("student_id", user.id);

  const trackedCompanyIds = targets?.map(t => t.company_id) || [];
  const activeCompanies = companies || [];
  const trackedCompanies = activeCompanies.filter(c => trackedCompanyIds.includes(c.id));
  const eligibleCompanies = activeCompanies.filter(c => isEligible(student, c));

  const categoryCounts = Object.entries(categoryLabels).map(([key, label]) => ({
    category: key,
    label,
    count: activeCompanies.filter(c => c.category === key).length
  }));

  const collegeName = (student.colleges as any)?.name || "Unknown College";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="topbar-kicker">Foundation dashboard</div>
          <h1>{student.full_name.split(" ")[0]}'s Sprint 1.5 workspace</h1>
        </div>
        <nav className="topbar-actions">
          <span className="pill">{collegeName}</span>
          <Link className="primary-link" href="/profile">
            Edit Profile
          </Link>
        </nav>
      </header>

      <section className="workspace-section metrics-grid">
        <article className="metric-panel">
          <span className="metric-label">Mapped colleges</span>
          <strong>{collegesCount || 0}</strong>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Seeded companies</span>
          <strong>{activeCompanies.length}</strong>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Profile-matched companies</span>
          <strong>{eligibleCompanies.length}</strong>
        </article>
      </section>

      <section className="workspace-section dashboard-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Student profile</div>
              <h2>Verified foundation data</h2>
            </div>
            <span className="status-good">Verified</span>
          </div>
          <div className="summary-grid">
            <div>
              <div className="summary-label">Email</div>
              <div className="summary-value">{student.college_email}</div>
            </div>
            <div>
              <div className="summary-label">Branch</div>
              <div className="summary-value">{student.branch}</div>
            </div>
            <div>
              <div className="summary-label">CGPA</div>
              <div className="summary-value">{parseFloat(student.cgpa).toFixed(2)}</div>
            </div>
            <div>
              <div className="summary-label">Batch year</div>
              <div className="summary-value">{student.batch_year}</div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Coverage</div>
              <h2>Company categories</h2>
            </div>
          </div>
          <div className="category-list">
            {categoryCounts.map((item) => (
              <div className="category-row" key={item.category}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace-section dashboard-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Targets</div>
              <h2>Selected companies</h2>
            </div>
          </div>
          <div className="compact-list">
            {trackedCompanies.length > 0 ? (
              trackedCompanies.map((company) => (
                <div className="compact-row" key={company.id}>
                  <div>
                    <strong>{company.name}</strong>
                    <p>{company.careers_url}</p>
                  </div>
                  <span className="tile-badge">{categoryLabels[company.category]}</span>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--muted)', padding: '12px 0' }}>No companies selected yet.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Eligible set</div>
              <h2>Profile-ready companies</h2>
            </div>
          </div>
          <div className="compact-list">
            {eligibleCompanies.slice(0, 12).map((company) => (
              <div className="compact-row" key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <p>{company.eligible_branches}</p>
                </div>
                <span className="tile-badge">{company.min_cgpa ?? "Open"} CGPA</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
