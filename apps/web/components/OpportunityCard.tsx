import React, { useState, useEffect } from "react";

export type OpportunityStatus = "NOT_VIEWED" | "VIEWED" | "APPLIED";

export interface OpportunityData {
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

export interface OpportunityScoreDetail {
  jobId: string;
  matchScore: number | null;
  eligible: boolean;
  explanation: string;
  strengths?: string[];
  missingSkills?: string[];
}

interface OpportunityCardProps {
  opportunity: OpportunityData;
  scoreDetail?: OpportunityScoreDetail;
  onScore?: (jobId: string) => void;
  isScoring?: boolean;
  onStatusChange?: (jobId: string, newStatus: OpportunityStatus, appliedAt?: string) => void;
  onDismiss?: (jobId: string) => void;
}

export default function OpportunityCard({
  opportunity,
  scoreDetail,
  onScore,
  isScoring,
  onStatusChange,
  onDismiss,
}: OpportunityCardProps) {

  const [currentStatus, setCurrentStatus] = useState<OpportunityStatus>(
    opportunity.status || "NOT_VIEWED"
  );
  const [appliedAtDate, setAppliedAtDate] = useState<string | null>(
    opportunity.applied_at || null
  );
  const [markingApplied, setMarkingApplied] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dismissing) return;
    setDismissing(true);
    onDismiss?.(opportunity.id);
    try {
      await fetch(`/api/opportunities/${opportunity.id}/dismiss`, { method: "POST" });
    } catch (err) {
      console.error("Failed to dismiss opportunity:", err);
    }
  };

  useEffect(() => {
    if (opportunity.status) {
      setCurrentStatus(opportunity.status);
    }
    if (opportunity.applied_at) {
      setAppliedAtDate(opportunity.applied_at);
    }
  }, [opportunity.status, opportunity.applied_at]);

  const isUrgent = () => {
    if (!opportunity.deadline) return false;
    const diffTime = new Date(opportunity.deadline).getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  };

  const getDeadlineText = () => {
    if (!opportunity.deadline) return "Rolling";
    const date = new Date(opportunity.deadline);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formattedType = opportunity.role_type.charAt(0).toUpperCase() + opportunity.role_type.slice(1);

  const handleOpenRole = () => {
    // Only transition from NOT_VIEWED to VIEWED (never downgrade APPLIED)
    if (currentStatus === "NOT_VIEWED") {
      setCurrentStatus("VIEWED");
      onStatusChange?.(opportunity.id, "VIEWED");
      fetch(`/api/opportunities/${opportunity.id}/view`, {
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
    onStatusChange?.(opportunity.id, "APPLIED", nowIso);

    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/apply`, {
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

    const isScored = !!scoreDetail;
  const isEligible = isScored && scoreDetail.eligible !== false && typeof scoreDetail.matchScore === "number";
  const scoreVal = isEligible ? Math.round(scoreDetail.matchScore!) : null;

  return (
    <article
      className="panel opportunity-card"
      style={{
        borderColor: isEligible && scoreVal! >= 80
          ? "rgba(16, 185, 129, 0.4)"
          : isScored && !isEligible
            ? "rgba(239, 68, 68, 0.3)"
            : "var(--line)",
      }}
    >
      <div>
        <div className="opportunity-topline">
          <div>
            <span className="section-label accent-label">{opportunity.company_name}</span>
            <h3 className="opportunity-title">{opportunity.role}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Fit Score Badge or Score Fit action */}
            {isEligible ? (
              <span
                className="status-good"
                style={{
                  padding: "3px 8px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  background: scoreVal! >= 85 ? "rgba(16, 185, 129, 0.2)" : scoreVal! >= 70 ? "rgba(59, 130, 246, 0.2)" : "rgba(245, 158, 11, 0.2)",
                  color: scoreVal! >= 85 ? "var(--good)" : scoreVal! >= 70 ? "#60a5fa" : "var(--warn)",
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
            ) : onScore ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onScore(opportunity.id);
                }}
                disabled={isScoring}
                className="primary-link ghost-link"
                style={{ fontSize: "0.74rem", padding: "2px 8px", minHeight: "26px" }}
              >
                {isScoring ? "Scoring..." : "⚡ Score Fit"}
              </button>
            ) : null}

            {currentStatus === "APPLIED" ? (
              <span className="pill status-good">✓ Applied</span>
            ) : currentStatus === "VIEWED" ? (
              <span className="pill status-info">👁 Viewed</span>
            ) : (
              <span className="pill status-gray">○ Not Viewed</span>
            )}
            <span className="tile-badge">{formattedType}</span>
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

        {/* Explanation Snippet if Scored */}
        {isScored && (
          <p
            style={{
              fontSize: "0.84rem",
              color: isEligible ? "var(--text-secondary)" : "#f87171",
              margin: "10px 0 0",
              lineHeight: 1.4,
              background: isEligible ? "transparent" : "rgba(239, 68, 68, 0.05)",
              padding: isEligible ? 0 : "8px 10px",
              borderRadius: isEligible ? 0 : "var(--radius)",
              border: isEligible ? "none" : "1px solid rgba(239, 68, 68, 0.15)",
            }}
          >
            {scoreDetail.explanation || (isEligible ? "Analyzed against candidate profile." : "Does not match candidate baseline requirements.")}
          </p>
        )}

        <div className="opportunity-metadata" style={{ marginTop: "12px" }}>
          <div className="meta-row">
            <span>Baseline requirement</span>
            <strong>{opportunity.min_cgpa !== null ? `${opportunity.min_cgpa.toFixed(2)} CGPA` : "Open profile"}</strong>
          </div>
          <div className="meta-row">
            <span>Eligible tracks</span>
            <strong title={opportunity.allowed_branches.join(", ")}>
              {opportunity.allowed_branches.length > 0 ? opportunity.allowed_branches.join(", ") : "All branches"}
            </strong>
          </div>
          <div className="meta-row">
            <span>Application window</span>
            <span className={isUrgent() ? "status-warn" : "pill"}>{getDeadlineText()}</span>
          </div>

          {isEligible && scoreDetail.strengths && scoreDetail.strengths.length > 0 && (
            <div className="meta-row">
              <span>Strengths</span>
              <strong style={{ color: "var(--good)" }}>
                {scoreDetail.strengths.slice(0, 2).join(", ")}
              </strong>
            </div>
          )}

          {isEligible && scoreDetail.missingSkills && scoreDetail.missingSkills.length > 0 && (
            <div className="meta-row">
              <span>Skill Gaps</span>
              <strong style={{ color: "var(--warn)" }}>
                {scoreDetail.missingSkills.slice(0, 2).join(", ")}
              </strong>
            </div>
          )}
        </div>
      </div>


      <div className="opportunity-footer">
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a
            href={opportunity.apply_url}
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
          <div style={{ fontSize: "0.78rem", color: "var(--good)", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>✓ Application recorded</span>
            {appliedAtDate && (
              <span style={{ color: "var(--muted)" }}>
                on {new Date(appliedAtDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        )}

        <div className="opportunity-date">
          Surfaced {new Date(opportunity.posted_at).toLocaleDateString()}
        </div>
      </div>
    </article>
  );
}
