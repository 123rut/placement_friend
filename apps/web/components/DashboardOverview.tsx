"use client";
 
import React, { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
 
interface Student {
  id: string;
  full_name: string;
  college_email: string;
  branch: string;
  cgpa: string;
  batch_year: number;
}
 
interface ActivityEvent {
  companyName: string;
  message: string;
  timeAgo: string;
}
 
interface DashboardSummary {
  newJobsToday: number;
  lastSync: string;
  recentActivity: ActivityEvent[];
}
 
interface DashboardOverviewProps {
  student: Student;
  initialTargetsCount: number;
  profileCompleteness: number;
  dashboardSummary: DashboardSummary;
}
 
const fetcher = (url: string) => fetch(url).then((res) => res.json());
 
export default function DashboardOverview({
  student,
  initialTargetsCount,
  profileCompleteness,
  dashboardSummary,
}: DashboardOverviewProps) {
  // SWR Caching: load matched jobs
  const { data: matchedJobsData } = useSWR("/api/careerpilot/jobs", fetcher, {
    revalidateOnFocus: false,
  });
  
  const matchedJobs = useMemo(
    () => (Array.isArray(matchedJobsData) ? matchedJobsData : []),
    [matchedJobsData],
  );
  const firstName = student.full_name.split(" ")[0];
  const [oppsHovered, setOppsHovered] = useState(false);
 
  const focusNote = useMemo(() => {
    const branchVal = student.branch.toLowerCase();
    if (branchVal.includes("computer")) {
      return "Push backend and systems roles first. Your profile is already aligned with the strongest software tracks.";
    }
    if (branchVal.includes("electronics")) {
      return "Blend software roles with platform and systems openings to widen the match surface.";
    }
    return "Use the watchlist to bias toward flexible employers, then tighten the shortlist with profile edits.";
  }, [student.branch]);
 
  // Display top 3 highest matching jobs
  const topRecommendations = useMemo(() => {
    return matchedJobs
      .filter((job) => job.match_score !== null)
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, 3);
  }, [matchedJobs]);
 
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header welcome banner */}
      <div>
        <span className="topbar-kicker">Command Center</span>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "4px 0 0" }}>
          Welcome back, {firstName}
        </h1>
        <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.95rem" }}>
          Your academic identity is verified. Use the persistent Copilot chat at the bottom right to ask career questions.
        </p>
      </div>
 
      {/* 2. Compact Hero Section */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
        <article className="hero-card" style={{ padding: "16px 20px" }}>
          <div className="section-label" style={{ marginBottom: "6px" }}>AI Career Insight</div>
          <h2 style={{ fontSize: "1.25rem", margin: "0 0 6px" }}>Clean career baseline focused on your target scope.</h2>
          <p className="hero-copy" style={{ fontSize: "0.88rem", margin: "0 0 12px", lineHeight: "1.4" }}>{focusNote}</p>
          <div className="hero-stat-row" style={{ marginTop: "12px", gap: "24px" }}>
            <div className="hero-stat">
              <span style={{ fontSize: "0.72rem" }}>Branch</span>
              <strong style={{ fontSize: "0.92rem" }}>{student.branch}</strong>
            </div>
            <div className="hero-stat">
              <span style={{ fontSize: "0.72rem" }}>CGPA</span>
              <strong style={{ fontSize: "0.92rem" }}>{Number.parseFloat(student.cgpa).toFixed(2)}</strong>
            </div>
            <div className="hero-stat">
              <span style={{ fontSize: "0.72rem" }}>Batch Completion Year</span>
              <strong style={{ fontSize: "0.92rem" }}>{student.batch_year}</strong>
            </div>
          </div>
        </article>
      </section>
 
      {/* 3. KPI Cards Row */}
      <section className="metrics-grid">
        <article className="metric-panel">
          <span className="metric-label">Tracked Companies</span>
          <strong>{initialTargetsCount}</strong>
          <span className="metric-footnote">Active watchlisted companies</span>
        </article>
        <article className="metric-panel">
          <span className="metric-label">New Jobs Today</span>
          <strong>{dashboardSummary.newJobsToday}</strong>
          <span className="metric-footnote">Across your tracked companies</span>
        </article>
        <Link 
          href="/opportunities" 
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <article 
            className="metric-panel" 
            style={{ 
              cursor: "pointer", 
              height: "100%", 
              display: "flex", 
              flexDirection: "column", 
              justifyContent: "space-between",
              transition: "all 0.2s ease",
              borderColor: oppsHovered ? "var(--accent)" : "var(--line)",
              transform: oppsHovered ? "translateY(-2px)" : "none",
              boxShadow: oppsHovered ? "0 4px 12px rgba(0,0,0,0.1)" : "none"
            }}
            onMouseEnter={() => setOppsHovered(true)}
            onMouseLeave={() => setOppsHovered(false)}
          >
            <span className="metric-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              Top Fit Match
              <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: "600" }}>View All →</span>
            </span>
            <strong>
              {topRecommendations.length > 0 && topRecommendations[0].match_score
                ? `${Math.round(topRecommendations[0].match_score)}%`
                : "TBD"}
            </strong>
            <span className="metric-footnote">Highest score matching your resume</span>
          </article>
        </Link>
      </section>
 
      {/* 4. Top Opportunities Panel */}
      <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="panel-header" style={{ marginBottom: 0 }}>
          <div>
            <div className="section-label">Opportunities</div>
            <h2>Top Opportunities</h2>
          </div>
          {topRecommendations.length > 0 && (
            <Link href="/opportunities" className="primary-link ghost-link" style={{ fontSize: "0.85rem", minHeight: "34px", padding: "6px 12px" }}>
              View All →
            </Link>
          )}
        </div>
 
        {topRecommendations.length === 0 ? (
          <div className="empty-state" style={{ textAlign: "center", padding: "32px 16px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>No matching opportunities yet.</h3>
            <p style={{ color: "var(--muted)", margin: "0 auto 20px", maxWidth: "420px", fontSize: "0.88rem", lineHeight: "1.4" }}>
              Add more target companies or complete your profile to improve job matching.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Link href="/watchlist" className="primary-link" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
                Manage Watchlist →
              </Link>
              <Link href="/profile" className="primary-link ghost-link" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
                Complete Profile →
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {topRecommendations.map((job) => (
              <div
                key={job.id || job.job_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  background: "var(--surface-muted)",
                }}
              >
                <div>
                  <span className="topbar-kicker" style={{ fontSize: "0.7rem" }}>{job.company_name}</span>
                  <h4 style={{ margin: "2px 0 0", fontSize: "0.95rem", fontWeight: 700 }}>{job.title}</h4>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
                    {job.location || "Not listed"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span className="status-good" style={{ minHeight: "24px", fontSize: "0.75rem", padding: "2px 8px" }}>
                    {Math.round(job.match_score)}% match
                  </span>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-link"
                    style={{ fontSize: "0.8rem", minHeight: "30px", padding: "4px 10px" }}
                  >
                    Open Role
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
 

 
      {/* 6. Recommended Actions */}
      <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <div className="section-label">Maintenance</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "4px 0 0" }}>Recommended Actions</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
          {/* Action 1: Complete Profile */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Complete Profile</h4>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.8rem", lineHeight: "1.3" }}>
                Ensure your academic registry and skills are fully synchronized.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
              <strong style={{ fontSize: "1.1rem", color: "var(--accent)" }}>{profileCompleteness}% complete</strong>
              <Link href="/profile" className="primary-link" style={{ fontSize: "0.8rem", padding: "6px 12px", minHeight: "30px" }}>
                Complete Profile →
              </Link>
            </div>
          </div>
 
          {/* Action 2: Manage Watchlist */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Manage Watchlist</h4>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.8rem", lineHeight: "1.3" }}>
                Add or pause targeted employers to match against active openings.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong style={{ fontSize: "1.05rem" }}>{initialTargetsCount} companies</strong>
                <span className="metric-footnote" style={{ fontSize: "0.68rem" }}>Last sync: {dashboardSummary.lastSync}</span>
              </div>
              <Link href="/watchlist" className="primary-link" style={{ fontSize: "0.8rem", padding: "6px 12px", minHeight: "30px" }}>
                Manage Watchlist →
              </Link>
            </div>
          </div>
 
          {/* Action 3: Explore Opportunities */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "space-between" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Explore Opportunities</h4>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.8rem", lineHeight: "1.3" }}>
                Browse open roles matched to your resume and eligibility criteria.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
              <strong style={{ fontSize: "1.1rem", color: "var(--accent)" }}>{dashboardSummary.newJobsToday} new jobs today</strong>
              <Link href="/opportunities" className="primary-link" style={{ fontSize: "0.8rem", padding: "6px 12px", minHeight: "30px" }}>
                Explore Opportunities →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
