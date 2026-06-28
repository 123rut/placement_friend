"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import OpportunityCard, { OpportunityData } from "./OpportunityCard";
import NotificationBell from "./NotificationBell";
import PreferencesPanel, { CompanyTarget } from "./PreferencesPanel";
import CareerPilotPanel from "./CareerPilotPanel";
import { createClient } from "../lib/supabase/client";

interface Student {
  id: string;
  full_name: string;
  college_email: string;
  branch: string;
  cgpa: string;
  batch_year: number;
  colleges?: { name: string };
}

interface DashboardClientProps {
  student: Student;
  collegesCount: number;
  initialTargets: CompanyTarget[];
  eligibleCount: number;
  categoryCounts: { category: string; label: string; count: number }[];
  collegeName: string;
}

export default function DashboardClient({
  student,
  collegesCount,
  initialTargets,
  eligibleCount,
  categoryCounts,
  collegeName,
}: DashboardClientProps) {
  const [opportunities, setOpportunities] = useState<OpportunityData[]>([]);
  const [targets] = useState<CompanyTarget[]>(initialTargets);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [highlightedDriveId, setHighlightedDriveId] = useState<string | null>(null);
  const driveRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const firstName = student.full_name.split(" ")[0];
  const careerReadiness = useMemo(() => {
    const cgpa = Number.parseFloat(student.cgpa);
    if (Number.isNaN(cgpa)) {
      return "Profile seeded";
    }
    if (cgpa >= 8.5) {
      return "High-fit shortlist";
    }
    if (cgpa >= 7.5) {
      return "Growth mode";
    }
    return "Foundation mode";
  }, [student.cgpa]);

  const focusNote = useMemo(() => {
    const branch = student.branch.toLowerCase();
    if (branch.includes("computer")) {
      return "Push backend and systems roles first. Your profile is already aligned with the strongest software tracks.";
    }
    if (branch.includes("electronics")) {
      return "Blend software roles with platform and systems openings to widen the match surface.";
    }
    return "Use the watchlist to bias toward flexible employers, then tighten the shortlist with profile edits.";
  }, [student.branch]);

  const matchDensity = useMemo(() => {
    if (targets.length === 0) {
      return "No watchlist yet";
    }
    const ratio = eligibleCount / targets.length;
    if (ratio >= 2) {
      return "Very broad";
    }
    if (ratio >= 1) {
      return "Balanced";
    }
    return "Selective";
  }, [eligibleCount, targets.length]);

  const topCategories = useMemo(
    () => categoryCounts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 3),
    [categoryCounts],
  );

  const quickStats = useMemo(
    () => [
      { label: "Eligible companies", value: String(eligibleCount) },
      { label: "Tracked companies", value: String(targets.length) },
      { label: "Search surface", value: matchDensity },
    ],
    [eligibleCount, matchDensity, targets.length],
  );

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const fetchOpportunities = async () => {
    setLoadingOpps(true);
    try {
      const res = await fetch("/api/opportunities");
      if (res.ok) {
        const result = await res.json();
        setOpportunities(result.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch opportunities:", err);
    } finally {
      setLoadingOpps(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleSelectDrive = (driveId: string) => {
    setHighlightedDriveId(driveId);
    setTimeout(() => {
      const cardEl = driveRefs.current[driveId];
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  return (
    <main className="app-shell careerpilot-shell">
      <header className="topbar">
        <div>
          <div className="topbar-kicker">CareerPilot AI</div>
          <h1>{firstName}&apos;s career command center</h1>
          <p className="hero-subtle">
            Resume-aware job discovery, watchlist signals, and next-step guidance in one workspace.
          </p>
        </div>
        <nav className="topbar-actions">
          <span className="pill">{collegeName}</span>
          <span className="pill">{careerReadiness}</span>
          <NotificationBell onSelectDrive={handleSelectDrive} />
          <Link className="primary-link ghost-link" href="/companies">
            ATS Registry
          </Link>
          <Link className="primary-link" href="/profile">
            Tune Profile
          </Link>
          <button className="action-btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <section className="workspace-section">
        <div className="hero-board">
          <article className="hero-card">
            <div className="section-label">Agent view</div>
            <h2>A cleaner job search workspace built around your profile.</h2>
            <p className="hero-copy">{focusNote}</p>
            <div className="hero-stat-row">
              {quickStats.map((item) => (
                <div key={item.label} className="hero-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="spotlight-card">
            <div className="section-label">Profile snapshot</div>
            <h3>{student.branch} profile, Batch {student.batch_year}</h3>
            <div className="spotlight-metrics">
              <div>
                <span className="summary-label">College</span>
                <div className="summary-value">{collegeName}</div>
              </div>
              <div>
                <span className="summary-label">CGPA</span>
                <div className="summary-value">{Number.parseFloat(student.cgpa).toFixed(2)}</div>
              </div>
              <div>
                <span className="summary-label">Readiness</span>
                <div className="summary-value">{careerReadiness}</div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="workspace-section metrics-grid career-metrics">
        <article className="metric-panel">
          <span className="metric-label">Eligible companies</span>
          <strong>{eligibleCount}</strong>
          <span className="metric-footnote">Current fit across the seeded watchlist</span>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Tracked companies</span>
          <strong>{targets.length}</strong>
          <span className="metric-footnote">Active watchlist size</span>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Mapped colleges</span>
          <strong>{collegesCount}</strong>
          <span className="metric-footnote">Verification coverage</span>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Watchlist density</span>
          <strong>{matchDensity}</strong>
          <span className="metric-footnote">How broad your current search surface is</span>
        </article>
      </section>

      <section className="workspace-section dashboard-layout career-dashboard">
        <div className="dashboard-main-stack">
          <CareerPilotPanel onSyncComplete={fetchOpportunities} />

          <article className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">Recommended roles</div>
                <h2>Jobs surfacing from your current watchlist</h2>
              </div>
              {highlightedDriveId ? <span className="status-good">Notification opened</span> : null}
            </div>

            {loadingOpps ? (
              <div className="opportunity-grid">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="loading-card" />
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="empty-state">
                <h3>No job cards yet</h3>
                <p>
                  The UI is ready, but this feed needs synced job data. Once the worker pushes openings, this area becomes your ranked shortlist.
                </p>
              </div>
            ) : (
              <div className="opportunity-grid">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    ref={(el) => {
                      driveRefs.current[opp.id] = el;
                    }}
                    className={highlightedDriveId === opp.id ? "highlight-shell" : undefined}
                  >
                    <OpportunityCard opportunity={opp} />
                  </div>
                ))}
              </div>
            )}
          </article>

        </div>

        <div className="dashboard-side-stack">
          <PreferencesPanel initialTargets={targets} onRefresh={fetchOpportunities} />

          <article className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">Market shape</div>
                <h2>Where your current coverage sits</h2>
              </div>
            </div>
            <div className="compact-list">
              {topCategories.map((item) => (
                <div className="compact-row" key={item.category}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>Openings seeded across this employer cluster</p>
                  </div>
                  <span className="pill">{item.count}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">Profile details</div>
                <h2>Current student record</h2>
              </div>
            </div>
            <div className="compact-list">
              <div className="compact-row">
                <div>
                  <strong>Email</strong>
                  <p style={{ wordBreak: "break-all" }}>{student.college_email}</p>
                </div>
              </div>
              <div className="compact-row">
                <div>
                  <strong>Branch</strong>
                  <p>{student.branch}</p>
                </div>
              </div>
              <div className="compact-row">
                <div>
                  <strong>Batch</strong>
                  <p>{student.batch_year}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
