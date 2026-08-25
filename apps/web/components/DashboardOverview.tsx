"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import CompanyLogo from "./CompanyLogo";
import { MatchedJobData } from "./MatchedJobCard";

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
  profileCompleteness,
  dashboardSummary,
}: DashboardOverviewProps) {
  // 1. SWR Caching: load matched recommendations
  const { data: matchedJobsData, mutate: mutateMatches } = useSWR(
    "/api/careerpilot/jobs",
    fetcher,
    { revalidateOnFocus: false }
  );

  // 2. SWR Caching: load saved & applied tracking list (Source of Truth)
  const { data: savedData, mutate: mutateSaved } = useSWR(
    "/api/opportunities/saved",
    fetcher,
    { revalidateOnFocus: false }
  );

  const savedJobsList: MatchedJobData[] = useMemo(
    () => (savedData?.data && Array.isArray(savedData.data) ? savedData.data : []),
    [savedData]
  );

  const matchedJobs: MatchedJobData[] = useMemo(() => {
    if (!Array.isArray(matchedJobsData)) return [];
    const savedMap = new Map<string, MatchedJobData>();
    savedJobsList.forEach((s) => {
      const sId = s.job_id || s.id;
      if (sId) savedMap.set(sId, s);
    });

    return matchedJobsData.map((job) => {
      const id = job.job_id || job.id;
      const savedInfo = id ? savedMap.get(id) : undefined;
      return {
        ...job,
        title: job.title || job.role || "Role",
        url: job.url || job.apply_url || "#",
        is_saved: typeof job.is_saved === "boolean" ? job.is_saved : (savedInfo?.is_saved ?? false),
        status: job.status && job.status !== "NOT_VIEWED" ? job.status : (savedInfo?.status ?? job.status ?? "NOT_VIEWED"),
        applied_at: job.applied_at || savedInfo?.applied_at || null,
        saved_at: job.saved_at || savedInfo?.saved_at || null,
      };
    });
  }, [matchedJobsData, savedJobsList]);

  // Real backend metrics
  const bookmarkedCount = useMemo(
    () => savedJobsList.filter((j) => j.is_saved && j.status !== "APPLIED").length,
    [savedJobsList]
  );
  const appliedCount = useMemo(
    () => savedJobsList.filter((j) => j.status === "APPLIED").length,
    [savedJobsList]
  );
  const strongMatchesSavedCount = useMemo(
    () => savedJobsList.filter((j) => (j.match_score ?? j.matchScore ?? 0) >= 65).length,
    [savedJobsList]
  );

  const firstName = student.full_name ? student.full_name.split(" ")[0] : "Candidate";
  const userInitial = student.full_name ? student.full_name.charAt(0).toUpperCase() : "U";

  // Career Focus Area dynamically derived from branch
  const focusArea = useMemo(() => {
    const branchVal = (student.branch || "").toLowerCase();
    if (branchVal.includes("computer") || branchVal.includes("cse") || branchVal.includes("it") || branchVal.includes("software")) {
      return "Backend & Systems Engineering";
    }
    if (branchVal.includes("electronics") || branchVal.includes("ece") || branchVal.includes("eee")) {
      return "Embedded Systems & Hardware Software Co-design";
    }
    if (branchVal.includes("data") || branchVal.includes("ai") || branchVal.includes("ml")) {
      return "AI Systems & Machine Learning Engineering";
    }
    return "Software Engineering & Technology";
  }, [student.branch]);

  const focusNote = useMemo(() => {
    const branchVal = (student.branch || "").toLowerCase();
    if (branchVal.includes("computer") || branchVal.includes("cse") || branchVal.includes("it")) {
      return "Backend and distributed systems roles are currently your strongest fit.";
    }
    if (branchVal.includes("electronics") || branchVal.includes("ece")) {
      return "Blending platform and systems openings maximizes your match surface.";
    }
    return "Full-stack and flexible technology tracks are aligned with your profile.";
  }, [student.branch]);

  // Top Recommendations (Top 3 highest score matches)
  const topRecommendations = useMemo(() => {
    return matchedJobs
      .filter((job) => typeof (job.match_score ?? job.matchScore) === "number")
      .sort((a, b) => (b.match_score ?? b.matchScore ?? 0) - (a.match_score ?? a.matchScore ?? 0))
      .slice(0, 3);
  }, [matchedJobs]);

  // Optimistic Save Toggle Handler
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const handleToggleSave = async (jobId: string, currentIsSaved: boolean) => {
    setSavingJobId(jobId);
    const nextSaved = !currentIsSaved;

    // Optimistically update saved list cache
    mutateSaved(
      (curr: any) => {
        if (!curr?.data) return curr;
        if (!nextSaved) {
          return {
            ...curr,
            data: curr.data
              .map((item: MatchedJobData) =>
                item.id === jobId || item.job_id === jobId ? { ...item, is_saved: false } : item
              )
              .filter((item: MatchedJobData) => item.is_saved || item.status === "APPLIED"),
          };
        } else {
          const matchItem = matchedJobs.find((m) => m.id === jobId || m.job_id === jobId);
          return {
            ...curr,
            data: matchItem ? [{ ...matchItem, is_saved: true }, ...curr.data] : curr.data,
          };
        }
      },
      false
    );

    // Optimistically update matchedJobs cache
    mutateMatches(
      (curr: any) => {
        if (!Array.isArray(curr)) return curr;
        return curr.map((item: MatchedJobData) =>
          item.id === jobId || item.job_id === jobId ? { ...item, is_saved: nextSaved } : item
        );
      },
      false
    );

    try {
      const endpoint = nextSaved ? `/api/opportunities/${jobId}/save` : `/api/opportunities/${jobId}/unsave`;
      await fetch(endpoint, { method: "POST" });
      mutateSaved();
      mutateMatches();
    } catch (err) {
      console.error("Save toggle failed", err);
    } finally {
      setSavingJobId(null);
    }
  };

  // View Tracking Handler for View Job CTA
  const handleOpenJob = (jobId: string) => {
    fetch(`/api/opportunities/${jobId}/view`, { method: "POST" }).catch((err) =>
      console.error("View tracking error:", err)
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER ROW                                                 */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent)",
              display: "block",
              marginBottom: "2px",
            }}
          >
            COMMAND CENTER
          </span>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            Welcome back, {firstName} 👋
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.88rem" }}>
            Here&apos;s what&apos;s happening with your career search.
          </p>
        </div>

        {/* User Identity Pill */}
        <Link
          href="/profile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 14px 6px 8px",
            borderRadius: "999px",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid var(--line)",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 0.2s ease",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34d399",
              fontWeight: 800,
              fontSize: "0.95rem",
            }}
          >
            {userInitial}
            <span
              style={{
                position: "absolute",
                bottom: "-1px",
                right: "-1px",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "var(--good)",
                color: "#022c22",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.6rem",
                fontWeight: 900,
                border: "2px solid #0f172a",
              }}
            >
              ✓
            </span>
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, lineHeight: 1.2 }}>{firstName}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--good)", fontWeight: 600 }}>Verified</div>
          </div>
        </Link>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO FOCUS CARD (Glassmorphism & Gradient Glow)             */}
      {/* ------------------------------------------------------------- */}
      <section
        style={{
          position: "relative",
          borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.85) 45%, rgba(99, 102, 241, 0.08) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "20px 24px",
          overflow: "hidden",
          boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            {/* Bullseye Icon Badge */}
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--good)",
                fontSize: "1.3rem",
                flexShrink: 0,
              }}
            >
              🎯
            </div>

            <div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                YOUR FOCUS
              </span>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px", color: "var(--text-primary)" }}>
                {focusArea}
              </h2>

              {/* Profile Academic Metadata Strip */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  💻 <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{student.branch || "Engineering"}</strong>
                </span>
                <span>•</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  📊 <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{Number.parseFloat(student.cgpa || "0").toFixed(2)} CGPA</strong>
                </span>
                <span>•</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  🎓 <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{student.batch_year || 2027}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "16px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            fontSize: "0.84rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>💡</span>
          <span>{focusNote}</span>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. METRIC KPI CARDS (Real Data Sourced from Backend)           */}
      {/* ------------------------------------------------------------- */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Card 1: Matches */}
        <Link href="/opportunities" style={{ textDecoration: "none", color: "inherit" }}>
          <article
            className="panel"
            style={{
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--good)",
                }}
              >
                💼
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--muted)" }}>
                MATCHES
              </span>
            </div>

            <div style={{ marginTop: "14px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {matchedJobs.length}
              </div>
              <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "var(--good)", fontWeight: 600 }}>
                🟢 {dashboardSummary.newJobsToday > 0 ? `${dashboardSummary.newJobsToday} new today` : "Active matched roles"}
              </div>
            </div>
          </article>
        </Link>

        {/* Card 2: Saved */}
        <Link href="/opportunities" style={{ textDecoration: "none", color: "inherit" }}>
          <article
            className="panel"
            style={{
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(168, 85, 247, 0.12)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a855f7",
                }}
              >
                ⭐
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--muted)" }}>
                SAVED
              </span>
            </div>

            <div style={{ marginTop: "14px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {bookmarkedCount}
              </div>
              <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "#c084fc", fontWeight: 600 }}>
                {strongMatchesSavedCount > 0 ? `${strongMatchesSavedCount} strong matches` : "Bookmarked pipeline"}
              </div>
            </div>
          </article>
        </Link>

        {/* Card 3: Applications */}
        <Link href="/opportunities" style={{ textDecoration: "none", color: "inherit" }}>
          <article
            className="panel"
            style={{
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#60a5fa",
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--muted)" }}>
                APPLICATIONS
              </span>
            </div>

            <div style={{ marginTop: "14px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {appliedCount}
              </div>
              <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "#60a5fa", fontWeight: 600 }}>
                {appliedCount > 0 ? "Applications submitted" : "No applications yet"}
              </div>
            </div>
          </article>
        </Link>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. RECOMMENDED FOR YOU (Horizontal High-Fit Job Cards)         */}
      {/* ------------------------------------------------------------- */}
      <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            Recommended for You
          </h2>
          <Link
            href="/opportunities"
            style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}
          >
            View all →
          </Link>
        </div>

        {topRecommendations.length === 0 ? (
          <div className="panel" style={{ padding: "36px 20px", textAlign: "center" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px" }}>No scored recommendations yet</h3>
            <p style={{ color: "var(--muted)", margin: "0 auto 16px", maxWidth: "420px", fontSize: "0.85rem" }}>
              Explore the full database in Opportunities to score and match open roles against your profile.
            </p>
            <Link href="/opportunities" className="primary-link" style={{ fontSize: "0.82rem", padding: "6px 16px" }}>
              Explore Opportunities →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {topRecommendations.map((job) => {
              const actualJobId = job.job_id || job.id;
              const actualTitle = job.title || job.role || "Role";
              const actualUrl = job.url || job.apply_url || "#";
              const isSaved = !!job.is_saved;
              const scoreVal = typeof (job.match_score ?? job.matchScore) === "number" ? Math.round(job.match_score ?? job.matchScore!) : null;
              const strengths = Array.isArray(job.strengths) ? job.strengths : [];
              const gaps = (Array.isArray(job.missing_skills) && job.missing_skills.length > 0)
                ? job.missing_skills
                : (Array.isArray(job.missingSkills) && job.missingSkills.length > 0)
                  ? job.missingSkills
                  : [];

              return (
                <article
                  key={actualJobId}
                  className="panel"
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
                    borderRadius: "12px",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  {/* Left: Logo & Job Details */}
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flex: "1 1 380px" }}>
                    <CompanyLogo name={job.company_name} size={46} />

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--accent)",
                        }}
                      >
                        {job.company_name}
                      </span>

                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                        {actualTitle}
                      </h3>

                      {/* Location & Type Strip */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--muted)", marginTop: "2px" }}>
                        <span>📍 {job.location || "Location not listed"}</span>
                        <span>•</span>
                        <span>💼 Full-time</span>
                        <span>•</span>
                        <span>🎓 Early Career</span>
                      </div>

                      {/* Criteria Tags (Strengths + Gaps) */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                        {strengths.slice(0, 3).map((s) => (
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
                        {gaps.length > 0 ? (
                          gaps.slice(0, 2).map((g) => (
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
                          ))
                        ) : scoreVal !== null && scoreVal < 90 ? (
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
                        ) : null}
                      </div>


                    </div>
                  </div>

                  {/* Right: Score Capsule & Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "10px",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {scoreVal !== null && (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "999px",
                          background: scoreVal >= 60 ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          border: `1px solid ${scoreVal >= 60 ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)"}`,
                          color: scoreVal >= 60 ? "var(--good)" : "var(--warn)",
                        }}
                      >
                        {scoreVal >= 60 ? "🟢" : "🟡"} {scoreVal}% Match
                      </span>
                    )}

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {/* Star Bookmark Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleSave(actualJobId, isSaved)}
                        disabled={savingJobId === actualJobId}
                        title={isSaved ? "Saved" : "Save role"}
                        style={{
                          background: isSaved ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.05)",
                          border: `1px solid ${isSaved ? "rgba(245, 158, 11, 0.4)" : "var(--line)"}`,
                          color: isSaved ? "#f59e0b" : "var(--muted)",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isSaved ? "⭐ Saved" : "☆ Save"}
                      </button>

                      {/* Primary View Job CTA */}
                      <a
                        href={actualUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleOpenJob(actualJobId)}
                        className="primary-link"
                        style={{
                          fontSize: "0.82rem",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          background: "var(--good)",
                          color: "#022c22",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        View Job →
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. NEXT STEPS (Interactive Action Strip)                       */}
      {/* ------------------------------------------------------------- */}
      <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
          Next Steps
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
          }}
        >
          {/* Action 1: Complete Skills */}
          <Link href="/profile" style={{ textDecoration: "none", color: "inherit" }}>
            <div
              className="panel"
              style={{
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: "100%",
                borderRadius: "12px",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(168, 85, 247, 0.12)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#c084fc",
                    fontSize: "1.05rem",
                  }}
                >
                  📄
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700 }}>Complete your skills</h4>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.76rem" }}>
                    {profileCompleteness < 100 ? `${profileCompleteness}% complete • Add skills` : "Skills up to date"}
                  </p>
                </div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>→</span>
            </div>
          </Link>

          {/* Action 2: Review New Matches */}
          <Link href="/opportunities" style={{ textDecoration: "none", color: "inherit" }}>
            <div
              className="panel"
              style={{
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: "100%",
                borderRadius: "12px",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--good)",
                    fontSize: "1.05rem",
                  }}
                >
                  🔍
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700 }}>Review new matches</h4>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.76rem" }}>
                    {matchedJobs.length > 0 ? `${matchedJobs.length} opportunities match profile` : "Explore fresh openings"}
                  </p>
                </div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>→</span>
            </div>
          </Link>

          {/* Action 3: Track Applications */}
          <Link href="/opportunities" style={{ textDecoration: "none", color: "inherit" }}>
            <div
              className="panel"
              style={{
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: "100%",
                borderRadius: "12px",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(59, 130, 246, 0.12)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#60a5fa",
                    fontSize: "1.05rem",
                  }}
                >
                  ✓
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700 }}>Track applications</h4>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.76rem" }}>
                    {appliedCount > 0 ? `${appliedCount} application${appliedCount > 1 ? "s" : ""} in pipeline` : "Manage saved pipeline"}
                  </p>
                </div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>→</span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
