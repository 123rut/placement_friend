"use client";

import React, { useMemo, useState, useEffect } from "react";
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

interface SearchJobItem {
  id: string;
  title: string;
  location: string | null;
  remote: boolean;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  url: string;
  posted_at: string | null;
  company_name: string;
  industry: string | null;
  similarity_score?: number | null;
}

interface ScoredJobDetail {
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number | null;
  eligible: boolean;
  explanation: string;
  strengths: string[];
  missingSkills: string[];
  applyUrl: string;
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

  // Active View Tab: 'matched' | 'search' | 'watchlist'
  const [activeTab, setActiveTab] = useState<"matched" | "search" | "watchlist">("matched");

  // Filter States for Watchlist & Matched
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "not_viewed" | "viewed" | "applied">("all");
  const isStudent = student.batch_year >= 2025 && student.batch_year <= 2028;
  const [hideSeniorRoles, setHideSeniorRoles] = useState<boolean>(isStudent);
  const [minMatchScore, setMinMatchScore] = useState<number | "all">("all");
  const studentCgpa = parseFloat(student.cgpa) || 0;

  // -------------------------------------------------------------
  // DATABASE JOB SEARCH STATE (Handles 30+ jobs with batch score)
  // -------------------------------------------------------------
  const [dbSearchQuery, setDbSearchQuery] = useState("");
  const [dbSearchLocation, setDbSearchLocation] = useState("");
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [dbSearchResults, setDbSearchResults] = useState<SearchJobItem[]>([]);
  const [dbSearchError, setDbSearchError] = useState("");
  const [dbScoredMap, setDbScoredMap] = useState<Record<string, ScoredJobDetail>>({});
  const [scoringJobId, setScoringJobId] = useState<string | null>(null);
  const [isBatchScoring, setIsBatchScoring] = useState(false);
  const [batchScoreProgress, setBatchScoreProgress] = useState<{ current: number; total: number } | null>(null);

  // Search Results Filters & Sorting
  const [searchFitFilter, setSearchFitFilter] = useState<"all" | "high_fit" | "scored" | "unscored">("all");
  const [searchSortBy, setSearchSortBy] = useState<"highest_fit" | "newest" | "company">("highest_fit");
  const [searchPage, setSearchPage] = useState(0);

  // Read search param on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const company = params.get("company") || params.get("search") || "";
      if (company) {
        setSearch(company);
        setDbSearchQuery(company);
      }
    }
  }, []);

  // Sync existing matched jobs into dbScoredMap
  useEffect(() => {
    if (matchedJobs.length > 0) {
      setDbScoredMap((prev) => {
        const next = { ...prev };
        for (const m of matchedJobs) {
          const jId = m.job_id || m.id;
          if (jId && !next[jId]) {
            next[jId] = {
              jobId: jId,
              jobTitle: m.title,
              company: m.company_name,
              matchScore: m.match_score,
              eligible: true,
              explanation: m.explanation || "",
              strengths: Array.isArray(m.strengths) ? m.strengths : [],
              missingSkills: Array.isArray(m.missing_skills) ? m.missing_skills : [],
              applyUrl: m.url || "",
            };
          }
        }
        return next;
      });
    }
  }, [matchedJobs]);

  // Execute Database Job Search (Retrieves up to 30 jobs)
  const handleExecuteDbSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dbSearchQuery.trim() && !dbSearchLocation.trim()) return;

    setIsSearchingDb(true);
    setDbSearchError("");
    setActiveTab("search");
    setSearchPage(0);

    try {
      const res = await fetch("/api/careerpilot/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: dbSearchQuery.trim() || undefined,
          location: dbSearchLocation.trim() || undefined,
          limit: 30,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDbSearchError(data.error || "Search failed.");
      } else {
        setDbSearchResults(Array.isArray(data.results) ? data.results : []);
      }
    } catch {
      setDbSearchError("Failed to connect to search database.");
    } finally {
      setIsSearchingDb(false);
    }
  };

  // Score individual job
  const handleScoreJob = async (jobId: string) => {
    setScoringJobId(jobId);
    try {
      const res = await fetch("/api/careerpilot/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setDbScoredMap((prev) => ({
          ...prev,
          [jobId]: {
            jobId: data.jobId,
            jobTitle: data.jobTitle,
            company: data.company,
            matchScore: data.matchScore,
            eligible: data.eligible,
            explanation: data.explanation || "",
            strengths: Array.isArray(data.strengths) ? data.strengths : [],
            missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
            applyUrl: data.applyUrl || "",
          },
        }));
        mutateMatches();
      }
    } catch (err) {
      console.error("Score job failed:", err);
    } finally {
      setScoringJobId(null);
    }
  };

  // Batch score all unscored jobs in search results
  const handleBatchScoreAll = async () => {
    const unscoredJobs = dbSearchResults.filter((j) => !dbScoredMap[j.id]);
    if (unscoredJobs.length === 0) return;

    setIsBatchScoring(true);
    setBatchScoreProgress({ current: 0, total: unscoredJobs.length });

    for (let i = 0; i < unscoredJobs.length; i++) {
      const job = unscoredJobs[i];
      setBatchScoreProgress({ current: i + 1, total: unscoredJobs.length });
      try {
        const res = await fetch("/api/careerpilot/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const data = await res.json();
        if (res.ok && !data.error) {
          setDbScoredMap((prev) => ({
            ...prev,
            [job.id]: {
              jobId: data.jobId,
              jobTitle: data.jobTitle,
              company: data.company,
              matchScore: data.matchScore,
              eligible: data.eligible,
              explanation: data.explanation || "",
              strengths: Array.isArray(data.strengths) ? data.strengths : [],
              missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
              applyUrl: data.applyUrl || "",
            },
          }));
        }
      } catch (err) {
        console.error("Batch score failed for", job.id, err);
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    setIsBatchScoring(false);
    setBatchScoreProgress(null);
    mutateMatches();
  };

  // Filtered & Sorted Search Results
  const filteredSearchResults = useMemo(() => {
    let list = dbSearchResults.filter((job) => {
      if (hideSeniorRoles && isSeniorRole(job.title)) {
        return false;
      }
      const scoreDetail = dbScoredMap[job.id];
      if (searchFitFilter === "scored" && !scoreDetail) return false;
      if (searchFitFilter === "unscored" && scoreDetail) return false;
      if (searchFitFilter === "high_fit") {
        if (!scoreDetail || scoreDetail.matchScore === null || scoreDetail.matchScore < 80) {
          return false;
        }
      }
      return true;
    });

    if (searchSortBy === "highest_fit") {
      list = [...list].sort((a, b) => {
        const scoreA = dbScoredMap[a.id]?.matchScore ?? -1;
        const scoreB = dbScoredMap[b.id]?.matchScore ?? -1;
        return scoreB - scoreA;
      });
    } else if (searchSortBy === "company") {
      list = [...list].sort((a, b) => a.company_name.localeCompare(b.company_name));
    } else if (searchSortBy === "newest") {
      list = [...list].sort((a, b) => {
        const tA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        const tB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
        return tB - tA;
      });
    }

    return list;
  }, [dbSearchResults, dbScoredMap, hideSeniorRoles, searchFitFilter, searchSortBy]);

  // Pagination for Search
  const SEARCH_ITEMS_PER_PAGE = 9;
  const paginatedSearchResults = useMemo(() => {
    return filteredSearchResults.slice(
      searchPage * SEARCH_ITEMS_PER_PAGE,
      (searchPage + 1) * SEARCH_ITEMS_PER_PAGE
    );
  }, [filteredSearchResults, searchPage]);
  const totalSearchPages = Math.ceil(filteredSearchResults.length / SEARCH_ITEMS_PER_PAGE);

  // -------------------------------------------------------------
  // WATCHLIST & MATCHED FILTERING
  // -------------------------------------------------------------
  const eligibleWatchlistOpps = useMemo(() => {
    return watchlistOpps.filter((opp) => {
      if (studentCgpa && opp.min_cgpa !== null && studentCgpa < opp.min_cgpa) {
        return false;
      }
      if (
        opp.allowed_branches.length > 0 &&
        !opp.allowed_branches.some(
          (b) =>
            b.toLowerCase().includes(student.branch.toLowerCase()) ||
            student.branch.toLowerCase().includes(b.toLowerCase())
        )
      ) {
        return false;
      }
      if (hideSeniorRoles && isSeniorRole(opp.role)) {
        return false;
      }
      return true;
    });
  }, [watchlistOpps, studentCgpa, student.branch, hideSeniorRoles]);

  const counts = useMemo(() => {
    let all = 0, notViewed = 0, viewed = 0, applied = 0;
    for (const opp of eligibleWatchlistOpps) {
      all++;
      const st = opp.status || "NOT_VIEWED";
      if (st === "APPLIED") applied++;
      else if (st === "VIEWED") viewed++;
      else notViewed++;
    }
    return { all, notViewed, viewed, applied };
  }, [eligibleWatchlistOpps]);

  const [matchPage, setMatchPage] = useState(0);
  const [oppPage, setOppPage] = useState(0);
  const ITEMS_PER_PAGE = 6;

  const filteredMatches = useMemo(() => {
    return matchedJobs.filter((job) => {
      const currentStatus = job.status || "NOT_VIEWED";
      if (statusFilter === "not_viewed" && currentStatus !== "NOT_VIEWED") return false;
      if (statusFilter === "viewed" && currentStatus !== "VIEWED") return false;
      if (statusFilter === "applied" && currentStatus !== "APPLIED") return false;

      const q = search.toLowerCase();
      const matchesSearch =
        job.title.toLowerCase().includes(q) ||
        job.company_name.toLowerCase().includes(q) ||
        (job.explanation && job.explanation.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (minMatchScore !== "all" && (job.match_score === null || job.match_score < minMatchScore)) {
        return false;
      }
      if (hideSeniorRoles && isSeniorRole(job.title)) return false;

      return true;
    });
  }, [matchedJobs, search, minMatchScore, hideSeniorRoles, statusFilter]);

  const filteredOpps = useMemo(() => {
    return eligibleWatchlistOpps.filter((opp) => {
      const currentStatus = opp.status || "NOT_VIEWED";
      if (statusFilter === "not_viewed" && currentStatus !== "NOT_VIEWED") return false;
      if (statusFilter === "viewed" && currentStatus !== "VIEWED") return false;
      if (statusFilter === "applied" && currentStatus !== "APPLIED") return false;

      const q = search.toLowerCase();
      return opp.role.toLowerCase().includes(q) || opp.company_name.toLowerCase().includes(q);
    });
  }, [eligibleWatchlistOpps, statusFilter, search]);

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
    mutateOpps(
      (current: any) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.map((item: WatchlistOpportunity) =>
            item.id === jobId
              ? {
                  ...item,
                  status: newStatus,
                  viewed_at: item.viewed_at || nowIso,
                  applied_at: newStatus === "APPLIED" ? nowIso : item.applied_at,
                }
              : item
          ),
        };
      },
      false
    );

    mutateMatches(
      (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.map((item: MatchedJobData) =>
          item.id === jobId || item.job_id === jobId
            ? {
                ...item,
                status: newStatus,
                viewed_at: item.viewed_at || nowIso,
                applied_at: newStatus === "APPLIED" ? nowIso : item.applied_at,
              }
            : item
        );
      },
      false
    );
  };

  const handleDismiss = (jobId: string) => {
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

    mutateMatches(
      (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.filter((item: MatchedJobData) => item.id !== jobId && item.job_id !== jobId);
      },
      false
    );

    setDbSearchResults((prev) => prev.filter((j) => j.id !== jobId));
  };

  const handleRefresh = async () => {
    await Promise.all([mutateMatches(), mutateOpps()]);
  };

  const unscoredSearchCount = dbSearchResults.filter((j) => !dbScoredMap[j.id]).length;
  const highFitSearchCount = dbSearchResults.filter((j) => (dbScoredMap[j.id]?.matchScore ?? 0) >= 80).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header & Quick Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0 }}>
            Opportunities & Job Discovery
          </h1>
        </div>
        <button onClick={handleRefresh} className="primary-link ghost-link" style={{ fontSize: "0.85rem", minHeight: "36px" }}>
          <svg style={{ width: "16px", height: "16px", marginRight: "8px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
          </svg>
          Sync Feed
        </button>
      </div>

      {/* 2. Global Search Command Bar (Full-Width) */}
      <div className="unified-search-wrapper">
        <form onSubmit={handleExecuteDbSearch} className="unified-search-box">
          <div className="unified-search-field">
            <div className="unified-search-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search any role, tech stack, or keywords (e.g. Software Engineer, React, Java)..."
              value={dbSearchQuery}
              onChange={(e) => setDbSearchQuery(e.target.value)}
              className="unified-search-input"
            />
          </div>

          <div className="unified-search-divider" />

          <div className="unified-search-field-location">
            <div className="unified-search-icon" style={{ color: "#64748b" }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Location (e.g. Pune)"
              value={dbSearchLocation}
              onChange={(e) => setDbSearchLocation(e.target.value)}
              className="unified-search-input"
            />
          </div>

          <button
            type="submit"
            disabled={isSearchingDb || (!dbSearchQuery.trim() && !dbSearchLocation.trim())}
            className="unified-search-btn"
          >
            {isSearchingDb ? (
              <span>Searching...</span>
            ) : (
              <span>⚡ Search Database</span>
            )}
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="quick-search-chips">
          <span className="quick-search-label">Quick Search:</span>
          {[
            { label: "⚡ SDE / Backend", query: "Software Engineer", location: "" },
            { label: "🌐 Frontend / React", query: "Frontend React", location: "" },
            { label: "☕ Java / Spring", query: "Java Spring", location: "" },
            { label: "🐍 Python / AI", query: "Python Machine Learning", location: "" },
            { label: "📍 All Bangalore Jobs", query: "", location: "Bangalore" },
            { label: "📍 All Pune Jobs", query: "", location: "Pune" },
            { label: "🌐 All Remote Roles", query: "", location: "Remote" },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                setDbSearchQuery(chip.query);
                setDbSearchLocation(chip.location || "");
                setIsSearchingDb(true);
                setDbSearchError("");
                setActiveTab("search");
                setSearchPage(0);
                fetch("/api/careerpilot/jobs", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    query: chip.query || undefined,
                    location: chip.location || undefined,
                    limit: 30,
                  }),
                })
                  .then((r) => r.json())
                  .then((data) => {
                    setDbSearchResults(Array.isArray(data.results) ? data.results : []);
                  })
                  .catch(() => setDbSearchError("Search failed."))
                  .finally(() => setIsSearchingDb(false));
              }}
              className="quick-chip-btn"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Discovery View Switcher Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("matched")}
            className={`filter-chip ${activeTab === "matched" ? "active" : ""}`}
            style={{ fontSize: "0.9rem", padding: "8px 16px", borderRadius: "8px", fontWeight: 600 }}
          >
            ✨ AI-Matched Roles ({matchedJobs.length})
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`filter-chip ${activeTab === "search" ? "active" : ""}`}
            style={{ fontSize: "0.9rem", padding: "8px 16px", borderRadius: "8px", fontWeight: 600 }}
          >
            🔍 Database Search {dbSearchResults.length > 0 ? `(${dbSearchResults.length})` : ""}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("watchlist")}
            className={`filter-chip ${activeTab === "watchlist" ? "active" : ""}`}
            style={{ fontSize: "0.9rem", padding: "8px 16px", borderRadius: "8px", fontWeight: 600 }}
          >
            🏢 Watchlist Postings ({counts.all})
          </button>
        </div>

        {/* Career Stage Mode Filter */}
        <button
          type="button"
          onClick={() => setHideSeniorRoles((prev) => !prev)}
          className={`filter-chip ${hideSeniorRoles ? "active" : ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.82rem",
            padding: "6px 12px",
            borderRadius: "6px",
            border: hideSeniorRoles ? "1px solid var(--accent)" : "1px solid var(--line)",
            background: hideSeniorRoles ? "var(--accent-soft)" : "transparent",
            color: hideSeniorRoles ? "var(--accent)" : "var(--muted)",
          }}
        >
          {hideSeniorRoles ? "🎓 Early Career Only (Senior Hidden)" : "🌐 All Roles (Including Senior)"}
        </button>
      </div>

      {/* 4. TAB CONTENT 1: DATABASE SEARCH (Handles 30+ Jobs & Batch Scoring) */}
      {activeTab === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {dbSearchError && <p className="alert-inline">{dbSearchError}</p>}

          {dbSearchResults.length === 0 && !isSearchingDb ? (
            <div className="empty-state" style={{ padding: "48px 24px" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
              <h3 style={{ fontSize: "1.2rem", margin: "0 0 6px" }}>Search the Job Database</h3>
              <p style={{ maxWidth: "480px", margin: "0 auto", color: "var(--muted)", fontSize: "0.9rem" }}>
                Use the search bar above to look up any keywords, technologies, or locations across all synced ATS boards. Up to 30 matching jobs will be returned.
              </p>
            </div>
          ) : (
            <>
              {/* Search Toolbar: Fit Filter + Sort + Batch Score Action */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "var(--surface-muted)", padding: "12px 16px", borderRadius: "var(--radius)" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginRight: "4px" }}>Filter:</span>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("all")}
                    className={`filter-chip ${searchFitFilter === "all" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    All ({dbSearchResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("high_fit")}
                    className={`filter-chip ${searchFitFilter === "high_fit" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    🔥 High Fit &gt;80% ({highFitSearchCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("scored")}
                    className={`filter-chip ${searchFitFilter === "scored" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    ⚡ Scored ({dbSearchResults.length - unscoredSearchCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("unscored")}
                    className={`filter-chip ${searchFitFilter === "unscored" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    ○ Unscored ({unscoredSearchCount})
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <select
                    value={searchSortBy}
                    onChange={(e: any) => setSearchSortBy(e.target.value)}
                    style={{ fontSize: "0.82rem", height: "32px", padding: "0 8px" }}
                  >
                    <option value="highest_fit">Sort: Highest Fit %</option>
                    <option value="newest">Sort: Most Recent</option>
                    <option value="company">Sort: Company (A-Z)</option>
                  </select>

                  {unscoredSearchCount > 0 && (
                    <button
                      type="button"
                      onClick={handleBatchScoreAll}
                      disabled={isBatchScoring}
                      className="primary-link"
                      style={{ fontSize: "0.8rem", height: "32px", padding: "0 12px", background: "var(--accent)" }}
                    >
                      {isBatchScoring
                        ? `Scoring ${batchScoreProgress?.current} of ${batchScoreProgress?.total}...`
                        : `⚡ Score All (${unscoredSearchCount})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Search Results (30+ Jobs Display) */}
              <div className="opportunity-grid">
                {paginatedSearchResults.map((job) => {
                  const scoreDetail = dbScoredMap[job.id];
                  const hasScore = scoreDetail && typeof scoreDetail.matchScore === "number";
                  const scoreVal = hasScore ? Math.round(scoreDetail.matchScore!) : null;
                  const isScoringThis = scoringJobId === job.id;

                  return (
                    <article
                      key={job.id}
                      className="panel opportunity-card"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        borderColor: hasScore && scoreVal! >= 80 ? "rgba(16, 185, 129, 0.4)" : "var(--line)",
                      }}
                    >
                      <div>
                        {/* Card Header */}
                        <div className="opportunity-topline">
                          <div>
                            <span className="section-label accent-label">{job.company_name}</span>
                            <h3 className="opportunity-title">{job.title}</h3>
                          </div>
                          <div>
                            {hasScore ? (
                              <span
                                className="status-good"
                                style={{
                                  padding: "4px 10px",
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  background: scoreVal! >= 85 ? "rgba(16, 185, 129, 0.2)" : scoreVal! >= 70 ? "rgba(59, 130, 246, 0.2)" : "rgba(245, 158, 11, 0.2)",
                                  color: scoreVal! >= 85 ? "var(--good)" : scoreVal! >= 70 ? "#60a5fa" : "var(--warn)",
                                  border: `1px solid ${scoreVal! >= 85 ? "rgba(16, 185, 129, 0.4)" : "rgba(59, 130, 246, 0.4)"}`,
                                }}
                              >
                                🟢 {scoreVal}% Fit
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleScoreJob(job.id)}
                                disabled={isScoringThis || isBatchScoring}
                                className="primary-link ghost-link"
                                style={{ fontSize: "0.75rem", padding: "2px 8px", minHeight: "26px" }}
                              >
                                {isScoringThis ? "Scoring..." : "⚡ Score Fit"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Explanation Snippet if Scored */}
                        {hasScore && (
                          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "10px 0 0", lineHeight: 1.4 }}>
                            {scoreDetail.explanation || "Analyzed against candidate profile."}
                          </p>
                        )}

                        {/* Metadata Rows */}
                        <div className="opportunity-metadata" style={{ marginTop: "12px" }}>
                          <div className="meta-row">
                            <span>Location</span>
                            <strong>{job.location || (job.remote ? "Remote" : "Not specified")}</strong>
                          </div>
                          <div className="meta-row">
                            <span>Employment Type</span>
                            <strong>{job.employment_type || "Full-time"}</strong>
                          </div>

                          {hasScore && scoreDetail.strengths.length > 0 && (
                            <div className="meta-row">
                              <span>Strengths</span>
                              <strong style={{ color: "var(--good)" }}>
                                {scoreDetail.strengths.slice(0, 2).join(", ")}
                              </strong>
                            </div>
                          )}

                          {hasScore && scoreDetail.missingSkills.length > 0 && (
                            <div className="meta-row">
                              <span>Skill Gaps</span>
                              <strong style={{ color: "var(--warn)" }}>
                                {scoreDetail.missingSkills.slice(0, 2).join(", ")}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="opportunity-footer" style={{ marginTop: "16px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="primary-link"
                            style={{ flex: 1, justifyContent: "center", fontSize: "0.85rem" }}
                          >
                            Open & Apply ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDismiss(job.id)}
                            className="action-btn"
                            title="Dismiss from feed"
                            style={{
                              fontSize: "0.8rem",
                              padding: "6px 10px",
                              color: "var(--error)",
                              border: "1px solid rgba(239, 68, 68, 0.2)",
                              background: "rgba(239, 68, 68, 0.06)",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Search Pagination Controls (9 items per page) */}
              {totalSearchPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                  <button
                    disabled={searchPage === 0}
                    onClick={() => setSearchPage((p) => p - 1)}
                    className="primary-link ghost-link"
                    style={{ minHeight: "36px", padding: "6px 14px", fontSize: "0.85rem" }}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500 }}>
                    Page {searchPage + 1} of {totalSearchPages} ({filteredSearchResults.length} total roles)
                  </span>
                  <button
                    disabled={searchPage >= totalSearchPages - 1}
                    onClick={() => setSearchPage((p) => p + 1)}
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
      )}

      {/* 5. TAB CONTENT 2: AI-MATCHED RECOMMENDATIONS */}
      {activeTab === "matched" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Controls Bar for Matched */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "var(--surface-muted)", padding: "12px 16px", borderRadius: "var(--radius)" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Filter by Fit:</span>
              <select
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(e.target.value === "all" ? "all" : Number(e.target.value))}
                style={{ fontSize: "0.82rem", height: "32px", padding: "0 8px" }}
              >
                <option value="all">All match levels</option>
                <option value="90">High fit (90%+)</option>
                <option value="75">Good fit (75%+)</option>
                <option value="50">Medium fit (50%+)</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                All ({matchedJobs.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "not_viewed" ? "active" : ""}`}
                onClick={() => setStatusFilter("not_viewed")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ○ Not Viewed
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "viewed" ? "active" : ""}`}
                onClick={() => setStatusFilter("viewed")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                👁 Viewed
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "applied" ? "active" : ""}`}
                onClick={() => setStatusFilter("applied")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ✓ Applied
              </button>
            </div>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="empty-state">
              <h3>No matched recommendations found</h3>
              <p>Try lowering the fit threshold or searching for roles in the Database Search tab.</p>
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

              {totalMatchPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                  <button
                    disabled={matchPage === 0}
                    onClick={() => setMatchPage((p) => p - 1)}
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
                    onClick={() => setMatchPage((p) => p + 1)}
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
      )}

      {/* 6. TAB CONTENT 3: WATCHLIST COMPANY OPENINGS */}
      {activeTab === "watchlist" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Status Filter Chips */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "var(--surface-muted)", padding: "12px 16px", borderRadius: "var(--radius)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Status Filters:</span>
            <div className="filter-row" style={{ alignItems: "center" }}>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                All ({counts.all})
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "not_viewed" ? "active" : ""}`}
                onClick={() => setStatusFilter("not_viewed")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ○ Not Viewed ({counts.notViewed})
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "viewed" ? "active" : ""}`}
                onClick={() => setStatusFilter("viewed")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                👁 Viewed ({counts.viewed})
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === "applied" ? "active" : ""}`}
                onClick={() => setStatusFilter("applied")}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ✓ Applied ({counts.applied})
              </button>
            </div>
          </div>

          {filteredOpps.length === 0 ? (
            <div className="empty-state">
              <h3>No openings found</h3>
              <p>No synced jobs align with your criteria. Ensure you are tracking companies in Watchlist Settings.</p>
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

              {totalOppPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                  <button
                    disabled={oppPage === 0}
                    onClick={() => setOppPage((p) => p - 1)}
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
                    onClick={() => setOppPage((p) => p + 1)}
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
      )}
    </div>
  );
}
