import React, { useState } from "react";

export interface CompanyTarget {
  company_id: string;
  name: string;
  category: string;
  notify_email: boolean;
  notify_dashboard: boolean;
}

interface PreferencesPanelProps {
  initialTargets: CompanyTarget[];
  onRefresh: () => void;
}

export default function PreferencesPanel({ initialTargets, onRefresh }: PreferencesPanelProps) {
  const [targets, setTargets] = useState<CompanyTarget[]>(initialTargets);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setTargets(initialTargets);
  }, [initialTargets]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggle = async (
    companyId: string,
    channel: "email" | "dashboard",
    currentVal: boolean,
  ) => {
    setUpdatingId(`${companyId}-${channel}`);
    const updatedTargets = targets.map((target) => {
      if (target.company_id === companyId) {
        return {
          ...target,
          [channel === "email" ? "notify_email" : "notify_dashboard"]: !currentVal,
        };
      }
      return target;
    });

    setTargets(updatedTargets);

    try {
      const target = updatedTargets.find((item) => item.company_id === companyId);
      if (!target) return;

      const res = await fetch("/api/students/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          notify_email: target.notify_email,
          notify_dashboard: target.notify_dashboard,
        }),
      });

      if (!res.ok) {
        setTargets(targets);
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
      setTargets(targets);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <article className="panel" id="notifications-section">
      <div className="panel-header">
        <div>
          <div className="section-label">Notification Preferences</div>
          <h2>How CareerPilot should notify you</h2>
        </div>
      </div>

      <p className="panel-note">
        Choose where signals from tracked companies should land while the ATS registry keeps refreshing in the background.
      </p>

      {targets.length === 0 ? (
        <p className="panel-note">No tracked companies yet. Build your watchlist first, then this panel becomes your alert router.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
          {targets.map((target) => {
            const isExpanded = !!expandedIds[target.company_id];
            return (
              <div 
                key={target.company_id} 
                style={{ 
                  border: "1px solid var(--line)", 
                  borderRadius: "var(--radius)",
                  background: "var(--surface-muted)",
                  overflow: "hidden"
                }}
              >
                {/* Accordion Trigger */}
                <button
                  type="button"
                  onClick={() => toggleExpand(target.company_id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--text)"
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem" }}>{target.name}</strong>
                    <span 
                      style={{ 
                        marginLeft: "10px", 
                        fontSize: "0.75rem", 
                        color: "var(--muted)",
                        background: "var(--surface)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid var(--line)"
                      }}
                    >
                      {target.category.replace("-", " ")}
                    </span>
                  </div>
                  <span style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▼
                  </span>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div 
                    style={{ 
                      padding: "16px", 
                      background: "var(--surface)", 
                      borderTop: "1px solid var(--line)",
                      display: "flex",
                      gap: "24px"
                    }}
                  >
                    <label className="toggle-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={target.notify_dashboard}
                        disabled={updatingId === `${target.company_id}-dashboard`}
                        onChange={() => handleToggle(target.company_id, "dashboard", target.notify_dashboard)}
                        style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                      />
                      <span style={{ fontSize: "0.9rem" }}>Dashboard</span>
                    </label>

                    <label className="toggle-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={target.notify_email}
                        disabled={updatingId === `${target.company_id}-email`}
                        onChange={() => handleToggle(target.company_id, "email", target.notify_email)}
                        style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                      />
                      <span style={{ fontSize: "0.9rem" }}>Email</span>
                    </label>

                    <label className="toggle-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "not-allowed", opacity: 0.5 }}>
                      <input
                        type="checkbox"
                        checked={false}
                        disabled={true}
                        style={{ cursor: "not-allowed", width: "16px", height: "16px" }}
                      />
                      <span style={{ fontSize: "0.9rem" }}>Slack (Unavailable)</span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
