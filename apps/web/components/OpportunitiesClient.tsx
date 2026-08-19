"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import MatchedJobCard, { MatchedJobData } from "./MatchedJobCard";
import { OpportunityStatus } from "./OpportunityCard";

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

interface SearchJobItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
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
  // 1. SWR queries
  const { data: matchedJobsData, error: matchedError, mutate: mutateMatches } = useSWR(
    "/api/careerpilot/jobs",
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: savedData, error: savedError, mutate: mutateSaved } = useSWR(
    "/api/opportunities/saved",
    fetcher,
    { revalidateOnFocus: false }
  );

  const matchedJobs: MatchedJobData[] = useMemo(
    () => (Array.isArray(matchedJobsData) ? matchedJobsData : []),
    [matchedJobsData],
  );

  const savedJobsList: MatchedJobData[] = useMemo(
    () => (savedData?.data && Array.isArray(savedData.data) ? savedData.data : []),
    [savedData],
  );

  const loading = !matchedJobsData && !matchedError;

  // 2. Active Tab: 'recommended' | 'search' | 'saved'
  const [activeTab, setActiveTab] = useState<"recommended" | "search" | "saved">("recommended");

  // 3. Recommended Filter States
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [companySearchInput, setCompanySearchInput] = useState<string>("");
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState<boolean>(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const [inFeedSearch, setInFeedSearch] = useState("");
  const isStudent = student.batch_year >= 2025 && student.batch_year <= 2028;
  const [hideSeniorRoles, setHideSeniorRoles] = useState<boolean>(isStudent);
  const [minMatchScore, setMinMatchScore] = useState<number | "all">("all");
  const [recommendedSortBy, setRecommendedSortBy] = useState<"best_match" | "newest" | "company">("best_match");
  const [recommendedPage, setRecommendedPage] = useState(0);

  // 4. Saved Tab Sub-Filter
  const [savedSubFilter, setSavedSubFilter] = useState<"all" | "bookmarked" | "applied">("all");
  const [savedPage, setSavedPage] = useState(0);

  // 5. Database Job Search State
  const [dbSearchQuery, setDbSearchQuery] = useState("");
  const [dbSearchLocation, setDbSearchLocation] = useState("");
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [dbSearchResults, setDbSearchResults] = useState<SearchJobItem[]>([]);
  const [dbSearchError, setDbSearchError] = useState("");
  const [dbScoredMap, setDbScoredMap] = useState<Record<string, ScoredJobDetail>>({});
  const [scoringJobId, setScoringJobId] = useState<string | null>(null);
  const [isBatchScoring, setIsBatchScoring] = useState(false);
  const [batchScoreProgress, setBatchScoreProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchFitFilter, setSearchFitFilter] = useState<"all" | "high_fit" | "scored" | "unscored">("all");
  const [searchSortBy, setSearchSortBy] = useState<"highest_fit" | "newest" | "company">("highest_fit");
  const [searchPage, setSearchPage] = useState(0);

  // Click outside company dropdown handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Read URL search params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const company = params.get("company") || params.get("search") || "";
      if (company) {
        setDbSearchQuery(company);
        setSelectedCompany(company);
      }
    }
  }, []);

  // Populate dbScoredMap from existing matched jobs
  useEffect(() => {
    if (matchedJobs.length > 0) {
      setDbScoredMap((prev) => {
        const next = { ...prev };
        matchedJobs.forEach((m) => {
          const actualId = m.job_id || m.id;
          if (!next[actualId]) {
            next[actualId] = {
              jobId: actualId,
              jobTitle: m.title,
              company: m.company_name,
              matchScore: m.match_score,
              eligible: true,
              explanation: m.explanation || "",
              strengths: m.strengths || [],
              missingSkills: m.missing_skills || [],
              applyUrl: m.url,
            };
          }
        });
        return next;
      });
    }
  }, [matchedJobs]);

  // Aggregate Company Counts across Recommended Jobs
  const companyCounts = useMemo(() => {
    const map = new Map<string, number>();
    matchedJobs.forEach((item) => {
      const c = item.company_name?.trim();
      if (c) map.set(c, (map.get(c) || 0) + 1);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [matchedJobs]);

  // Autocomplete matching companies
  const filteredCompanySuggestions = useMemo(() => {
    if (!companySearchInput.trim()) return companyCounts;
    return companyCounts.filter((c) =>
      c.name.toLowerCase().includes(companySearchInput.toLowerCase().trim())
    );
  }, [companyCounts, companySearchInput]);

  // -------------------------------------------------------------
  // FILTERED RECOMMENDED JOBS
  // -------------------------------------------------------------
  const filteredRecommendedJobs = useMemo(() => {
    return matchedJobs
      .filter((job) => {
        if (selectedCompany !== "all" && job.company_name.toLowerCase() !== selectedCompany.toLowerCase()) {
          return false;
        }
        if (hideSeniorRoles && isSeniorRole(job.title)) {
          return false;
        }
        if (minMatchScore !== "all") {
          const score = job.match_score ?? 0;
          if (score < minMatchScore) return false;
        }
        if (inFeedSearch.trim()) {
          const q = inFeedSearch.toLowerCase().trim();
          const matchTitle = job.title.toLowerCase().includes(q);
          const matchCompany = job.company_name.toLowerCase().includes(q);
          const matchLocation = (job.location || "").toLowerCase().includes(q);
          if (!matchTitle && !matchCompany && !matchLocation) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (recommendedSortBy === "best_match") {
          return (b.match_score ?? 0) - (a.match_score ?? 0);
        }
        if (recommendedSortBy === "company") {
          return a.company_name.localeCompare(b.company_name);
        }
        return 0;
      });
  }, [matchedJobs, selectedCompany, hideSeniorRoles, minMatchScore, inFeedSearch, recommendedSortBy]);

  const RECOMMENDED_PER_PAGE = 6;
  const paginatedRecommended = useMemo(() => {
    return filteredRecommendedJobs.slice(
      recommendedPage * RECOMMENDED_PER_PAGE,
      (recommendedPage + 1) * RECOMMENDED_PER_PAGE
    );
  }, [filteredRecommendedJobs, recommendedPage]);
  const totalRecommendedPages = Math.ceil(filteredRecommendedJobs.length / RECOMMENDED_PER_PAGE);

  // -------------------------------------------------------------
  // FILTERED SAVED & APPLIED JOBS
  // -------------------------------------------------------------
  const filteredSavedJobs = useMemo(() => {
    return savedJobsList.filter((job) => {
      if (savedSubFilter === "bookmarked") {
        return job.is_saved === true && job.status !== "APPLIED";
      }
      if (savedSubFilter === "applied") {
        return job.status === "APPLIED";
      }
      return true;
    });
  }, [savedJobsList, savedSubFilter]);

  const bookmarkedCount = useMemo(
    () => savedJobsList.filter((j) => j.is_saved && j.status !== "APPLIED").length,
    [savedJobsList]
  );
  const appliedCount = useMemo(
    () => savedJobsList.filter((j) => j.status === "APPLIED").length,
    [savedJobsList]
  );


  const SAVED_PER_PAGE = 6;
  const paginatedSaved = useMemo(() => {
    return filteredSavedJobs.slice(
      savedPage * SAVED_PER_PAGE,
      (savedPage + 1) * SAVED_PER_PAGE
    );
  }, [filteredSavedJobs, savedPage]);
  const totalSavedPages = Math.ceil(filteredSavedJobs.length / SAVED_PER_PAGE);

  // -------------------------------------------------------------
  // FILTERED SEARCH RESULTS
  // -------------------------------------------------------------
  const filteredSearchResults = useMemo(() => {
    let list = dbSearchResults.filter((job) => {
      if (hideSeniorRoles && isSeniorRole(job.title)) {
        return false;
      }
      if (selectedCompany !== "all" && job.company_name.toLowerCase() !== selectedCompany.toLowerCase()) {
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
  }, [dbSearchResults, dbScoredMap, hideSeniorRoles, searchFitFilter, searchSortBy, selectedCompany]);

  const SEARCH_ITEMS_PER_PAGE = 9;
  const paginatedSearchResults = useMemo(() => {
    return filteredSearchResults.slice(
      searchPage * SEARCH_ITEMS_PER_PAGE,
      (searchPage + 1) * SEARCH_ITEMS_PER_PAGE
    );
  }, [filteredSearchResults, searchPage]);
  const totalSearchPages = Math.ceil(filteredSearchResults.length / SEARCH_ITEMS_PER_PAGE);

  // -------------------------------------------------------------
  // USER ACTIONS: SAVE, APPLY, SCORE, DISMISS
  // -------------------------------------------------------------
  const handleToggleSave = async (jobId: string, isSaved: boolean) => {
    // 1. Optimistically update saved list cache
    mutateSaved(
      (current: any) => {
        if (!current?.data) return current;
        if (!isSaved) {
          // Immediately mark as unsaved and filter out if not applied
          return {
            ...current,
            data: current.data
              .map((item: MatchedJobData) =>
                item.id === jobId || item.job_id === jobId ? { ...item, is_saved: false } : item
              )
              .filter((item: MatchedJobData) => item.is_saved || item.status === "APPLIED"),
          };
        } else {
          // Immediately mark as saved
          const existing = current.data.find((item: MatchedJobData) => item.id === jobId || item.job_id === jobId);
          if (existing) {
            return {
              ...current,
              data: current.data.map((item: MatchedJobData) =>
                item.id === jobId || item.job_id === jobId ? { ...item, is_saved: true } : item
              ),
            };
          }
          const matchItem = matchedJobs.find((m) => m.id === jobId || m.job_id === jobId);
          const searchItem = dbSearchResults.find((s) => s.id === jobId);
          const newItem: MatchedJobData = matchItem || {
            id: jobId,
            title: searchItem?.title || "Role",
            url: searchItem?.url || "#",
            location: searchItem?.location || null,
            company_name: searchItem?.company_name || "",
            match_score: dbScoredMap[jobId]?.matchScore ?? null,
            explanation: dbScoredMap[jobId]?.explanation ?? null,
            strengths: dbScoredMap[jobId]?.strengths ?? null,
            missing_skills: dbScoredMap[jobId]?.missingSkills ?? null,
            is_saved: true,
            status: "VIEWED",
          };
          return {
            ...current,
            data: [newItem, ...current.data],
          };
        }
      },
      false
    );

    // 2. Optimistically update matchedJobs cache
    mutateMatches(
      (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.map((item: MatchedJobData) =>
          item.id === jobId || item.job_id === jobId ? { ...item, is_saved: isSaved } : item
        );
      },
      false
    );

    try {
      const endpoint = isSaved ? `/api/opportunities/${jobId}/save` : `/api/opportunities/${jobId}/unsave`;
      await fetch(endpoint, { method: "POST" });
      mutateSaved();
      mutateMatches();
    } catch (err) {
      console.error("Save toggle failed", err);
    }
  };

  const handleOpportunityStatusChange = (
    jobId: string,
    newStatus: OpportunityStatus,
    appliedAt?: string
  ) => {
    const nowIso = appliedAt || new Date().toISOString();

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

    mutateSaved(
      (current: any) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.map((item: MatchedJobData) =>
            item.id === jobId || item.job_id === jobId
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
  };


  const handleDismiss = (jobId: string) => {
    mutateMatches(
      (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.filter((item: MatchedJobData) => item.id !== jobId && item.job_id !== jobId);
      },
      false
    );
    mutateSaved(
      (current: any) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.filter((item: MatchedJobData) => item.id !== jobId && item.job_id !== jobId),
        };
      },
      false
    );
    setDbSearchResults((prev) => prev.filter((j) => j.id !== jobId));
  };

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
        setDbSearchError(data.error || "Search failed. Please try again.");
        setDbSearchResults([]);
      } else {
        setDbSearchResults(Array.isArray(data.results) ? data.results : []);
      }
    } catch {
      setDbSearchError("Network error while querying jobs.");
    } finally {
      setIsSearchingDb(false);
    }
  };

  const handleScoreJob = async (jobId: string) => {
    setScoringJobId(jobId);
    setDbSearchError("");
    try {
      const res = await fetch("/api/careerpilot/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setDbSearchError(data.error || "Unable to score job.");
      } else {
        setDbScoredMap((prev) => ({
          ...prev,
          [jobId]: {
            jobId: data.jobId || jobId,
            jobTitle: data.jobTitle || "",
            company: data.company || "",
            matchScore: typeof data.matchScore === "number" ? data.matchScore : null,
            eligible: data.eligible !== false,
            explanation: data.explanation || "",
            strengths: Array.isArray(data.strengths) ? data.strengths : [],
            missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
            applyUrl: data.applyUrl || "",
          },
        }));
        mutateMatches();
      }
    } catch {
      setDbSearchError("Error scoring role against profile.");
    } finally {
      setScoringJobId(null);
    }
  };

  const handleBatchScoreAll = async () => {
    const unscored = filteredSearchResults.filter((j) => !dbScoredMap[j.id]);
    if (unscored.length === 0) return;

    setIsBatchScoring(true);
    setDbSearchError("");
    setBatchScoreProgress({ current: 0, total: unscored.length });

    for (let i = 0; i < unscored.length; i++) {
      const job = unscored[i];
      setBatchScoreProgress({ current: i + 1, total: unscored.length });
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
              jobId: data.jobId || job.id,
              jobTitle: data.jobTitle || job.title,
              company: data.company || job.company_name,
              matchScore: typeof data.matchScore === "number" ? data.matchScore : null,
              eligible: data.eligible !== false,
              explanation: data.explanation || "",
              strengths: Array.isArray(data.strengths) ? data.strengths : [],
              missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
              applyUrl: data.applyUrl || job.url,
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

  const handleRefresh = async () => {
    await Promise.all([mutateMatches(), mutateSaved()]);
  };

  const unscoredSearchCount = dbSearchResults.filter((j) => !dbScoredMap[j.id]).length;
  const highFitSearchCount = dbSearchResults.filter((j) => (dbScoredMap[j.id]?.matchScore ?? 0) >= 80).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "0 0 4px" }}>
            Opportunities & Job Discovery
          </h1>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
            Personalized roles matched to your academic profile, candidate skills, and tracked companies.
          </p>
        </div>
        <button onClick={handleRefresh} className="primary-link ghost-link" style={{ fontSize: "0.82rem", minHeight: "34px", padding: "0 12px" }}>
          <svg style={{ width: "15px", height: "15px", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
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
              placeholder="Search any company (e.g. Airbnb, Stripe) or role / tech stack (e.g. React, Java)..."
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
              placeholder="Location (e.g. Pune, Remote)"
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
            {isSearchingDb ? <span>Searching...</span> : <span>⚡ Search Database</span>}
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="quick-search-chips">
          <span className="quick-search-label">Quick Search:</span>
          {[
            { label: "🏢 Airbnb", query: "Airbnb", location: "" },
            { label: "🏢 Stripe", query: "Stripe", location: "" },
            { label: "🏢 Canva", query: "Canva", location: "" },
            { label: "⚡ SDE / Backend", query: "Software Engineer", location: "" },
            { label: "🌐 Frontend / React", query: "Frontend React", location: "" },
            { label: "☕ Java / Spring", query: "Java Spring", location: "" },
            { label: "🐍 Python / AI", query: "Python Machine Learning", location: "" },
            { label: "🌐 Remote Only", query: "", location: "Remote" },
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

      {/* 3. The 3 Primary Discovery Switcher Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("recommended")}
            className={`filter-chip ${activeTab === "recommended" ? "active" : ""}`}
            style={{ fontSize: "0.88rem", padding: "8px 16px", borderRadius: "8px", fontWeight: 700 }}
          >
            🎯 Recommended {matchedJobs.length > 0 ? `(${matchedJobs.length})` : ""}
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`filter-chip ${activeTab === "search" ? "active" : ""}`}
            style={{ fontSize: "0.88rem", padding: "8px 16px", borderRadius: "8px", fontWeight: 700 }}
          >
            🔍 Search Jobs {dbSearchResults.length > 0 ? `(${dbSearchResults.length})` : ""}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`filter-chip ${activeTab === "saved" ? "active" : ""}`}
            style={{ fontSize: "0.88rem", padding: "8px 16px", borderRadius: "8px", fontWeight: 700 }}
          >
            ⭐ Saved {savedJobsList.length > 0 ? `(${savedJobsList.length})` : ""}
          </button>
        </div>

        {/* Global Seniority Mode Toggle */}
        <button
          type="button"
          onClick={() => setHideSeniorRoles((prev) => !prev)}
          className={`filter-chip ${hideSeniorRoles ? "active" : ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.8rem",
            padding: "5px 12px",
            borderRadius: "6px",
            border: hideSeniorRoles ? "1px solid var(--accent)" : "1px solid var(--line)",
            background: hideSeniorRoles ? "var(--accent-soft)" : "transparent",
            color: hideSeniorRoles ? "var(--accent)" : "var(--muted)",
          }}
        >
          {hideSeniorRoles ? "🎓 Early Career Only (Senior Hidden)" : "🌐 All Roles (Including Senior)"}
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: 🎯 RECOMMENDED (Personalized, Pre-Scored Matches)       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "recommended" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Streamlined Recommended Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              background: "rgba(15, 23, 42, 0.75)",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
            }}
          >
            {/* Left: Searchable Company Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 280px", minWidth: "220px" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                🏢 Company:
              </span>

              <div ref={companyDropdownRef} style={{ position: "relative", flex: 1, maxWidth: "280px" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="All Companies..."
                    value={companySearchInput || (selectedCompany !== "all" ? selectedCompany : "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCompanySearchInput(val);
                      setIsCompanyDropdownOpen(true);
                      if (!val.trim()) setSelectedCompany("all");
                    }}
                    onFocus={() => setIsCompanyDropdownOpen(true)}
                    style={{
                      width: "100%",
                      height: "34px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      padding: "0 28px 0 10px",
                      borderRadius: "6px",
                      background: "var(--surface)",
                      color: selectedCompany !== "all" ? "var(--accent)" : "var(--text-primary)",
                      border: selectedCompany !== "all" ? "1px solid var(--accent)" : "1px solid var(--line)",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setIsCompanyDropdownOpen((p) => !p)}
                    style={{
                      position: "absolute",
                      right: "6px",
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {isCompanyDropdownOpen ? "▲" : "▼"}
                  </button>
                </div>

                {isCompanyDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: "#0f172a",
                      border: "1px solid var(--line)",
                      borderRadius: "8px",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6)",
                      maxHeight: "220px",
                      overflowY: "auto",
                      padding: "4px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompany("all");
                        setCompanySearchInput("");
                        setIsCompanyDropdownOpen(false);
                        setRecommendedPage(0);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 10px",
                        fontSize: "0.8rem",
                        fontWeight: selectedCompany === "all" ? 700 : 500,
                        color: selectedCompany === "all" ? "var(--accent)" : "var(--text-primary)",
                        background: selectedCompany === "all" ? "var(--accent-soft)" : "transparent",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>🏢 All Companies</span>
                      <span style={{ fontSize: "0.72rem", opacity: 0.75 }}>({matchedJobs.length})</span>
                    </button>

                    {filteredCompanySuggestions.map(({ name, count }) => {
                      const isSelected = selectedCompany.toLowerCase() === name.toLowerCase();
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setSelectedCompany(name);
                            setCompanySearchInput(name);
                            setIsCompanyDropdownOpen(false);
                            setRecommendedPage(0);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 10px",
                            fontSize: "0.8rem",
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "var(--accent)" : "var(--text-primary)",
                            background: isSelected ? "var(--accent-soft)" : "transparent",
                            borderRadius: "6px",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>🏢 {name}</span>
                          <span style={{ fontSize: "0.72rem", opacity: 0.8, background: "rgba(255, 255, 255, 0.08)", padding: "1px 6px", borderRadius: "10px" }}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedCompany !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCompany("all");
                    setCompanySearchInput("");
                    setRecommendedPage(0);
                  }}
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "12px",
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Right: Score Filter & Sorting */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={minMatchScore}
                onChange={(e) => {
                  setMinMatchScore(e.target.value === "all" ? "all" : Number(e.target.value));
                  setRecommendedPage(0);
                }}
                style={{ fontSize: "0.8rem", height: "32px", padding: "0 8px", borderRadius: "6px" }}
              >
                <option value="all">Match: All Scores</option>
                <option value="70">Match: 70%+ Fit</option>
                <option value="80">Match: 80%+ High Fit</option>
                <option value="90">Match: 90%+ Top Match</option>
              </select>

              <select
                value={recommendedSortBy}
                onChange={(e: any) => setRecommendedSortBy(e.target.value)}
                style={{ fontSize: "0.8rem", height: "32px", padding: "0 8px", borderRadius: "6px" }}
              >
                <option value="best_match">Sort: Best Match</option>
                <option value="company">Sort: Company (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Recommended Jobs Grid */}
          {loading ? (
            <div className="panel" style={{ padding: "48px 24px", textAlign: "center" }}>
              <h3>Analyzing your profile against tracked companies...</h3>
              <p style={{ color: "var(--muted)" }}>Extracting skills, evaluating branch baselines, and scoring job compatibility.</p>
            </div>
          ) : filteredRecommendedJobs.length === 0 ? (
            <div className="empty-state" style={{ padding: "48px 24px" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎯</div>
              <h3 style={{ fontSize: "1.2rem", margin: "0 0 6px" }}>No Recommended Jobs Found</h3>
              <p style={{ maxWidth: "480px", margin: "0 auto", color: "var(--muted)", fontSize: "0.9rem" }}>
                No active openings matched your current filter criteria. Try resetting company or score filters, or search unrestricted roles in the <strong>Search Jobs</strong> tab.
              </p>
            </div>
          ) : (
            <>
              <div className="opportunity-grid">
                {paginatedRecommended.map((job) => (
                  <MatchedJobCard
                    key={job.id || job.job_id}
                    job={job}
                    onStatusChange={handleOpportunityStatusChange}
                    onToggleSave={handleToggleSave}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>

              {totalRecommendedPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "20px" }}>
                  <button
                    disabled={recommendedPage === 0}
                    onClick={() => setRecommendedPage((p) => p - 1)}
                    className="primary-link ghost-link"
                    style={{ fontSize: "0.82rem", padding: "4px 14px" }}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    Page {recommendedPage + 1} of {totalRecommendedPages}
                  </span>
                  <button
                    disabled={recommendedPage >= totalRecommendedPages - 1}
                    onClick={() => setRecommendedPage((p) => p + 1)}
                    className="primary-link ghost-link"
                    style={{ fontSize: "0.82rem", padding: "4px 14px" }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: 🔍 SEARCH JOBS (Unrestricted Database Search)           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {dbSearchError && (
            <div
              className="alert-inline"
              style={{
                padding: "12px 16px",
                borderRadius: "var(--radius)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "var(--error)",
                fontSize: "0.88rem",
              }}
            >
              <span>⚠️ {dbSearchError}</span>
              {dbSearchError.toLowerCase().includes("profile") && (
                <Link href="/profile" className="primary-link" style={{ fontSize: "0.8rem", padding: "4px 12px", minHeight: "28px" }}>
                  Go to Profile →
                </Link>
              )}
            </div>
          )}

          {dbSearchResults.length === 0 && !isSearchingDb ? (
            <div className="empty-state" style={{ padding: "48px 24px" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
              <h3 style={{ fontSize: "1.2rem", margin: "0 0 6px" }}>Search the Entire Job Database</h3>
              <p style={{ maxWidth: "480px", margin: "0 auto", color: "var(--muted)", fontSize: "0.9rem" }}>
                Enter any company, job title, technology, or location above to explore opportunities outside your tracked list. Click <strong>⚡ Score Fit</strong> on any role to calculate your personalized match score.
              </p>
            </div>
          ) : (
            <>
              {/* Search Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "var(--surface-muted)", padding: "10px 16px", borderRadius: "var(--radius)" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginRight: "4px" }}>Filter:</span>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("all")}
                    className={`filter-chip ${searchFitFilter === "all" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                  >
                    All ({dbSearchResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("high_fit")}
                    className={`filter-chip ${searchFitFilter === "high_fit" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                  >
                    🔥 High Fit ({highFitSearchCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("scored")}
                    className={`filter-chip ${searchFitFilter === "scored" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                  >
                    ⚡ Scored ({dbSearchResults.length - unscoredSearchCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchFitFilter("unscored")}
                    className={`filter-chip ${searchFitFilter === "unscored" ? "active" : ""}`}
                    style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                  >
                    ○ Unscored ({unscoredSearchCount})
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    value={searchSortBy}
                    onChange={(e: any) => setSearchSortBy(e.target.value)}
                    style={{ fontSize: "0.8rem", height: "30px", padding: "0 6px" }}
                  >
                    <option value="highest_fit">Sort: Highest Fit</option>
                    <option value="newest">Sort: Most Recent</option>
                    <option value="company">Sort: Company (A-Z)</option>
                  </select>

                  {unscoredSearchCount > 0 && (
                    <button
                      type="button"
                      onClick={handleBatchScoreAll}
                      disabled={isBatchScoring}
                      className="primary-link"
                      style={{ fontSize: "0.78rem", height: "30px", padding: "0 10px", background: "var(--accent)" }}
                    >
                      {isBatchScoring
                        ? `Scoring ${batchScoreProgress?.current} of ${batchScoreProgress?.total}...`
                        : `⚡ Score All (${unscoredSearchCount})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Search Results */}
              <div className="opportunity-grid">
                {paginatedSearchResults.map((job) => {
                  const scoreDetail = dbScoredMap[job.id];
                  const isScored = !!scoreDetail;
                  const isEligible = isScored && scoreDetail.eligible !== false && typeof scoreDetail.matchScore === "number";
                  const scoreVal = isEligible ? Math.round(scoreDetail.matchScore!) : null;
                  const isScoringThis = scoringJobId === job.id;
                  const isSaved = savedJobsList.some((s) => (s.job_id || s.id) === job.id && s.is_saved);

                  return (
                    <article
                      key={job.id}
                      className="panel opportunity-card"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        borderColor: isEligible && scoreVal! >= 80
                          ? "rgba(16, 185, 129, 0.4)"
                          : isScored && !isEligible
                            ? "rgba(239, 68, 68, 0.3)"
                            : "var(--line)",
                      }}
                    >
                      <div>
                        {/* Card Topline */}
                        <div className="opportunity-topline">
                          <div>
                            <span className="section-label accent-label">{job.company_name}</span>
                            <h3 className="opportunity-title">{job.title}</h3>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {isEligible ? (
                              <span
                                className="status-good"
                                style={{
                                  padding: "3px 8px",
                                  fontSize: "0.78rem",
                                  fontWeight: 700,
                                  background: scoreVal! >= 85 ? "rgba(16, 185, 129, 0.2)" : "rgba(59, 130, 246, 0.2)",
                                  color: scoreVal! >= 85 ? "var(--good)" : "#60a5fa",
                                  border: `1px solid ${scoreVal! >= 85 ? "rgba(16, 185, 129, 0.4)" : "rgba(59, 130, 246, 0.4)"}`,
                                  borderRadius: "999px",
                                }}
                              >
                                🟢 {scoreVal}% Fit
                              </span>
                            ) : isScored ? (
                              <span
                                className="status-warn"
                                style={{
                                  padding: "3px 8px",
                                  fontSize: "0.78rem",
                                  fontWeight: 700,
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  borderRadius: "999px",
                                }}
                                title={scoreDetail.explanation || "Ineligible for profile baseline"}
                              >
                                ⚠️ Ineligible
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleScoreJob(job.id)}
                                disabled={isScoringThis || isBatchScoring}
                                className="primary-link ghost-link"
                                style={{ fontSize: "0.74rem", padding: "2px 8px", minHeight: "26px" }}
                              >
                                {isScoringThis ? "Scoring..." : "⚡ Score Fit"}
                              </button>
                            )}

                            {/* Bookmark Star Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleSave(job.id, !isSaved)}
                              title={isSaved ? "Saved" : "Save role"}
                              style={{
                                background: isSaved ? "rgba(245, 158, 11, 0.15)" : "transparent",
                                border: `1px solid ${isSaved ? "rgba(245, 158, 11, 0.4)" : "var(--line)"}`,
                                color: isSaved ? "#f59e0b" : "var(--muted)",
                                borderRadius: "999px",
                                padding: "2px 8px",
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {isSaved ? "⭐ Saved" : "☆ Save"}
                            </button>
                          </div>
                        </div>

                        {/* Location & Employment Strip */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--muted)", marginTop: "8px" }}>
                          <span>📍 {job.location || "Location not listed"}</span>
                          <span>•</span>
                          <span>💼 {job.employment_type || "Full-time"}</span>
                        </div>

                        {/* Criteria Skill Tags: Strengths & Gaps */}
                        {isScored && isEligible && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                            {scoreDetail.strengths && scoreDetail.strengths.length > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                                  Strengths:
                                </span>
                                {scoreDetail.strengths.slice(0, 3).map((s) => (
                                  <span
                                    key={s}
                                    style={{
                                      fontSize: "0.74rem",
                                      fontWeight: 600,
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      background: "rgba(16, 185, 129, 0.1)",
                                      border: "1px solid rgba(16, 185, 129, 0.25)",
                                      color: "var(--good)",
                                    }}
                                  >
                                    ✓ {s}
                                  </span>
                                ))}
                              </div>
                            )}

                            {scoreDetail.missingSkills && scoreDetail.missingSkills.length > 0 ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                                  Gaps:
                                </span>
                                {scoreDetail.missingSkills.slice(0, 3).map((g) => (
                                  <span
                                    key={g}
                                    style={{
                                      fontSize: "0.74rem",
                                      fontWeight: 500,
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      background: "rgba(245, 158, 11, 0.08)",
                                      border: "1px solid rgba(245, 158, 11, 0.25)",
                                      color: "var(--warn)",
                                    }}
                                  >
                                    ○ {g}
                                  </span>
                                ))}
                              </div>
                            ) : scoreVal !== null && scoreVal < 90 ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                                  Gaps:
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.74rem",
                                    fontWeight: 500,
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    background: "rgba(245, 158, 11, 0.08)",
                                    border: "1px solid rgba(245, 158, 11, 0.25)",
                                    color: "var(--warn)",
                                  }}
                                >
                                  ○ {scoreVal < 60 ? "Specialized domain depth" : scoreVal < 75 ? "Advanced domain tooling" : "Production project depth"}
                                </span>
                              </div>
                            ) : null}


                          </div>
                        )}
                      </div>


                      {/* Card Footer */}
                      <div className="opportunity-footer" style={{ marginTop: "14px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="primary-link"
                            style={{ flex: 1, justifyContent: "center", fontSize: "0.84rem", height: "34px" }}
                          >
                            View Job →
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalSearchPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "20px" }}>
                  <button
                    disabled={searchPage === 0}
                    onClick={() => setSearchPage((p) => p - 1)}
                    className="primary-link ghost-link"
                    style={{ fontSize: "0.82rem", padding: "4px 14px" }}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    Page {searchPage + 1} of {totalSearchPages}
                  </span>
                  <button
                    disabled={searchPage >= totalSearchPages - 1}
                    onClick={() => setSearchPage((p) => p + 1)}
                    className="primary-link ghost-link"
                    style={{ fontSize: "0.82rem", padding: "4px 14px" }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: ⭐ SAVED (Personal Bookmarked & Applied Pipeline)        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "saved" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Sub-Filters Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              background: "rgba(15, 23, 42, 0.75)",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)", marginRight: "4px" }}>Pipeline View:</span>
              <button
                type="button"
                className={`filter-chip ${savedSubFilter === "all" ? "active" : ""}`}
                onClick={() => {
                  setSavedSubFilter("all");
                  setSavedPage(0);
                }}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                All Pipeline ({savedJobsList.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${savedSubFilter === "bookmarked" ? "active" : ""}`}
                onClick={() => {
                  setSavedSubFilter("bookmarked");
                  setSavedPage(0);
                }}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ⭐ Bookmarked ({bookmarkedCount})
              </button>
              <button
                type="button"
                className={`filter-chip ${savedSubFilter === "applied" ? "active" : ""}`}
                onClick={() => {
                  setSavedSubFilter("applied");
                  setSavedPage(0);
                }}
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ✓ Applied ({appliedCount})
              </button>
            </div>
          </div>

          {filteredSavedJobs.length === 0 ? (
            <div className="empty-state" style={{ padding: "48px 24px" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⭐</div>
              <h3 style={{ fontSize: "1.2rem", margin: "0 0 6px" }}>No Saved Roles Yet</h3>
              <p style={{ maxWidth: "480px", margin: "0 auto", color: "var(--muted)", fontSize: "0.9rem" }}>
                Click the <strong>☆ Save</strong> star on any role in <strong>Recommended</strong> or <strong>Search Jobs</strong> to add it to your personal application pipeline.
              </p>
            </div>
          ) : (
            <>
              <div className="opportunity-grid">
                {paginatedSaved.map((job) => (
                  <MatchedJobCard
                    key={job.id || job.job_id}
                    job={job}
                    onStatusChange={handleOpportunityStatusChange}
                    onToggleSave={handleToggleSave}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>

              {totalSavedPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "20px" }}>
                  <button
                    disabled={savedPage === 0}
                    onClick={() => setSavedPage((p) => p - 1)}
                    className="primary-link ghost-link"
                    style={{ fontSize: "0.82rem", padding: "4px 14px" }}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    Page {savedPage + 1} of {totalSavedPages}
                  </span>
                  <button
                    disabled={savedPage >= totalSavedPages - 1}
                    onClick={() => setSavedPage((p) => p + 1)}
                    className="primary-link ghost-link"
                    style={{ fontSize: "0.82rem", padding: "4px 14px" }}
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
