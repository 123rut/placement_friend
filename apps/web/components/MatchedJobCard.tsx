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
  viewed_at?: string | null;
  applied_at?: string | null;
}

interface MatchedJobCardProps {
  job: MatchedJobData;
  onStatusChange?: (jobId: string, newStatus: OpportunityStatus, appliedAt?: string) => void;
  onDismiss?: (jobId: string) => void;
}

export default function MatchedJobCard({ job, onStatusChange, onDismiss }: MatchedJobCardProps) {
  const actualJobId = job.job_id || job.id;
  const [currentStatus, setCurrentStatus] = useState<OpportunityStatus>(
    job.status || "NOT_VIEWED"
  );
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
    if (job.applied_at) {
      setAppliedAtDate(job.applied_at);
    }
  }, [job.status, job.applied_at]);

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

  const handleMarkApplied = async (e: React.MouseEvent) => {
    e.preventDefault();
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

  return (
    <article
      className="panel opportunity-card matched-job-card"
      style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      <div>
        <div className="opportunity-topline">
          <div>
            <span className="section-label accent-label">{job.company_name}</span>
            <h3 className="opportunity-title">{job.title}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {currentStatus === "APPLIED" ? (
              <span className="pill status-good">✓ Applied</span>
            ) : currentStatus === "VIEWED" ? (
              <span className="pill status-info">👁 Viewed</span>
            ) : (
              <span className="pill status-gray">○ Not Viewed</span>
            )}
            <span className="status-good" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
              {job.match_score ? `${Math.round(job.match_score)}% Fit` : "Strong Fit"}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              title="Dismiss this job from your feed"
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#ef4444",
                borderRadius: "999px",
                padding: "2px 8px",
                fontSize: "0.72rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontWeight: 500,
                transition: "all 0.15s ease",
              }}
            >
              ✕ Dismiss
            </button>
          </div>
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
            <strong
              title={(job.missing_skills || []).join(", ")}
              style={{ color: job.missing_skills && job.missing_skills.length > 0 ? "var(--warn)" : "var(--muted)" }}
            >
              {job.missing_skills && job.missing_skills.length > 0
                ? job.missing_skills.slice(0, 2).join(", ")
                : "No major gaps"}
            </strong>
          </div>
        </div>
      </div>

      <div className="opportunity-footer" style={{ marginTop: "18px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpenRole}
            className="primary-link"
            style={{ flex: 1, justifyContent: "center" }}
          >
            {currentStatus === "APPLIED" ? "View Posting" : "Open Role"}
          </a>
          {currentStatus === "VIEWED" && (
            <button
              type="button"
              onClick={handleMarkApplied}
              disabled={markingApplied}
              className="action-btn"
              title="Confirm you submitted an application"
              style={{
                fontSize: "0.82rem",
                padding: "6px 12px",
                whiteSpace: "nowrap",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              {markingApplied ? "Saving..." : "✓ Mark as Applied"}
            </button>
          )}
        </div>

        {currentStatus === "APPLIED" && (
          <div style={{ fontSize: "0.78rem", color: "var(--good)", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
            <span>✓ Application recorded</span>
            {appliedAtDate && (
              <span style={{ color: "var(--muted)" }}>
                on {new Date(appliedAtDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
