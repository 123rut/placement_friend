"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";

import Link from "next/link";
import { mutate } from "swr";
import type { Company, CompanyCategory } from "@piaa/domain";
import { categoryLabels } from "../lib/sprint-one";
import { createClient } from "../lib/supabase/client";
import PreferencesPanel, { CompanyTarget } from "./PreferencesPanel";

interface WatchlistClientProps {
  userId: string;
  seedCompanies: Company[];
}

interface PriorityOpportunity {
  id: string;
  companyName: string;
  role: string;
  location: string;
  matchScore: number;
  postedAt: string;
  applyUrl: string;
}

interface TrackedCompanyDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  category: string;
  status: string;
  ats: string;
  lastCrawlStr: string;
  jobsDiscovered: number;
  newJobsToday: number;
  matchScore: number | null;
}

interface ActivityEvent {
  companyName: string;
  message: string;
  timeAgo: string;
}

interface RankingItem {
  companyName: string;
  score: number;
}

interface RecentChange {
  type: "new-jobs" | "sync" | "added";
  label: string;
  companyName: string;
  timeAgo: string;
  timestamp: number;
}

interface DashboardData {
  trackedCompaniesCount: number;
  newJobsTodayCount: number;
  resumeMatchesCount: number;
  lastSyncTimeStr: string;
  recentChanges: RecentChange[];
  priorityOpportunities: PriorityOpportunity[];
  trackedCompanies: TrackedCompanyDetail[];
  activityFeed: ActivityEvent[];
  resumeRanking: RankingItem[];
}

function formatTimeAgo(dateStr: string | Date) {
  if (!dateStr) return "Never";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export default function WatchlistClient({ userId, seedCompanies }: WatchlistClientProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [rawTargets, setRawTargets] = useState<any[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const supabase = createClient();

  const loadDashboardData = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    try {
      // 1. Fetch user targets
      const { data: targets, error: targetsError } = await supabase
        .from("student_company_targets")
        .select("company_id, notify_email, notify_dashboard")
        .eq("student_id", userId);

      if (targetsError) throw targetsError;
      setRawTargets(targets || []);

      if (!targets || targets.length === 0) {
        setData({
          trackedCompaniesCount: 0,
          newJobsTodayCount: 0,
          resumeMatchesCount: 0,
          lastSyncTimeStr: "Never",
          recentChanges: [],
          priorityOpportunities: [],
          trackedCompanies: [],
          activityFeed: [],
          resumeRanking: []
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const trackedCompanyIds = targets.map(t => t.company_id);

      // 2. Fetch company configurations
      const { data: dbCompanies, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .in("id", trackedCompanyIds);

      if (companiesError) throw companiesError;

      // 3. Fetch matched jobs from api
      const jobsRes = await fetch("/api/careerpilot/jobs");
      const matchedJobs = jobsRes.ok ? await jobsRes.json() : [];

      // 4. Calculate new jobs today
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: newJobs, error: newJobsError } = await supabase
        .from("jobs")
        .select("id, company_id")
        .in("company_id", trackedCompanyIds)
        .gte("created_at", oneDayAgo);

      if (newJobsError) throw newJobsError;
      const newJobsCount = newJobs?.length || 0;

      // Count matches with score >= 70
      const highMatchesCount = Array.isArray(matchedJobs) 
        ? matchedJobs.filter((j: any) => j.match_score >= 70).length
        : 0;

      // Max last scraped
      let maxLastScraped: Date | null = null;
      if (dbCompanies && dbCompanies.length > 0) {
        dbCompanies.forEach(c => {
          if (c.last_scraped_at) {
            const d = new Date(c.last_scraped_at);
            if (!maxLastScraped || d > maxLastScraped) {
              maxLastScraped = d;
            }
          }
        });
      }
      const lastSyncTimeStr = maxLastScraped ? formatTimeAgo(maxLastScraped) : "Never";

      // 5. Recent Changes ribbon (last 24 hours)
      const { data: syncLogs, error: syncLogsError } = await supabase
        .from("sync_logs")
        .select("created_at, jobs_found, jobs_new, status, company_id")
        .in("company_id", trackedCompanyIds)
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false });

      if (syncLogsError) throw syncLogsError;

      const recentChanges: RecentChange[] = [];
      if (syncLogs) {
        syncLogs.forEach((log: any) => {
          const company = dbCompanies?.find(c => c.id === log.company_id);
          const companyName = company?.name || log.company_id;
          
          if (log.jobs_new > 0) {
            recentChanges.push({
              type: "new-jobs",
              label: `+${log.jobs_new} New Jobs`,
              companyName,
              timeAgo: formatTimeAgo(log.created_at),
              timestamp: new Date(log.created_at).getTime()
            });
          } else if (log.status === "success") {
            recentChanges.push({
              type: "sync",
              label: "Registry Updated",
              companyName,
              timeAgo: formatTimeAgo(log.created_at),
              timestamp: new Date(log.created_at).getTime()
            });
          }
        });
      }

      // Add recently added companies
      if (dbCompanies) {
        dbCompanies.forEach(c => {
          if (c.created_at && new Date(c.created_at) >= new Date(oneDayAgo)) {
            recentChanges.push({
              type: "added",
              label: "Company Tracked",
              companyName: c.name,
              timeAgo: formatTimeAgo(c.created_at),
              timestamp: new Date(c.created_at).getTime()
            });
          }
        });
      }
      recentChanges.sort((a, b) => b.timestamp - a.timestamp);

      // 6. Priority Opportunities (Top 5 matched jobs of tracked companies sorted by score, then date)
      const priorityOpportunities = Array.isArray(matchedJobs)
        ? matchedJobs
            .filter((j: any) => {
              const company = dbCompanies?.find(c => c.name.toLowerCase() === j.company_name.toLowerCase());
              return !!company;
            })
            .slice(0, 5)
            .map((j: any) => ({
              id: j.job_id || j.id,
              companyName: j.company_name,
              role: j.title,
              location: j.location || "Bengaluru",
              matchScore: j.match_score || 0,
              postedAt: j.created_at || j.posted_at || new Date().toISOString(),
              applyUrl: j.url || "#"
            }))
        : [];

      // 7. Tracked Companies list
      const trackedCompanies = (dbCompanies || []).map(c => {
        const companyJobs = Array.isArray(matchedJobs)
          ? matchedJobs.filter((j: any) => j.company_name.toLowerCase() === c.name.toLowerCase())
          : [];
        const maxScore = companyJobs.length > 0
          ? Math.max(...companyJobs.map((j: any) => j.match_score || 0))
          : null;

        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          industry: c.industry || "Technology",
          category: c.category || "core",
          status: c.status || "active",
          ats: c.ats || "career_site",
          lastCrawlStr: c.last_scraped_at ? formatTimeAgo(c.last_scraped_at) : "Never",
          jobsDiscovered: c.opportunities_found_last_run || 0,
          newJobsToday: newJobs?.filter(nj => nj.company_id === c.id).length || 0,
          matchScore: maxScore
        };
      });

      // 8. Activity Feed (from syncLogs)
      const activityFeed = (syncLogs || []).slice(0, 5).map((log: any) => {
        const company = dbCompanies?.find(c => c.id === log.company_id);
        const companyName = company?.name || log.company_id;
        let message = "Registry checked";
        if (log.status === "failed") {
          message = "Sync failed";
        } else if (log.jobs_new > 0) {
          message = `${log.jobs_new} new jobs detected`;
        } else if (log.jobs_found > 0) {
          message = `Registry checked (${log.jobs_found} jobs found)`;
        } else {
          message = `Registry synchronized`;
        }
        return {
          companyName,
          message,
          timeAgo: formatTimeAgo(log.created_at)
        };
      });

      // 9. Resume Match Ranking
      const resumeRanking = trackedCompanies
        .filter(c => c.matchScore !== null)
        .map(c => ({
          companyName: c.name,
          score: c.matchScore || 0
        }))
        .sort((a, b) => b.score - a.score);

      setData({
        trackedCompaniesCount: targets.length,
        newJobsTodayCount: newJobsCount,
        resumeMatchesCount: highMatchesCount,
        lastSyncTimeStr,
        recentChanges,
        priorityOpportunities,
        trackedCompanies,
        activityFeed,
        resumeRanking
      });
      setError(null);
    } catch (err: any) {
      console.error("Dashboard load error:", err);
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Auto refresh every 5 minutes
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId]);

  const syncAbortRef = useRef<AbortController | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncError(null);
    const controller = new AbortController();
    syncAbortRef.current = controller;
    try {
      const syncRes = await fetch("/api/careerpilot/sync", {
        method: "POST",
        signal: controller.signal,
      });
      const syncData = await syncRes.json().catch(() => ({}));
      if (!syncRes.ok) {
        setSyncError(syncData.error || "Failed to trigger active sync.");
      } else {
        setSyncError(null);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setSyncError("Network error: Could not reach the sync endpoint.");
      }
    } finally {
      syncAbortRef.current = null;
      setRefreshing(false);
    }
    await loadDashboardData(false);
  };

  const handleStopSync = async () => {
    // 1. Immediately abort the in-flight fetch so button toggles back
    syncAbortRef.current?.abort();
    syncAbortRef.current = null;
    setRefreshing(false);
    setSyncError("Stopping...");
    // 2. Signal backend to stop its loop
    try {
      const res = await fetch("/api/careerpilot/sync/stop", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setSyncError(data.message || "Sync stopped.");
    } catch {
      setSyncError("Stop signal sent (backend finishing last company).");
    }
  };


  const handlePreferencesRefresh = () => {
    loadDashboardData(true);
    mutate("/api/opportunities");
  };

  const handleRemoveCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to stop tracking ${companyName}? This stops monitoring and deletes your notification preferences.`)) {
      return;
    }

    setRefreshing(true);
    try {
      const { error } = await supabase
        .from("student_company_targets")
        .delete()
        .eq("student_id", userId)
        .eq("company_id", companyId);

      if (error) throw error;
      await loadDashboardData(true);
      mutate("/api/opportunities");
    } catch (err: any) {
      console.error("Failed to remove company:", err);
      alert(`Error removing company: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePauseTracking = async (companyId: string, currentStatus: string) => {
    setRefreshing(true);
    const nextStatus = currentStatus === "paused" ? "active" : "paused";
    const nextActive = currentStatus === "paused";
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: nextStatus, is_active: nextActive })
        .eq("id", companyId);

      if (error) throw error;
      await loadDashboardData(true);
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert(`Error toggling status: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleGlobalMonitoring = async () => {
    if (!data || data.trackedCompanies.length === 0) return;
    setRefreshing(true);
    const companyIds = data.trackedCompanies.map((c) => c.id);
    const allPaused = data.trackedCompanies.every((c) => c.status === "paused");
    const nextStatus = allPaused ? "active" : "paused";
    const nextActive = allPaused;

    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: nextStatus, is_active: nextActive })
        .in("id", companyIds);

      if (error) throw error;
      await loadDashboardData(true);
    } catch (err: any) {
      console.error("Failed to toggle global monitoring:", err);
      alert(`Error updating global monitoring: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const initialTargets: CompanyTarget[] = useMemo(() => {
    if (!data) return [];
    return data.trackedCompanies.map((tc) => {
      const targetRecord = rawTargets.find(t => t.company_id === tc.id);
      return {
        company_id: tc.id,
        name: tc.name,
        category: tc.category,
        notify_email: targetRecord ? !!targetRecord.notify_email : true,
        notify_dashboard: targetRecord ? !!targetRecord.notify_dashboard : true,
      };
    });
  }, [data, rawTargets]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header Skeleton */}
        <div>
          <div style={{ width: "120px", height: "14px", background: "var(--line)", borderRadius: "4px", marginBottom: "8px" }} className="skeleton-pulse" />
          <div style={{ width: "300px", height: "28px", background: "var(--line)", borderRadius: "6px", marginBottom: "8px" }} className="skeleton-pulse" />
          <div style={{ width: "500px", height: "16px", background: "var(--line)", borderRadius: "4px" }} className="skeleton-pulse" />
        </div>

        {/* Metrics Grid Skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel" style={{ height: "100px", background: "var(--surface-muted)" }}>
              <div style={{ width: "50%", height: "12px", background: "var(--line)", borderRadius: "3px", marginBottom: "14px" }} className="skeleton-pulse" />
              <div style={{ width: "30%", height: "24px", background: "var(--line)", borderRadius: "4px" }} className="skeleton-pulse" />
            </div>
          ))}
        </div>

        {/* Content stacked skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel" style={{ height: "180px", background: "var(--surface-muted)" }}>
            <div style={{ width: "30%", height: "16px", background: "var(--line)", borderRadius: "4px", marginBottom: "20px" }} className="skeleton-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: "30px", background: "var(--line)", borderRadius: "4px", marginBottom: "10px" }} className="skeleton-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error Recovery State
  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <span className="topbar-kicker">Target Companies</span>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0" }}>Tracked Companies</h1>
        </div>

        <div className="panel" style={{ textAlign: "center", padding: "40px", border: "1px solid var(--accent-soft)", background: "var(--surface-muted)" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)" }}>We couldn't load your tracked companies.</h2>
          <p style={{ color: "var(--muted)", margin: "12px 0 24px", fontSize: "0.95rem" }}>
            There was an error communicating with the database. Please try again or browse your opportunities.
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

  const allMonitoringPaused = data ? data.trackedCompanies.length > 0 && data.trackedCompanies.every(c => c.status === "paused") : false;

  // Empty Watchlist State
  if (!data || data.trackedCompanies.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="topbar-kicker">Target Companies</span>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0" }}>Tracked Companies</h1>
            <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.9rem" }}>
              Monitor hiring activity, AI matches, registry health and notification preferences for companies currently being tracked.
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
            Build your watchlist first! Select employers to crawl in your profile, and they will populate here with live analytics.
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
      {/* Header & Quick Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
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
            Monitor hiring activity, AI matches, registry health and notification preferences for companies currently being tracked.
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
          <a href="#notifications-section" className="primary-link ghost-link" style={{ display: "flex", alignItems: "center" }}>
            Notification Settings
          </a>
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



      {/* Main stacked sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* 4. Priority Opportunities */}
          <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="panel-header" style={{ marginBottom: 0 }}>
              <div>
                <div className="section-label">Priority Opportunities</div>
                <h2>Top 5 high-fit listings across your watchlist</h2>
              </div>
            </div>

            {data.priorityOpportunities.length === 0 ? (
              <p className="panel-note" style={{ padding: "12px 0" }}>No matching opportunities yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.priorityOpportunities.map((opp) => (
                  <div 
                    key={opp.id} 
                    style={{ 
                      padding: "12px 16px", 
                      border: "1px solid var(--line)", 
                      borderRadius: "var(--radius)",
                      background: "var(--surface-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "0.95rem" }}>{opp.role}</strong>
                        <span 
                          style={{ 
                            fontSize: "0.75rem", 
                            fontWeight: "bold", 
                            color: opp.matchScore >= 85 ? "green" : "var(--accent)", 
                            background: "var(--surface)", 
                            padding: "1px 6px",
                            borderRadius: "4px",
                            border: "1px solid var(--line)"
                          }}
                        >
                          {opp.matchScore}% Match
                        </span>
                      </div>
                      <div className="metric-footnote" style={{ marginTop: "4px" }}>
                        {opp.companyName} • {opp.location} • Posted {formatTimeAgo(opp.postedAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <a href={opp.applyUrl} target="_blank" rel="noopener noreferrer" className="primary-link" style={{ padding: "4px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center" }}>
                        Apply
                      </a>
                      <Link href={`/opportunities?company=${encodeURIComponent(opp.companyName)}`} className="primary-link ghost-link" style={{ padding: "4px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center" }}>
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 5. Tracked Companies Cards */}
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
                  url_stale: { label: "Not Synced", dot: "⚪" }
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
                      background: tc.status === "paused" ? "rgba(0,0,0,0.05)" : "var(--surface)"
                    }}
                  >
                    <div>
                      {/* Company Logo / Initials header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                        <div 
                          style={{ 
                            width: "36px", 
                            height: "36px", 
                            borderRadius: "50%", 
                            background: "var(--accent-soft)", 
                            color: "var(--accent)", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            fontWeight: "bold",
                            fontSize: "1.1rem"
                          }}
                        >
                          {tc.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: "1rem" }}>{tc.name}</strong>
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
                          <span style={{ color: "var(--muted)" }}>Hiring Platform</span>
                          <span style={{ fontWeight: "500" }}>{tc.ats === "career_site" ? "Career Site" : tc.ats.charAt(0).toUpperCase() + tc.ats.slice(1)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--muted)" }}>Last Sync</span>
                          <span>{tc.lastCrawlStr}</span>
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
                        className="primary-link ghost-link"
                        style={{ flex: 1, padding: "4px 0", fontSize: "0.8rem", color: "var(--accent)" }}
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

      {/* 7. Notification Preferences Accordions */}
      <PreferencesPanel
        initialTargets={initialTargets}
        onRefresh={handlePreferencesRefresh}
      />
    </div>
  );
}
