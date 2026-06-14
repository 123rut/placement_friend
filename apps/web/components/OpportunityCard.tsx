import React from "react";

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
}

interface OpportunityCardProps {
  opportunity: OpportunityData;
}

export default function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const isUrgent = () => {
    if (!opportunity.deadline) return false;
    const diffTime = new Date(opportunity.deadline).getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  };

  const getDeadlineText = () => {
    if (!opportunity.deadline) return "No deadline specified";
    const date = new Date(opportunity.deadline);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formattedType = opportunity.role_type.charAt(0).toUpperCase() + opportunity.role_type.slice(1);

  return (
    <article className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", transition: "all 0.2s ease-in-out" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div>
            <span className="section-label" style={{ fontWeight: 600, color: "var(--accent)" }}>
              {opportunity.company_name}
            </span>
            <h3 style={{ margin: "4px 0 0 0", fontSize: "1.2rem", color: "var(--text)", fontWeight: 700 }}>
              {opportunity.role}
            </h3>
          </div>
          <span className="tile-badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {formattedType}
          </span>
        </div>

        <div style={{ display: "grid", gap: "8px", margin: "16px 0", fontSize: "0.88rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>Min CGPA:</span>
            <strong style={{ color: "var(--text)" }}>{opportunity.min_cgpa !== null ? opportunity.min_cgpa.toFixed(2) : "Open"}</strong>
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>Target Branches:</span>
            <strong style={{ color: "var(--text)", textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={opportunity.allowed_branches.join(", ")}>
              {opportunity.allowed_branches.length > 0 ? opportunity.allowed_branches.join(", ") : "All Branches"}
            </strong>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)" }}>Deadline:</span>
            <span 
              className={isUrgent() ? "status-warn" : "pill"} 
              style={{ 
                minHeight: "auto", 
                padding: "2px 8px", 
                fontSize: "0.78rem",
                background: isUrgent() ? "var(--warn-soft)" : "var(--surface-alt)",
                color: isUrgent() ? "var(--warn)" : "var(--muted)",
                borderRadius: "4px",
                fontWeight: 600
              }}
            >
              {getDeadlineText()}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "12px" }}>
        <a 
          href={opportunity.apply_url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="primary-link"
          style={{ width: "100%", textAlign: "center", border: "none" }}
        >
          Apply Now
        </a>
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "0.74rem", color: "var(--muted)" }}>
          Scraped {new Date(opportunity.posted_at).toLocaleDateString()}
        </div>
      </div>
    </article>
  );
}
