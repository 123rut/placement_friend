"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import OpportunityCard from "./OpportunityCard";

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

interface MatchedJobCard {
  id: string;
  job_id: string;
  title: string;
  url: string;
  location: string | null;
  company_name: string;
  match_score: number | null;
  explanation: string | null;
  strengths: string[] | null;
  missing_skills: string[] | null;
}

interface ScrapedOpp {
  id: string;
  company_name: string;
  role: string;
  role_type: string;
  min_cgpa: number | null;
  allowed_branches: string[];
  deadline: string | null;
  apply_url: string;
  posted_at: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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

  const matchedJobs: MatchedJobCard[] = useMemo(
    () => (Array.isArray(matchedJobsData) ? matchedJobsData : []),
    [matchedJobsData],
  );
  const scrapedOpps: ScrapedOpp[] = useMemo(
    () => (oppsData?.data && Array.isArray(oppsData.data) ? oppsData.data : []),
    [oppsData],
  );
  
  const loading = !matchedJobsData && !oppsData && !matchedError && !oppsError;

  // Filter States
  const [search, setSearch] = useState("");

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

  // Pagination states
  const [matchPage, setMatchPage] = useState(0);
  const [oppPage, setOppPage] = useState(0);
  const ITEMS_PER_PAGE = 6; // Fits neatly in 2-column or 3-column layouts


  // Handle Match Score filtering + Search
  const filteredMatches = useMemo(() => {
    return matchedJobs.filter((job) => {
      // 1. Search term match
      const query = search.toLowerCase();
      const matchesSearch =
        job.title.toLowerCase().includes(query) ||
        job.company_name.toLowerCase().includes(query) ||
        (job.explanation && job.explanation.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // 2. Score match
      if (minMatchScore !== "all") {
        if (job.match_score === null || job.match_score < minMatchScore) {
          return false;
        }
      }

      return true;
    });
  }, [matchedJobs, search, minMatchScore]);

  // Handle general scraped opportunities eligibility check + Search
  const filteredOpps = useMemo(() => {
    return scrapedOpps.filter((opp) => {
      // 1. Search term match
      const query = search.toLowerCase();
      const matchesSearch =
        opp.role.toLowerCase().includes(query) ||
        opp.company_name.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // 2. Eligibility filter (CGPA + Branch)
      if (onlyEligible) {
        const cgpaEligible = opp.min_cgpa === null || studentCgpa >= opp.min_cgpa;
        const branchEligible =
          opp.allowed_branches.length === 0 ||
          opp.allowed_branches.some(b => b.toLowerCase().includes(student.branch.toLowerCase()) || student.branch.toLowerCase().includes(b.toLowerCase()));

        if (!cgpaEligible || !branchEligible) {
          return false;
        }
      }

      return true;
    });
  }, [scrapedOpps, search, onlyEligible, studentCgpa, student.branch]);

  // Reset page numbers when search query or filter changes
  React.useEffect(() => {
    setMatchPage(0);
  }, [search, minMatchScore]);

  React.useEffect(() => {
    setOppPage(0);
  }, [search]);

  // Paginate sliced lists
  const paginatedMatches = useMemo(() => {
    return filteredMatches.slice(matchPage * ITEMS_PER_PAGE, (matchPage + 1) * ITEMS_PER_PAGE);
  }, [filteredMatches, matchPage]);

  const paginatedOpps = useMemo(() => {
    return filteredOpps.slice(oppPage * ITEMS_PER_PAGE, (oppPage + 1) * ITEMS_PER_PAGE);
  }, [filteredOpps, oppPage]);

  const totalMatchPages = Math.ceil(filteredMatches.length / ITEMS_PER_PAGE);
  const totalOppPages = Math.ceil(filteredOpps.length / ITEMS_PER_PAGE);


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
      <section className="panel" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", alignItems: "center" }}>
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
            <div style={{ marginBottom: "16px" }}>
              <span className="topbar-kicker">AI Rank Shortlist</span>
              <h2 style={{ margin: "4px 0 0", fontSize: "1.35rem", fontWeight: 700 }}>Resume-Matched Recommendations</h2>
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
                    <article className="panel opportunity-card matched-job-card" key={job.id || job.job_id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div className="opportunity-topline">
                          <div>
                            <span className="section-label accent-label">{job.company_name}</span>
                            <h3 className="opportunity-title">{job.title}</h3>
                          </div>
                          <span className="status-good" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
                            {job.match_score === null ? "Matched" : `${Math.round(job.match_score)}% match`}
                          </span>
                        </div>

                        <p className="panel-note" style={{ marginTop: "12px", color: "var(--text)", fontSize: "0.88rem" }}>
                          {job.explanation || "Calculated fit score matches candidate profile."}
                        </p>

                        <div className="opportunity-metadata" style={{ marginTop: "16px" }}>
                          <div className="meta-row">
                            <span>Location</span>
                            <strong>{job.location || "Not listed"}</strong>
                          </div>
                          <div className="meta-row">
                            <span>Strengths</span>
                            <strong title={(job.strengths || []).join(", ")} style={{ color: "var(--good)" }}>
                              {job.strengths && job.strengths.length > 0
                                ? job.strengths.slice(0, 2).join(", ")
                                : "Profile aligned"}
                            </strong>
                          </div>
                          <div className="meta-row">
                            <span>Gaps</span>
                            <strong title={(job.missing_skills || []).join(", ")} style={{ color: job.missing_skills && job.missing_skills.length > 0 ? "var(--warn)" : "var(--muted)" }}>
                              {job.missing_skills && job.missing_skills.length > 0
                                ? job.missing_skills.slice(0, 2).join(", ")
                                : "No major gaps"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="opportunity-footer" style={{ marginTop: "18px" }}>
                        <a href={job.url} target="_blank" rel="noopener noreferrer" className="primary-link" style={{ width: "100%", justifyContent: "center" }}>
                          Open Role
                        </a>
                      </div>
                    </article>
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
            <div style={{ marginBottom: "16px" }}>
              <span className="topbar-kicker">Employer watch feed</span>
              <h2 style={{ margin: "4px 0 0", fontSize: "1.35rem", fontWeight: 700 }}>All Watchlist Openings</h2>
            </div>

            {filteredOpps.length === 0 ? (
              <div className="empty-state">
                <h3>No openings found</h3>
                <p>
                  No scraped jobs align with your criteria. Ensure you are tracking companies in Watchlist Settings.
                </p>
              </div>
            ) : (
              <>
                <div className="opportunity-grid">
                  {paginatedOpps.map((opp) => (
                    <OpportunityCard key={opp.id} opportunity={opp as any} />
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
