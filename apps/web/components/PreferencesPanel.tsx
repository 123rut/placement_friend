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
    <article className="panel">
      <div className="panel-header">
        <div>
          <div className="section-label">Watchlist routing</div>
          <h2>How CareerPilot should notify you</h2>
        </div>
      </div>

      <p className="panel-note">
        Choose where signals from tracked companies should land while the ATS registry keeps refreshing in the background.
      </p>

      {targets.length === 0 ? (
        <p className="panel-note">No tracked companies yet. Build your watchlist first, then this panel becomes your alert router.</p>
      ) : (
        <div className="preferences-grid">
          {targets.map((target) => (
            <div key={target.company_id} className="preference-card">
              <div>
                <strong>{target.name}</strong>
                <div className="preference-meta">{target.category.replace("-", " ")}</div>
              </div>

              <div className="preference-toggle-row">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={target.notify_dashboard}
                    disabled={updatingId === `${target.company_id}-dashboard`}
                    onChange={() => handleToggle(target.company_id, "dashboard", target.notify_dashboard)}
                  />
                  <span>Dashboard</span>
                </label>

                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={target.notify_email}
                    disabled={updatingId === `${target.company_id}-email`}
                    onChange={() => handleToggle(target.company_id, "email", target.notify_email)}
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
