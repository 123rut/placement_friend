"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Company } from "@piaa/domain";
import { createClient } from "../lib/supabase/client";
import CompanyLogo from "./CompanyLogo";



interface WatchlistClientProps {
  userId: string;
  seedCompanies?: Company[];
}

interface TrackedCompanyDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  category: string;
  status: string;
  ats: string;
  lastSyncStr: string;
  jobsDiscovered: number;
  newJobsToday: number;
  matchScore: number | null;
}

interface DashboardData {
  trackedCompaniesCount: number;
  newJobsTodayCount: number;
  resumeMatchesCount: number;
  lastSyncTimeStr: string;
  trackedCompanies: TrackedCompanyDetail[];
}

export default function WatchlistClient({ userId }: WatchlistClientProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [rawTargets, setRawTargets] = useState<any[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    try {
      // 1. Fetch student's tracked company targets
      const { data: targets, error: targetsErr } = await supabase
        .from("student_company_targets")
        .select("student_id, company_id, notify_via, notify_email, notify_dashboard, added_at, created_at")
        .eq("student_id", userId);

      if (targetsErr) throw targetsErr;

      if (!targets || targets.length === 0) {
        setRawTargets([]);
        setData({
          trackedCompaniesCount: 0,
          newJobsTodayCount: 0,
          resumeMatchesCount: 0,
          lastSyncTimeStr: "Never",
          trackedCompanies: [],
        });
        return;
      }

      const targetCompanyIds = targets.map((t) => t.company_id);

      // 2. Fetch companies from companies table directly
      const { data: companies, error: compErr } = await supabase
        .from("companies")
        .select("id, name, slug, category, careers_url, status, last_scraped_at, last_checked_at")
        .in("id", targetCompanyIds);

      if (compErr) throw compErr;

      const compMap: Record<string, any> = {};
      (companies || []).forEach((c) => {
        compMap[c.id] = c;
      });

      const enrichedTargets = targets.map((t) => ({
        ...t,
        companies: compMap[t.company_id] || { id: t.company_id, name: t.company_id, slug: t.company_id },
      }));
      setRawTargets(enrichedTargets);

      // 3. Fetch jobs for these companies
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, company_id, title, location, posted_at, created_at, url")
        .in("company_id", targetCompanyIds)
        .order("posted_at", { ascending: false });

      // 4. Fetch sync logs
      const { data: syncLogs } = await supabase
        .from("sync_logs")
        .select("company_id, status, error, created_at, jobs_found, jobs_new")
        .in("company_id", targetCompanyIds)
        .order("created_at", { ascending: false })
        .limit(50);

      // 5. Fetch candidate's match scores
      const matchMap: Record<string, number> = {};
      try {
        const { data: evaluations } = await supabase
          .from("job_matches")
          .select("job_id, match_score")
          .eq("user_id", userId);

        if (evaluations) {
          evaluations.forEach((ev) => {
            matchMap[ev.job_id] = ev.match_score;
          });
        }
      } catch {
        // Continue gracefully
      }

      // Compute 24-hour window
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let newJobsTodayCount = 0;
      const companyJobsMap: Record<string, any[]> = {};

      (jobs || []).forEach((j) => {
        if (!companyJobsMap[j.company_id]) {
          companyJobsMap[j.company_id] = [];
        }
        companyJobsMap[j.company_id].push(j);

        const seenDate = j.posted_at || j.created_at;
        if (seenDate && seenDate >= oneDayAgo) {
          newJobsTodayCount++;
        }
      });

      // Find latest sync timestamp
      let latestSync: Date | null = null;
      (syncLogs || []).forEach((log) => {
        if (log.created_at) {
          const d = new Date(log.created_at);
          if (!latestSync || d > latestSync) {
            latestSync = d;
          }
        }
      });

      const trackedCompanies: TrackedCompanyDetail[] = enrichedTargets.map((t) => {
        const c = t.companies as any;
        const cJobs = companyJobsMap[t.company_id] || [];

        let cNewJobsToday = 0;
        let highestMatch: number | null = null;

        cJobs.forEach((j) => {
          const seenDate = j.posted_at || j.created_at;
          if (seenDate && seenDate >= oneDayAgo) {
            cNewJobsToday++;
          }
          if (matchMap[j.id] && (highestMatch === null || matchMap[j.id] > highestMatch)) {
            highestMatch = matchMap[j.id];
          }
        });

        // Determine sync status & last sync string
        const cLog = (syncLogs || []).find((l) => l.company_id === t.company_id);
        let lastSyncStr = "Never";
        const syncDate = cLog?.created_at || c?.last_scraped_at || c?.last_checked_at;
        if (syncDate) {
          const diffMs = Date.now() - new Date(syncDate).getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 1) lastSyncStr = "Just now";
          else if (diffMins < 60) lastSyncStr = `${diffMins}m ago`;
          else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) lastSyncStr = `${diffHours}h ago`;
            else lastSyncStr = `${Math.floor(diffHours / 24)}d ago`;
          }
        }

        let computedStatus = c?.status || "active";
        if (!c?.careers_url) {
          computedStatus = "url_missing";
        } else if (cLog && cLog.status === "failed") {
          computedStatus = "url_stale";
        }

        return {
          id: t.company_id,
          name: c?.name || "Unknown Company",
          slug: c?.slug || "",
          industry: "Technology",
          category: c?.category || "preferred",
          status: computedStatus,
          ats: "career_site",
          lastSyncStr,
          jobsDiscovered: cJobs.length,
          newJobsToday: cNewJobsToday,
          matchScore: highestMatch,
        };
      });

      // Compute lastSyncTimeStr
      let lastSyncTimeStr = "Never";
      if (latestSync) {
        const diffMs = Date.now() - (latestSync as Date).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) lastSyncTimeStr = "Just now";
        else if (diffMins < 60) lastSyncTimeStr = `${diffMins}m ago`;
        else {
          const diffHours = Math.floor(diffMins / 60);
          if (diffHours < 24) lastSyncTimeStr = `${diffHours}h ago`;
          else lastSyncTimeStr = `${Math.floor(diffHours / 24)}d ago`;
        }
      }

      setData({
        trackedCompaniesCount: targets.length,
        newJobsTodayCount,
        resumeMatchesCount: Object.keys(matchMap).length,
        lastSyncTimeStr,
        trackedCompanies,
      });
    } catch (err: any) {
      console.error("WatchlistClient load error:", err);
      setError(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const syncAbortRef = React.useRef<AbortController | null>(null);

  const handleRefresh = async () => {
    setSyncError(null);
    setRefreshing(true);
    const controller = new AbortController();
    syncAbortRef.current = controller;
    try {
      const res = await fetch("/api/careerpilot/sync", { 
        method: "POST",
        signal: controller.signal,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError(result.error || "Sync encountered an issue.");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setSyncError("Network error triggering sync.");
      }
    } finally {
      syncAbortRef.current = null;
      setRefreshing(false);
      await loadDashboardData(true);
    }
  };

  const handleStopSync = async () => {
    if (syncAbortRef.current) {
      syncAbortRef.current.abort();
      syncAbortRef.current = null;
    }
    setRefreshing(false);
    try {
      await fetch("/api/careerpilot/sync/stop", { method: "POST" });
    } catch {}
    await loadDashboardData(true);
  };

  const handlePauseTracking = async (companyId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "paused" ? "active" : "paused";
    try {
      await supabase.from("companies").update({ status: nextStatus }).eq("id", companyId);
      await loadDashboardData(true);
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleRemoveCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to stop tracking ${companyName}?`)) return;
    try {
      await supabase
        .from("student_company_targets")
        .delete()
        .match({ student_id: userId, company_id: companyId });
      await loadDashboardData(true);
    } catch (err) {
      console.error("Failed to remove company:", err);
    }
  };

  const handleToggleGlobalMonitoring = async () => {
    if (!data || data.trackedCompanies.length === 0) return;
    const allPaused = data.trackedCompanies.every((c) => c.status === "paused");
    const nextStatus = allPaused ? "active" : "paused";

    try {
      const companyIds = data.trackedCompanies.map((c) => c.id);
      await supabase.from("companies").update({ status: nextStatus }).in("id", companyIds);
      await loadDashboardData(true);
    } catch (err) {
      console.error("Failed to toggle all monitoring:", err);
    }
  };

  if (loading && !data) {

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="skeleton" style={{ width: "120px", height: "14px", marginBottom: "8px" }} />
            <div className="skeleton" style={{ width: "240px", height: "28px" }} />
          </div>
          <div className="skeleton" style={{ width: "100px", height: "36px" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          <div className="skeleton" style={{ height: "100px", borderRadius: "var(--radius)" }} />
          <div className="skeleton" style={{ height: "100px", borderRadius: "var(--radius)" }} />
          <div className="skeleton" style={{ height: "100px", borderRadius: "var(--radius)" }} />
        </div>
        <div className="skeleton" style={{ height: "260px", borderRadius: "var(--radius)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <span className="topbar-kicker">Target Companies</span>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0" }}>Tracked Companies</h1>
        </div>

        <div className="panel" style={{ textAlign: "center", padding: "40px", border: "1px solid var(--accent-soft)", background: "var(--surface-muted)" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)" }}>We couldn&apos;t load your tracked companies.</h2>
          <p style={{ color: "var(--muted)", margin: "12px 0 24px", fontSize: "0.95rem" }}>
            {error || "There was an error communicating with the database. Please try again or browse your opportunities."}
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button className="primary-link" onClick={() => loadDashboardData()}>
              Retry
            </button>
            <Link href="/opportunities" className="primary-link ghost-link" style={{ display: "flex", alignItems: "center" }}>
              Go to Opportunities
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allMonitoringPaused = data ? data.trackedCompanies.length > 0 && data.trackedCompanies.every((c) => c.status === "paused") : false;

  // Empty Watchlist State
  if (!data || data.trackedCompanies.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="topbar-kicker">Target Companies</span>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0" }}>Tracked Companies</h1>
            <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.9rem" }}>
              Monitor hiring activity, registry health, and scraping status for tracked employers.
            </p>
          </div>
          <Link href="/profile" className="primary-link">
            + Add Company
          </Link>
        </div>

        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>🔍</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)" }}>No companies are being tracked yet.</h2>
          <p style={{ color: "var(--muted)", margin: "8px auto 24px", maxWidth: "380px", fontSize: "0.9rem" }}>
            Build your watchlist first. Select employers in your profile, and they will populate here with live sync analytics.
          </p>
          <Link href="/profile" className="primary-link" style={{ padding: "8px 24px" }}>
            Go to Profile / Add Companies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header & Quick Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <span className="topbar-kicker">Target Companies</span>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0", display: "flex", alignItems: "center", gap: "8px" }}>
            Tracked Companies
            {refreshing && (
              <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--accent)" }} className="skeleton-pulse">
                (Refreshing...)
              </span>
            )}
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.9rem" }}>
            Monitor hiring activity, registry health, and scraping status for tracked employers.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/profile" className="primary-link" style={{ display: "flex", alignItems: "center" }}>
            + Add Company
          </Link>
          <button 
            type="button" 
            onClick={refreshing ? handleStopSync : handleRefresh}
            className="primary-link ghost-link"
            style={refreshing ? { color: "#f87171", borderColor: "#f87171" } : {}}
          >
            {refreshing ? "⏹ Stop Sync" : "Refresh"}
          </button>
          <button 
            type="button" 
            onClick={handleToggleGlobalMonitoring} 
            disabled={refreshing} 
            className="primary-link ghost-link"
          >
            {allMonitoringPaused ? "Resume Monitoring" : "Pause Monitoring"}
          </button>
        </div>
      </div>


      {syncError && (
        <div style={{ padding: "10px 14px", background: "rgba(255,0,0,0.1)", border: "1px solid red", borderRadius: "var(--radius)", color: "red", fontSize: "0.85rem" }}>
          ⚠️ <strong>Sync Warning:</strong> {syncError}
        </div>
      )}

      {/* 2. Overview Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span className="section-label" style={{ fontSize: "0.75rem" }}>Tracked Companies</span>
          <strong style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "8px" }}>{data.trackedCompaniesCount}</strong>
        </div>
        <div className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span className="section-label" style={{ fontSize: "0.75rem" }}>New Jobs Today</span>
          <strong style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "8px" }}>{data.newJobsTodayCount}</strong>
        </div>
        <div className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span className="section-label" style={{ fontSize: "0.75rem" }}>Last Sync</span>
          <strong style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "8px", color: data.lastSyncTimeStr.includes("d ago") ? "var(--accent)" : "inherit" }}>
            {data.lastSyncTimeStr}
          </strong>
        </div>
      </div>

      {/* 3. Main Stacked Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Tracked Companies Cards */}
        <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="panel-header" style={{ marginBottom: "8px" }}>
            <div>
              <div className="section-label">Registry Tracking</div>
              <h2>Tracked Companies Monitor</h2>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {data.trackedCompanies.map((tc) => {
              const statusIndicators: Record<string, { label: string; dot: string }> = {
                active: { label: "Active", dot: "🟢" },
                waiting: { label: "Waiting", dot: "🟡" },
                paused: { label: "Paused", dot: "🔴" },
                url_missing: { label: "Not Synced", dot: "⚪" },
                url_stale: { label: "Not Synced", dot: "⚪" },
              };
              const indicator = statusIndicators[tc.status] || { label: tc.status, dot: "⚪" };

              return (
                <div 
                  key={tc.id} 
                  className="preference-card" 
                  style={{ 
                    padding: "16px", 
                    border: "1px solid var(--line)", 
                    borderRadius: "var(--radius)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                    background: tc.status === "paused" ? "rgba(0,0,0,0.05)" : "var(--surface)",
                  }}
                >
                  <div>
                    {/* Company Logo / Initials header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <CompanyLogo name={tc.name} size={38} />
                      <div>
                        <strong style={{ fontSize: "1rem", color: "var(--text-primary)" }}>{tc.name}</strong>
                        <div className="metric-footnote">{tc.industry}</div>
                      </div>
                    </div>

                    {/* Info lines */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", marginTop: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>Status</span>
                        <span>{indicator.dot} {indicator.label}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>Last Sync</span>
                        <span>{tc.lastSyncStr}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>Jobs Discovered</span>
                        <strong>{tc.jobsDiscovered}</strong>
                      </div>
                      {tc.newJobsToday > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--muted)" }}>New Jobs (24h)</span>
                          <span style={{ color: "var(--accent)", fontWeight: "bold" }}>+{tc.newJobsToday}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed var(--line)" }}>
                        <span style={{ color: "var(--muted)" }}>Top Fit Score</span>
                        <span style={{ fontWeight: "bold", color: tc.matchScore ? "var(--accent)" : "var(--muted)" }}>
                          {tc.matchScore ? `${tc.matchScore}% Match` : "None"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    <Link 
                      href={`/opportunities?company=${encodeURIComponent(tc.name)}`}
                      className="primary-link"
                      style={{ flex: 1, textAlign: "center", padding: "4px 0", fontSize: "0.8rem" }}
                    >
                      View Jobs
                    </Link>
                    <button 
                      type="button"
                      onClick={() => handlePauseTracking(tc.id, tc.status)}
                      className="primary-link ghost-link"
                      style={{ flex: 1, padding: "4px 0", fontSize: "0.8rem" }}
                    >
                      {tc.status === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleRemoveCompany(tc.id, tc.name)}
                      className="danger-action-btn"
                      style={{ flex: 1, padding: "4px 0", fontSize: "0.8rem", cursor: "pointer", fontWeight: 500 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
