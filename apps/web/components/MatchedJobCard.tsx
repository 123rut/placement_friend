"use client";

import React, { useState, useEffect } from "react";
import { OpportunityStatus } from "./OpportunityCard";

export interface MatchedJobData {
  id: string;
  job_id?: string;
  title: string;
  url: string;
  location: string | null;
  company_name: string;
  match_score: number | null;
  explanation: string | null;
  strengths: string[] | null;
  missing_skills: string[] | null;
  status?: OpportunityStatus;
  is_saved?: boolean;
  saved_at?: string | null;
  viewed_at?: string | null;
  applied_at?: string | null;
}

interface MatchedJobCardProps {
  job: MatchedJobData;
  onStatusChange?: (jobId: string, newStatus: OpportunityStatus, appliedAt?: string) => void;
  onToggleSave?: (jobId: string, isSaved: boolean) => void;
  onDismiss?: (jobId: string) => void;
}

export default function MatchedJobCard({ job, onStatusChange, onToggleSave, onDismiss }: MatchedJobCardProps) {
  const actualJobId = job.job_id || job.id;
  const [currentStatus, setCurrentStatus] = useState<OpportunityStatus>(
    job.status || "NOT_VIEWED"
  );
  const [isSaved, setIsSaved] = useState<boolean>(!!job.is_saved);
  const [isSaving, setIsSaving] = useState(false);
  const [appliedAtDate, setAppliedAtDate] = useState<string | null>(
    job.applied_at || null
  );
  const [markingApplied, setMarkingApplied] = useState(false);
  const [dismissing, setDismissing] = useState(false);


  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dismissing) return;
    setDismissing(true);
    onDismiss?.(actualJobId);
    try {
      await fetch(`/api/opportunities/${actualJobId}/dismiss`, { method: "POST" });
    } catch (err) {
      console.error("Failed to dismiss matched job:", err);
    }
  };

  useEffect(() => {
    if (job.status) {
      setCurrentStatus(job.status);
    }
    if (typeof job.is_saved === "boolean") {
      setIsSaved(job.is_saved);
    }
    if (job.applied_at) {
      setAppliedAtDate(job.applied_at);
    }
  }, [job.status, job.is_saved, job.applied_at]);

  const handleOpenRole = () => {
    if (currentStatus === "NOT_VIEWED") {
      setCurrentStatus("VIEWED");
      onStatusChange?.(actualJobId, "VIEWED");
      fetch(`/api/opportunities/${actualJobId}/view`, {
        method: "POST",
      }).catch((err) => {
        console.error("Failed to record view tracking:", err);
      });
    }
  };

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    onToggleSave?.(actualJobId, nextSaved);
    setIsSaving(true);
    try {
      const endpoint = nextSaved
        ? `/api/opportunities/${actualJobId}/save`
        : `/api/opportunities/${actualJobId}/unsave`;
      await fetch(endpoint, { method: "POST" });
    } catch (err) {
      console.error("Failed to toggle save:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkApplied = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (markingApplied) return;
    setMarkingApplied(true);
    const nowIso = new Date().toISOString();
    setCurrentStatus("APPLIED");
    setAppliedAtDate(nowIso);
    onStatusChange?.(actualJobId, "APPLIED", nowIso);

    try {
      const res = await fetch(`/api/opportunities/${actualJobId}/apply`, {
        method: "POST",
      });
      if (!res.ok) {
        console.error("Failed to mark as applied");
      }
    } catch (err) {
      console.error("Error marking as applied:", err);
    } finally {
      setMarkingApplied(false);
    }
  };

  const scoreVal = typeof job.match_score === "number" ? Math.round(job.match_score) : null;

  return (
    <article
      className="panel opportunity-card matched-job-card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderColor: scoreVal && scoreVal >= 80 ? "rgba(16, 185, 129, 0.35)" : "var(--line)",
      }}
    >
      <div>
        <div className="opportunity-topline">
          <div>
            <span className="section-label accent-label">{job.company_name}</span>
            <h3 className="opportunity-title">{job.title}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {scoreVal !== null && (
              <span
                className="status-good"
                style={{
                  padding: "3px 8px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  background: scoreVal >= 85 ? "rgba(16, 185, 129, 0.2)" : "rgba(59, 130, 246, 0.2)",
                  color: scoreVal >= 85 ? "var(--good)" : "#60a5fa",
                  border: `1px solid ${scoreVal >= 85 ? "rgba(16, 185, 129, 0.4)" : "rgba(59, 130, 246, 0.4)"}`,
                  borderRadius: "999px",
                }}
              >
                🟢 {scoreVal}% Fit
              </span>
            )}

            {/* Bookmark Star Toggle Button */}
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={isSaving}
              title={isSaved ? "Remove from saved jobs" : "Save this job to your pipeline"}
              style={{
                background: isSaved ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${isSaved ? "rgba(245, 158, 11, 0.4)" : "var(--line)"}`,
                color: isSaved ? "#f59e0b" : "var(--muted)",
                borderRadius: "999px",
                padding: "2px 8px",
                fontSize: "0.74rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              {isSaved ? "⭐ Saved" : "☆ Save"}
            </button>

            {currentStatus === "APPLIED" && (
              <span className="pill status-good" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                ✓ Applied
              </span>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              title="Remove this job from your recommendations"
              className="danger-action-btn"
              style={{
                borderRadius: "8px",
                padding: "3px 8px",
                fontSize: "0.74rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}
            >
              🚫 Not Interested
            </button>

          </div>
        </div>


        {/* Location & Employment Strip */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--muted)", marginTop: "8px" }}>
          <span>📍 {job.location || "Location not listed"}</span>
          <span>•</span>
          <span>💼 Full-time</span>
          <span>•</span>
          <span>🎓 Early Career</span>
        </div>

        {/* Criteria Skill Tags: Strengths & Gaps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          {/* Matched Strengths */}
          {Array.isArray(job.strengths) && job.strengths.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginRight: "2px" }}>
                Strengths:
              </span>
              {job.strengths.slice(0, 4).map((s) => (
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

          {/* Gaps: Displayed if score < 90% or if specific missing skills are detected */}
          {Array.isArray(job.missing_skills) && job.missing_skills.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginRight: "2px" }}>
                Gaps:
              </span>
              {job.missing_skills.slice(0, 3).map((g) => (
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
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginRight: "2px" }}>
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
                ○ {scoreVal < 60 ? "Specialized domain experience & depth" : scoreVal < 75 ? "Advanced domain tooling & systems" : "Project depth in production environment"}
              </span>
            </div>
          ) : null}
        </div>
      </div>




      <div className="opportunity-footer" style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpenRole}
            className="primary-link"
            style={{ flex: 1, justifyContent: "center", fontSize: "0.85rem", height: "36px" }}
          >
            View Job →
          </a>

          {currentStatus !== "APPLIED" ? (
            <button
              type="button"
              onClick={handleMarkApplied}
              disabled={markingApplied}
              title="Track this application in your pipeline"
              style={{
                fontSize: "0.8rem",
                padding: "0 12px",
                height: "36px",
                whiteSpace: "nowrap",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--line)",
                color: "var(--text-secondary)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              {markingApplied ? "Saving..." : "+ Mark Applied"}
            </button>
          ) : (
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "var(--good)",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "0 12px",
                height: "36px",
                borderRadius: "8px",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ✓ Applied
            </div>
          )}

        </div>
      </div>
    </article>
  );
}

