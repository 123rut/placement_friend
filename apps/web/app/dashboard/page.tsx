import Link from "next/link";
import { getDashboardData } from "../../lib/dashboard";
import { categoryLabels } from "../../lib/sprint-one";

export default function DashboardPage() {
  const data = getDashboardData();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="topbar-kicker">Foundation dashboard</div>
          <h1>{data.student.fullName.split(" ")[0]}'s Sprint 1 workspace</h1>
        </div>
        <nav className="topbar-actions">
          <span className="pill">{data.student.collegeName}</span>
          <Link className="primary-link" href="/">
            Back to onboarding
          </Link>
        </nav>
      </header>

      <section className="workspace-section metrics-grid">
        <article className="metric-panel">
          <span className="metric-label">Mapped colleges</span>
          <strong>{data.stats.colleges}</strong>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Seeded companies</span>
          <strong>{data.stats.seededCompanies}</strong>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Profile-matched companies</span>
          <strong>{data.stats.eligibleCompanies}</strong>
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
              <div className="summary-value">{data.student.email}</div>
            </div>
            <div>
              <div className="summary-label">Branch</div>
              <div className="summary-value">{data.student.branch}</div>
            </div>
            <div>
              <div className="summary-label">CGPA</div>
              <div className="summary-value">{data.student.cgpa}</div>
            </div>
            <div>
              <div className="summary-label">Batch year</div>
              <div className="summary-value">{data.student.batchYear}</div>
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
            {data.categoryCounts.map((item) => (
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
            {data.trackedCompanies.map((company) => (
              <div className="compact-row" key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <p>{company.careersUrl}</p>
                </div>
                <span className="tile-badge">{categoryLabels[company.category]}</span>
              </div>
            ))}
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
            {data.eligibleCompanies.slice(0, 12).map((company) => (
              <div className="compact-row" key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <p>{company.eligibleBranches.join(", ")}</p>
                </div>
                <span className="tile-badge">{company.minCgpa ?? "Open"} CGPA</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
