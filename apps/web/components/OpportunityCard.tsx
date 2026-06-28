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
    if (!opportunity.deadline) return "Rolling";
    const date = new Date(opportunity.deadline);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formattedType = opportunity.role_type.charAt(0).toUpperCase() + opportunity.role_type.slice(1);

  return (
    <article className="panel opportunity-card">
      <div>
        <div className="opportunity-topline">
          <div>
            <span className="section-label accent-label">{opportunity.company_name}</span>
            <h3 className="opportunity-title">{opportunity.role}</h3>
          </div>
          <span className="tile-badge">{formattedType}</span>
        </div>

        <div className="opportunity-metadata">
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
        </div>
      </div>

      <div className="opportunity-footer">
        <a href={opportunity.apply_url} target="_blank" rel="noopener noreferrer" className="primary-link">
          Open Role
        </a>
        <div className="opportunity-date">
          Surfaced {new Date(opportunity.posted_at).toLocaleDateString()}
        </div>
      </div>
    </article>
  );
}
