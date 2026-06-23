"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import OpportunityCard, { OpportunityData } from "./OpportunityCard";
import NotificationBell from "./NotificationBell";
import PreferencesPanel, { CompanyTarget } from "./PreferencesPanel";
import { createClient } from "../lib/supabase/client";

const categoryLabels: Record<string, string> = {
  "it-product": "IT Product",
  "it-service": "IT Service",
  core: "Core",
  consulting: "Consulting",
  bfsi: "BFSI",
  startup: "Startup"
};

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
  collegeName
}: DashboardClientProps) {
  const [opportunities, setOpportunities] = useState<OpportunityData[]>([]);
  
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };
  const [targets, setTargets] = useState<CompanyTarget[]>(initialTargets);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [highlightedDriveId, setHighlightedDriveId] = useState<string | null>(null);

  // References for scrolling to highlighted card
  const driveRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  const fetchTargets = async () => {
    try {
      const query = new URLSearchParams({ page: "1", limit: "100" });
      const res = await fetch(`/api/companies?${query}`);
      if (res.ok) {
        // We can reload the page or fetch specific targets
        // For simplicity, we just reload window or fetch targets again.
        // Let's call /api/opportunities again to update list
        fetchOpportunities();
      }
    } catch (err) {
      console.error("Failed to fetch targets:", err);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleSelectDrive = (driveId: string) => {
    setHighlightedDriveId(driveId);
    
    // Smooth scroll to the matching opportunity card
    setTimeout(() => {
      const cardEl = driveRefs.current[driveId];
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        // Add a temporary glow effect
        cardEl.style.boxShadow = "0 0 15px var(--accent)";
        setTimeout(() => {
          cardEl.style.boxShadow = "var(--shadow)";
        }, 3000);
      }
    }, 100);
  };

  const handleRefreshTargets = () => {
    // Refresh opportunities feed when alerts preferences change
    fetchOpportunities();
  };

  return (
    <main className="app-shell">
      <header className="topbar" style={{ alignItems: "center" }}>
        <div>
          <div className="topbar-kicker">Student Workspace</div>
          <h1 style={{ margin: "4px 0 0" }}>{student.full_name.split(" ")[0]}'s Sprint 3 Workspace</h1>
        </div>
        <nav className="topbar-actions" style={{ alignItems: "center" }}>
          <span className="pill">{collegeName}</span>
          <NotificationBell onSelectDrive={handleSelectDrive} />
          <Link className="primary-link" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--line)" }} href="/companies">
            Manage Companies
          </Link>
          <Link className="primary-link" href="/profile">
            Edit Profile
          </Link>
          <button 
            className="action-btn-danger" 
            style={{ 
              padding: "6px 12px", 
              border: "1px solid var(--warn)", 
              background: "var(--warn-soft)", 
              color: "var(--warn)", 
              borderRadius: "var(--radius)", 
              fontWeight: 600,
              fontSize: "0.85rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "40px"
            }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </nav>
      </header>

      {/* Metrics Section */}
      <section className="workspace-section metrics-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <article className="metric-panel">
          <span className="metric-label">Mapped colleges</span>
          <strong>{collegesCount}</strong>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Seeded companies</span>
          <strong>{targets.length}</strong>
        </article>
        <article className="metric-panel">
          <span className="metric-label">Profile-ready companies</span>
          <strong>{eligibleCount}</strong>
        </article>
      </section>

      {/* Dashboard Content split into panels */}
      <section className="workspace-section dashboard-layout" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
        {/* Left Column: Opportunities Feed & Profile */}
        <div style={{ display: "grid", gap: "20px" }}>
          
          {/* Opportunities Feed Panel */}
          <article className="panel">
            <div className="panel-header" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <div className="section-label">Matched Drives</div>
                <h2 style={{ fontSize: "1.3rem", margin: "4px 0 0" }}>Your Placement & Internship Feed</h2>
              </div>
            </div>

            {loadingOpps ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                {[1, 2].map(i => (
                  <div key={i} className="panel" style={{ height: "200px", background: "var(--surface-muted)", animation: "pulse 1.5s infinite" }} />
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <span style={{ fontSize: "2rem" }}>🔍</span>
                <h3 style={{ margin: "12px 0 4px", fontSize: "1rem", color: "var(--text)" }}>No Matching Opportunities</h3>
                <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                  No matching opportunities found right now. Target more companies or check back after the next scrape cycle.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                {opportunities.map(opp => (
                  <div
                    key={opp.id}
                    ref={el => { driveRefs.current[opp.id] = el; }}
                    style={{ transition: "box-shadow 0.3s ease" }}
                  >
                    <OpportunityCard opportunity={opp} />
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Student Profile Panel */}
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
                <div className="summary-value" style={{ wordBreak: "break-all" }}>{student.college_email}</div>
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
        </div>

        {/* Right Column: Preferences, Category, & Alerts */}
        <div style={{ display: "grid", gap: "20px" }}>
          
          {/* Notification Channel Preferences */}
          <PreferencesPanel initialTargets={targets} onRefresh={handleRefreshTargets} />

          {/* Company Categories coverage */}
          <article className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">Coverage</div>
                <h2>Company categories</h2>
              </div>
            </div>
            <div className="category-list">
              {categoryCounts.map(item => (
                <div className="category-row" key={item.category} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>

        </div>
      </section>
    </main>
  );
}
