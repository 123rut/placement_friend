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

  React.useEffect(() => {
    setTargets(initialTargets);
  }, [initialTargets]);

  const handleToggle = async (
    companyId: string,
    channel: "email" | "dashboard",
    currentVal: boolean
  ) => {
    setUpdatingId(`${companyId}-${channel}`);
    const updatedTargets = targets.map(t => {
      if (t.company_id === companyId) {
        return {
          ...t,
          [channel === "email" ? "notify_email" : "notify_dashboard"]: !currentVal
        };
      }
      return t;
    });

    // Optimistically update
    setTargets(updatedTargets);

    try {
      const target = updatedTargets.find(t => t.company_id === companyId);
      if (!target) return;

      const res = await fetch("/api/students/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          notify_email: target.notify_email,
          notify_dashboard: target.notify_dashboard
        })
      });

      if (!res.ok) {
        // Revert on error
        setTargets(targets);
        console.error("Failed to update preference on backend");
      } else {
        onRefresh();
      }
    } catch (err) {
      setTargets(targets);
      console.error("Failed to update preferences:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <div className="section-label">Alerts Configuration</div>
          <h2 style={{ fontSize: "1.25rem", margin: "4px 0 0" }}>Notification Channels</h2>
        </div>
      </div>
      
      <p className="panel-note" style={{ fontSize: "0.86rem", marginBottom: "16px" }}>
        Configure how you want to be alerted when matching opportunities are scraped for your target companies.
      </p>

      {targets.length === 0 ? (
        <p style={{ color: "var(--muted)", fontStyle: "italic", padding: "8px 0" }}>
          You aren't tracking any companies yet. Add targets from your student workspace.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {targets.map(target => (
            <div
              key={target.company_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                background: "var(--surface-muted)"
              }}
            >
              <div>
                <strong style={{ fontSize: "0.92rem", color: "var(--text)" }}>{target.name}</strong>
                <div style={{ fontSize: "0.76rem", color: "var(--muted)", textTransform: "capitalize" }}>
                  Category: {target.category.replace("-", " ")}
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px" }}>
                {/* Dashboard Alert Toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.84rem" }}>
                  <input
                    type="checkbox"
                    checked={target.notify_dashboard}
                    disabled={updatingId === `${target.company_id}-dashboard`}
                    onChange={() => handleToggle(target.company_id, "dashboard", target.notify_dashboard)}
                    style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
                  />
                  <span>Dashboard</span>
                </label>

                {/* Email Alert Toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.84rem" }}>
                  <input
                    type="checkbox"
                    checked={target.notify_email}
                    disabled={updatingId === `${target.company_id}-email`}
                    onChange={() => handleToggle(target.company_id, "email", target.notify_email)}
                    style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
