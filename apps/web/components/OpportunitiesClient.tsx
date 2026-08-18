"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import OpportunityCard, { OpportunityStatus } from "./OpportunityCard";
import MatchedJobCard, { MatchedJobData } from "./MatchedJobCard";

interface Student {
  id: string;
  full_name: string;
  college_email: string;
  branch: string;
  cgpa: string;
  batch_year: number;
}

interface OpportunitiesClientProps {
  student: Student;
}

interface WatchlistOpportunity {
  id: string;
  company_name: string;
  role: string;
  role_type: string;
  min_cgpa: number | null;
  allowed_branches: string[];
  deadline: string | null;
  apply_url: string;
  posted_at: string;
  status?: OpportunityStatus;
  viewed_at?: string | null;
  applied_at?: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const isSeniorRole = (title: string): boolean => {
  return /\b(senior|sr\.?|lead|staff|principal|manager|architect|director|head|vp|executive)\b/i.test(title);
};

export default function OpportunitiesClient({ student }: OpportunitiesClientProps) {
  // SWR fetches
  const { data: matchedJobsData, error: matchedError, mutate: mutateMatches } = useSWR(
    "/api/careerpilot/jobs",
    fetcher,
    { revalidateOnFocus: false }
  );
  
  const { data: oppsData, error: oppsError, mutate: mutateOpps } = useSWR(
    "/api/opportunities",
    fetcher,
    { revalidateOnFocus: false }
  );

  const matchedJobs: MatchedJobData[] = useMemo(
    () => (Array.isArray(matchedJobsData) ? matchedJobsData : []),
    [matchedJobsData],
  );
  const watchlistOpps: WatchlistOpportunity[] = useMemo(
    () => (oppsData?.data && Array.isArray(oppsData.data) ? oppsData.data : []),
    [oppsData],
  );
  
  const loading = !matchedJobsData && !oppsData && !matchedError && !oppsError;

  // Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "not_viewed" | "viewed" | "applied">("all");

  const isStudent = student.batch_year >= 2025 && student.batch_year <= 2028;
  const [hideSeniorRoles, setHideSeniorRoles] = useState<boolean>(isStudent);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const company = params.get("company") || params.get("search") || "";
      if (company) {
        setSearch(company);
      }
    }
  }, []);

  const onlyEligible = true;
  const [minMatchScore, setMinMatchScore] = useState<number | "all">("all");

  const studentCgpa = parseFloat(student.cgpa) || 0;

  // Eligible watchlist opportunities (respecting CGPA, Branch, and Student Seniority filters)
  const eligibleWatchlistOpps = useMemo(() => {
    return watchlistOpps.filter((opp) => {
      // 1. Eligibility filter (CGPA + Branch)
      if (onlyEligible) {
        const cgpaEligible = opp.min_cgpa === null || studentCgpa >= opp.min_cgpa;
        const branchEligible =
          opp.allowed_branches.length === 0 ||
          opp.allowed_branches.some(b => b.toLowerCase().includes(student.branch.toLowerCase()) || student.branch.toLowerCase().includes(b.toLowerCase()));

        if (!cgpaEligible || !branchEligible) {
          return false;
        }
      }

      // 2. Hide Senior Roles for Early Career / Students
      if (hideSeniorRoles && isSeniorRole(opp.role)) {
        return false;
      }

      return true;
    });
  }, [watchlistOpps, onlyEligible, studentCgpa, student.branch, hideSeniorRoles]);

  // Status counts across eligible watchlist opportunities
  const counts = useMemo(() => {
    let all = 0;
    let notViewed = 0;
    let viewed = 0;
    let applied = 0;

    for (const opp of eligibleWatchlistOpps) {
      all++;
      const st = opp.status || "NOT_VIEWED";
      if (st === "APPLIED") {
        applied++;
      } else if (st === "VIEWED") {
        viewed++;
      } else {
        notViewed++;
      }
    }

    return { all, notViewed, viewed, applied };
  }, [eligibleWatchlistOpps]);

  // Pagination states
  const [matchPage, setMatchPage] = useState(0);
  const [oppPage, setOppPage] = useState(0);
  const ITEMS_PER_PAGE = 6;

  // Handle Match Score filtering + Search + Status
  const filteredMatches = useMemo(() => {
    return matchedJobs.filter((job) => {
      // 1. Status Filter
      const currentStatus = job.status || "NOT_VIEWED";
      if (statusFilter === "not_viewed" && currentStatus !== "NOT_VIEWED") {
        return false;
      }
      if (statusFilter === "viewed" && currentStatus !== "VIEWED") {
        return false;
      }
      if (statusFilter === "applied" && currentStatus !== "APPLIED") {
        return false;
      }

      // 2. Search term match
      const query = search.toLowerCase();
      const matchesSearch =
        job.title.toLowerCase().includes(query) ||
        job.company_name.toLowerCase().includes(query) ||
        (job.explanation && job.explanation.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // 3. Score match
      if (minMatchScore !== "all") {
        if (job.match_score === null || job.match_score < minMatchScore) {
          return false;
        }
      }

      // 4. Hide senior roles if toggled
      if (hideSeniorRoles && isSeniorRole(job.title)) {
        return false;
      }

      return true;
    });
  }, [matchedJobs, search, minMatchScore, hideSeniorRoles, statusFilter]);

  // Handle watchlist opportunities search + status filter
  const filteredOpps = useMemo(() => {
    return eligibleWatchlistOpps.filter((opp) => {
      // 1. Status Filter
      const currentStatus = opp.status || "NOT_VIEWED";
      if (statusFilter === "not_viewed" && currentStatus !== "NOT_VIEWED") {
        return false;
      }
      if (statusFilter === "viewed" && currentStatus !== "VIEWED") {
        return false;
      }
      if (statusFilter === "applied" && currentStatus !== "APPLIED") {
        return false;
      }

      // 2. Search term match
      const query = search.toLowerCase();
      const matchesSearch =
        opp.role.toLowerCase().includes(query) ||
        opp.company_name.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      return true;
    });
  }, [eligibleWatchlistOpps, statusFilter, search]);

  // Reset page numbers when search query or filter changes
  React.useEffect(() => {
    setMatchPage(0);
  }, [search, minMatchScore, hideSeniorRoles, statusFilter]);

  React.useEffect(() => {
    setOppPage(0);
  }, [search, statusFilter, hideSeniorRoles]);

  // Paginate sliced lists
  const paginatedMatches = useMemo(() => {
    return filteredMatches.slice(matchPage * ITEMS_PER_PAGE, (matchPage + 1) * ITEMS_PER_PAGE);
  }, [filteredMatches, matchPage]);

  const paginatedOpps = useMemo(() => {
    return filteredOpps.slice(oppPage * ITEMS_PER_PAGE, (oppPage + 1) * ITEMS_PER_PAGE);
  }, [filteredOpps, oppPage]);

  const totalMatchPages = Math.ceil(filteredMatches.length / ITEMS_PER_PAGE);
  const totalOppPages = Math.ceil(filteredOpps.length / ITEMS_PER_PAGE);

  const handleOpportunityStatusChange = (jobId: string, newStatus: OpportunityStatus, appliedAt?: string) => {
    const nowIso = appliedAt || new Date().toISOString();

    // Mutate watchlist opps
    mutateOpps(
      (current: any) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.map((item: WatchlistOpportunity) => {
            if (item.id === jobId) {
              return {
                ...item,
                status: newStatus,
                viewed_at: item.viewed_at || nowIso,
                applied_at: newStatus === "APPLIED" ? nowIso : item.applied_at,
              };
            }
            return item;
          }),
        };
      },
      false
    );

    // Mutate matched jobs
    mutateMatches(
      (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.map((item: MatchedJobData) => {
          if (item.id === jobId || item.job_id === jobId) {
            return {
              ...item,
              status: newStatus,
              viewed_at: item.viewed_at || nowIso,
              applied_at: newStatus === "APPLIED" ? nowIso : item.applied_at,
            };
          }
          return item;
        });
      },
      false
    );
  };

  const handleDismiss = (jobId: string) => {
    // Optimistically remove from watchlist openings
    mutateOpps(
      (current: any) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.filter((item: WatchlistOpportunity) => item.id !== jobId),
        };
      },
      false
    );

    // Optimistically remove from matched jobs
    mutateMatches(
      (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.filter((item: MatchedJobData) => item.id !== jobId && item.job_id !== jobId);
      },
      false
    );
  };

  const handleRefresh = async () => {
    await Promise.all([mutateMatches(), mutateOpps()]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <span className="topbar-kicker">Workspace Feed</span>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0" }}>
            Career Opportunities
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.9rem" }}>
            Review resume-aware matching percentages, strengths, gaps, and surfaced openings.
          </p>
        </div>
        <button onClick={handleRefresh} className="primary-link ghost-link" style={{ fontSize: "0.85rem", minHeight: "36px" }}>
          <svg style={{ width: "16px", height: "16px", marginRight: "8px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
          </svg>
          Sync Feed
        </button>
      </div>

      {/* Filters Toolbar Panel */}
      <section className="panel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", alignItems: "center" }}>
        {/* Search */}
        <div className="field">
          <span>Search listings</span>
          <input
            type="text"
            placeholder="Search role, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Match Score Threshold */}
        <div className="field">
          <span>Min Match Score (AI)</span>
          <select value={minMatchScore} onChange={(e) => setMinMatchScore(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">All match levels</option>
            <option value="90">High fit (90%+)</option>
            <option value="75">Good fit (75%+)</option>
            <option value="50">Medium fit (50%+)</option>
          </select>
        </div>

        {/* Seniority Filter Toggle */}
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <span>Career Stage Mode</span>
          <button
            type="button"
            onClick={() => setHideSeniorRoles(prev => !prev)}
            className={`filter-chip ${hideSeniorRoles ? "active" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
              width: "fit-content",
              border: hideSeniorRoles ? "1px solid var(--accent, #10b981)" : "1px solid var(--border)",
              background: hideSeniorRoles ? "rgba(16, 185, 129, 0.12)" : "transparent",
              color: hideSeniorRoles ? "var(--accent, #10b981)" : "var(--muted)",
            }}
          >
            {hideSeniorRoles ? "🎓 Early Career Only (Senior Roles Hidden)" : "🌐 All Roles (Including Senior/Lead)"}
          </button>
        </div>
      </section>

      {/* Main Feeds Grid */}
      {loading ? (
        <div className="opportunity-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="loading-card" />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Section 1: AI Matched Roles Shortlist */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div>
                <span className="topbar-kicker">AI Rank Shortlist</span>
                <h2 style={{ margin: "4px 0 0", fontSize: "1.35rem", fontWeight: 700 }}>Resume-Matched Recommendations</h2>
              </div>
            </div>

            {filteredMatches.length === 0 ? (
              <div className="empty-state">
                <h3>No matched recommendations found</h3>
                <p>
                  No roles match the query filter. Check your search text or ask the persistent Copilot agent to analyze a specific job ID.
                </p>
              </div>
            ) : (
              <>
                <div className="opportunity-grid">
                  {paginatedMatches.map((job) => (
                    <MatchedJobCard
                      key={job.id || job.job_id}
                      job={job}
                      onStatusChange={handleOpportunityStatusChange}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>

                {/* Recommendations Pagination Controls */}
                {totalMatchPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                    <button 
                      disabled={matchPage === 0} 
                      onClick={() => setMatchPage(p => p - 1)}
                      className="primary-link ghost-link"
                      style={{ minHeight: "36px", padding: "6px 14px", fontSize: "0.85rem" }}
                    >
                      ← Previous
                    </button>
                    <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500 }}>
                      Page {matchPage + 1} of {totalMatchPages}
                    </span>
                    <button 
                      disabled={matchPage >= totalMatchPages - 1} 
                      onClick={() => setMatchPage(p => p + 1)}
                      className="primary-link ghost-link"
                      style={{ minHeight: "36px", padding: "6px 14px", fontSize: "0.85rem" }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Section 2: Surfaced watchlist openings */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div>
                <span className="topbar-kicker">Employer watch feed</span>
                <h2 style={{ margin: "4px 0 0", fontSize: "1.35rem", fontWeight: 700 }}>All Watchlist Openings</h2>
              </div>

              {/* Status Filter Chips */}
              <div className="filter-row" style={{ alignItems: "center" }}>
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  All ({counts.all})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === "not_viewed" ? "active" : ""}`}
                  onClick={() => setStatusFilter("not_viewed")}
                >
                  ○ Not Viewed ({counts.notViewed})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === "viewed" ? "active" : ""}`}
                  onClick={() => setStatusFilter("viewed")}
                >
                  👁 Viewed ({counts.viewed})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${statusFilter === "applied" ? "active" : ""}`}
                  onClick={() => setStatusFilter("applied")}
                >
                  ✓ Applied ({counts.applied})
                </button>
              </div>
            </div>

            {filteredOpps.length === 0 ? (
              <div className="empty-state">
                <h3>No openings found</h3>
                <p>
                  No synced jobs align with your criteria. Ensure you are tracking companies in Watchlist Settings.
                </p>
              </div>
            ) : (
              <>
                <div className="opportunity-grid">
                  {paginatedOpps.map((opp) => (
                    <OpportunityCard
                      key={opp.id}
                      opportunity={opp}
                      onStatusChange={handleOpportunityStatusChange}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>

                {/* Watchlist Openings Pagination Controls */}
                {totalOppPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                    <button 
                      disabled={oppPage === 0} 
                      onClick={() => setOppPage(p => p - 1)}
                      className="primary-link ghost-link"
                      style={{ minHeight: "36px", padding: "6px 14px", fontSize: "0.85rem" }}
                    >
                      ← Previous
                    </button>
                    <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500 }}>
                      Page {oppPage + 1} of {totalOppPages}
                    </span>
                    <button 
                      disabled={oppPage >= totalOppPages - 1} 
                      onClick={() => setOppPage(p => p + 1)}
                      className="primary-link ghost-link"
                      style={{ minHeight: "36px", padding: "6px 14px", fontSize: "0.85rem" }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
