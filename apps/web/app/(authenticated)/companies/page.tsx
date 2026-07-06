"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  careersUrl: string | null;
  status: "active" | "url_missing" | "url_stale" | "requires_auth" | "paused" | "archived";
  fail_count: number;
  silent_fail_count: number;
  last_scraped_at: string | null;
  last_checked_at: string | null;
  last_failure_reason: string | null;
  opportunities_found_last_run: number;
  url_confirmed_by_user: boolean;
  previous_careers_url: string | null;
  region: string;
  added_by: string;
}

interface Metadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Add Company Form State
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newRegion, setNewRegion] = useState("IN");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: "success" | "warn" | "error"; text: string; action?: React.ReactNode } | null>(null);

  // Edit URL Inline State
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [inlineAlert, setInlineAlert] = useState<{ companyId: string; type: "warn" | "error"; text: string; action?: React.ReactNode } | null>(null);

  // Polling State Ref
  const isFastPolling = useRef(false);
  const fastPollEndTime = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Companies
  const fetchCompanies = async (currentPage = page, currentSearch = search, currentStatus = statusFilter) => {
    try {
      const query = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        search: currentSearch,
        status: currentStatus
      });
      const res = await fetch(`/api/companies?${query}`);
      if (res.ok) {
        const result = await res.json();
        setCompanies(result.data || []);
        setMetadata(result.metadata || { total: 0, page: 1, limit: 10, totalPages: 1 });
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setLoading(false);
    }
  };

  // Setup Polling Scheduler
  useEffect(() => {
    const runPoll = () => {
      // Pause polling if document tab is hidden to save client resources
      if (document.visibilityState === "hidden") {
        return;
      }
      
      fetchCompanies(page, search, statusFilter);

      // Check if fast polling has expired
      if (isFastPolling.current && Date.now() > fastPollEndTime.current) {
        console.log("Fast polling cycle ended. Reverting to standard interval.");
        isFastPolling.current = false;
        setupInterval(60000); // Back to 60 seconds
      }
    };

    const setupInterval = (ms: number) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      pollIntervalRef.current = setInterval(runPoll, ms);
    };

    // Run immediately on initial load/refreshes
    fetchCompanies(page, search, statusFilter);
    setupInterval(isFastPolling.current ? 5000 : 60000);

    // Visibility tab focus changes handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runPoll(); // Instant poll on focus
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [page, search, statusFilter]);

  // Trigger Fast Polling (5s intervals for 60s) after updates
  const startFastPolling = () => {
    console.log("Saving detected. Triggering 5s fast polling interval.");
    isFastPolling.current = true;
    fastPollEndTime.current = Date.now() + 60000; // 60 seconds from now
    fetchCompanies(page, search, statusFilter);
    // Restart interval to execute fast poll
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCompanies(page, search, statusFilter);
      }
      if (Date.now() > fastPollEndTime.current) {
        isFastPolling.current = false;
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = setInterval(() => {
          if (document.visibilityState === "visible") fetchCompanies(page, search, statusFilter);
        }, 60000);
      }
    }, 5000);
  };

  // Add Company Submit
  const handleAddCompanySubmit = async (confirmOverride = false) => {
    setFormAlert(null);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          careersUrl: newUrl,
          region: newRegion,
          confirmOverride
        })
      });

      const data = await res.json();

      if (res.status === 201) {
        setFormAlert({ type: "success", text: `"${data.name}" successfully added!` });
        setNewName("");
        setNewUrl("");
        setNewRegion("IN");
        setTimeout(() => setShowAddForm(false), 2000);
        startFastPolling();
      } else if (data.conflict === "name_match") {
        setFormAlert({
          type: "error",
          text: `Conflict: Company matching name "${data.match.name}" already exists with URL: ${data.match.careersUrl || "None"}.`
        });
      } else if (data.conflict === "possible_match") {
        setFormAlert({
          type: "warn",
          text: `Warning: A similar company "${data.match.name}" already exists.`,
          action: (
            <button className="btn-toggle" onClick={() => handleAddCompanySubmit(true)}>
              Dismiss Warning & Add
            </button>
          )
        });
      } else if (data.conflict === "duplicate_url") {
        setFormAlert({
          type: "error",
          text: `Conflict: URL is already registered under company "${data.existingCompany.name}".`
        });
      } else if (data.warning === "not_careers_page") {
        setFormAlert({
          type: "warn",
          text: `Warning: Provided URL does not seem to contain careers or openings keyword paths.`,
          action: (
            <button className="btn-toggle" onClick={() => handleAddCompanySubmit(true)}>
              Confirm & Add Anyway
            </button>
          )
        });
      } else if (res.status === 422) {
        setFormAlert({ type: "error", text: `Error: ${data.message}` });
      } else {
        setFormAlert({ type: "error", text: data.message || "Failed to add company." });
      }
    } catch (err) {
      setFormAlert({ type: "error", text: "Server connection failed." });
    }
  };

  // Save Inline URL Updates
  const handleSaveUrl = async (companyId: string, confirmOverride = false) => {
    setInlineAlert(null);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          careersUrl: editingUrl,
          confirmOverride
        })
      });

      const data = await res.json();

      if (res.ok && !data.warning && !data.conflict) {
        setEditingCompanyId(null);
        startFastPolling();
      } else if (data.conflict === "duplicate_url") {
        setInlineAlert({
          companyId,
          type: "error",
          text: `URL is already used by "${data.existingCompany.name}".`
        });
      } else if (data.warning === "ats_detected") {
        setInlineAlert({
          companyId,
          type: "warn",
          text: `ATS redirect detected (${data.atsProvider}). We recommend using the board URL.`,
          action: (
            <button
              className="btn-toggle"
              onClick={() => {
                setEditingUrl(data.suggestedUrl);
                handleSaveUrl(companyId, true);
              }}
            >
              Update to Recommended URL
            </button>
          )
        });
      } else if (data.warning === "cross_domain_redirect") {
        setInlineAlert({
          companyId,
          type: "warn",
          text: `Redirects to different domain: "${data.finalUrl}".`,
          action: (
            <button className="btn-toggle" onClick={() => handleSaveUrl(companyId, true)}>
              Confirm & Use Final URL
            </button>
          )
        });
      } else if (data.warning === "not_careers_page") {
        setInlineAlert({
          companyId,
          type: "warn",
          text: "URL looks like a general page instead of careers list.",
          action: (
            <button className="btn-toggle" onClick={() => handleSaveUrl(companyId, true)}>
              Confirm & Save Anyway
            </button>
          )
        });
      } else {
        setInlineAlert({
          companyId,
          type: "error",
          text: data.message || "Invalid careers URL."
        });
      }
    } catch (err) {
      setInlineAlert({ companyId, type: "error", text: "Network connection failure." });
    }
  };

  // Quick Action: Pause / Resume Scrape
  const handleToggleStatus = async (company: Company) => {
    const targetStatus = company.status === "paused" ? "active" : "paused";
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus })
      });
      if (res.ok) {
        fetchCompanies(page, search, statusFilter);
      }
    } catch (err) {
      console.error("Toggle status failed:", err);
    }
  };

  // Quick Action: Archive Company (Soft Delete)
  const handleArchiveCompany = async (id: string) => {
    if (!confirm("Are you sure you want to archive this company? Archived targets are excluded from active crawls.")) return;
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchCompanies(page, search, statusFilter);
      }
    } catch (err) {
      console.error("Archive failed:", err);
    }
  };

  // Quick Action: Restore Archived
  const handleRestoreCompany = async (id: string) => {
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" })
      });
      if (res.ok) {
        fetchCompanies(page, search, statusFilter);
      }
    } catch (err) {
      console.error("Restore failed:", err);
    }
  };

  const getStatusBadge = (status: Company["status"]) => {
    switch (status) {
      case "active":
        return <span className="status-good">Active</span>;
      case "url_missing":
        return <span className="status-warn">URL Missing</span>;
      case "url_stale":
        return <span className="status-error">URL Stale</span>;
      case "requires_auth":
        return <span className="status-gray">Login Required</span>;
      case "paused":
        return <span className="status-info">Paused</span>;
      case "archived":
        return <span className="status-gray" style={{ background: "#e5e7eb", color: "#4b5563" }}>Archived</span>;
      default:
        return <span className="pill">{status}</span>;
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="topbar-kicker">CareerPilot Registry</span>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0" }}>ATS Company Watchlist</h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.9rem" }}>
            Add, update, and manage careers page tracking targets in the crawl index.
          </p>
        </div>
        <nav className="topbar-actions">
          <button className="primary-link" style={{ border: "none" }} onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? "Close Form" : "+ Add Company"}
          </button>
        </nav>
      </header>

      {/* Add Company Form Panel */}
      {showAddForm && (
        <section className="workspace-section">
          <div className="panel" style={{ maxWidth: "600px", margin: "0 auto" }}>
            <div className="panel-header">
              <h2>Add New Target Company</h2>
            </div>
            
            {formAlert && (
              <div className={`alert-box alert-box-${formAlert.type}`}>
                {formAlert.text} {formAlert.action}
              </div>
            )}

            <div className="form-grid" style={{ gridTemplateColumns: "1fr", gap: "16px" }}>
              <div className="field">
                <span>Company Name *</span>
                <input
                  type="text"
                  placeholder="e.g. Stripe, Airbnb"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="field">
                <span>Careers URL (Optional)</span>
                <input
                  type="url"
                  placeholder="https://company.com/careers"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
                {!newUrl && <p className="panel-note" style={{ fontSize: "0.82rem" }}>No URL provided? The agent will search DuckDuckGo to discover it automatically.</p>}
              </div>

              <div className="field">
                <span>Target Region</span>
                <select value={newRegion} onChange={(e) => setNewRegion(e.target.value)}>
                  <option value="IN">India (IN)</option>
                  <option value="US">United States (US)</option>
                  <option value="GLOBAL">Global / Other</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button className="primary-link" style={{ border: "none", flex: 1 }} onClick={() => handleAddCompanySubmit(false)}>
                  Validate & Save
                </button>
                <button
                  className="primary-link ghost-link"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowAddForm(false);
                    setFormAlert(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search & Filters */}
      <section className="workspace-section">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          <div className="field" style={{ minWidth: "300px" }}>
            <input
              type="text"
              placeholder="Search companies by name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ minHeight: "40px", background: "var(--surface)", border: "1px solid var(--line)" }}
            />
          </div>

          <div className="filter-row">
            <button className={`filter-chip ${statusFilter === "" ? "active" : ""}`} onClick={() => { setStatusFilter(""); setPage(1); }}>
              All Active Crawls
            </button>
            <button className={`filter-chip ${statusFilter === "url_missing" ? "active" : ""}`} onClick={() => { setStatusFilter("url_missing"); setPage(1); }}>
              Missing URL
            </button>
            <button className={`filter-chip ${statusFilter === "url_stale" ? "active" : ""}`} onClick={() => { setStatusFilter("url_stale"); setPage(1); }}>
              Stale
            </button>
            <button className={`filter-chip ${statusFilter === "requires_auth" ? "active" : ""}`} onClick={() => { setStatusFilter("requires_auth"); setPage(1); }}>
              Auth Blocked
            </button>
            <button className={`filter-chip ${statusFilter === "paused" ? "active" : ""}`} onClick={() => { setStatusFilter("paused"); setPage(1); }}>
              Paused
            </button>
            <button className={`filter-chip ${statusFilter === "archived" ? "active" : ""}`} onClick={() => { setStatusFilter("archived"); setPage(1); }}>
              Archived
            </button>
          </div>
        </div>

        {isFastPolling.current && (
          <div className="alert-box alert-box-info" style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚡ Scraper pipeline updating live. Running fast checks every 5 seconds...</span>
            <span className="pill" style={{ minHeight: "auto", padding: "2px 8px" }}>Live Sync</span>
          </div>
        )}

        {/* Table View */}
        {loading ? (
          <p style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>Loading scraping directory...</p>
        ) : companies.length === 0 ? (
          <p style={{ textAlign: "center", padding: "40px", color: "var(--muted)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--line)", marginTop: "16px" }}>
            No companies match selected filter criteria.
          </p>
        ) : (
          <div className="table-container">
            <table className="interactive-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Careers URL / Inline Edit</th>
                  <th>Status</th>
                  <th>Region</th>
                  <th>Observability Metrics</th>
                  <th>Control Action</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const isEditing = editingCompanyId === company.id;
                  const hasInlineAlert = inlineAlert?.companyId === company.id;

                  return (
                    <tr key={company.id}>
                      <td style={{ fontWeight: 600 }}>
                        {company.name}
                        <div style={{ fontSize: "0.78rem", fontWeight: "normal", color: "var(--muted)", marginTop: "4px" }}>
                          Slug: <code>{company.id}</code>
                        </div>
                      </td>
                      <td style={{ maxWidth: "320px" }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: "6px" }}>
                            <input
                              className="inline-edit-input"
                              type="url"
                              value={editingUrl}
                              onChange={(e) => setEditingUrl(e.target.value)}
                            />
                            {hasInlineAlert && (
                              <div className={`alert-box alert-box-${inlineAlert.type}`} style={{ padding: "6px 10px", margin: 0, fontSize: "0.8rem" }}>
                                {inlineAlert.text} {inlineAlert.action}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button className="action-btn" style={{ padding: "4px 8px" }} onClick={() => handleSaveUrl(company.id, false)}>
                                Save URL
                              </button>
                              <button
                                className="action-btn"
                                style={{ padding: "4px 8px", background: "none", color: "var(--muted)" }}
                                onClick={() => {
                                  setEditingCompanyId(null);
                                  setInlineAlert(null);
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {company.careersUrl ? (
                              <a
                                href={company.careersUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ textDecoration: "underline", color: "var(--accent)", wordBreak: "break-all" }}
                              >
                                {company.careersUrl}
                              </a>
                            ) : (
                              <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No careers URL saved</span>
                            )}
                            {company.status !== "archived" && (
                              <button
                                className="btn-icon"
                                onClick={() => {
                                  setEditingCompanyId(company.id);
                                  setEditingUrl(company.careersUrl || "");
                                  setInlineAlert(null);
                                }}
                                title="Edit URL"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        )}
                        
                        {company.status === "url_stale" && company.last_failure_reason && (
                          <div style={{ fontSize: "0.78rem", color: "var(--warn)", marginTop: "6px", background: "var(--warn-soft)", padding: "4px 8px", borderRadius: "4px" }}>
                            ⚠️ Failure: {company.last_failure_reason} (attempts: {company.fail_count})
                          </div>
                        )}
                      </td>
                      <td>{getStatusBadge(company.status)}</td>
                      <td>
                        <span className="pill" style={{ minHeight: "26px", padding: "2px 8px" }}>{company.region}</span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        <div>Last Checked: {company.last_checked_at ? new Date(company.last_checked_at).toLocaleTimeString() : "Never"}</div>
                        <div>Last Scraped: {company.last_scraped_at ? new Date(company.last_scraped_at).toLocaleDateString() : "Never"}</div>
                        <div>Found Last Run: <strong>{company.opportunities_found_last_run}</strong></div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {company.status === "archived" ? (
                            <>
                              <button className="action-btn" onClick={() => handleRestoreCompany(company.id)}>
                                Restore
                              </button>
                            </>
                          ) : (
                            <>
                              {company.status === "requires_auth" && (
                                <button
                                  className="action-btn"
                                  onClick={async () => {
                                    if (company.careersUrl) {
                                      navigator.clipboard.writeText(company.careersUrl);
                                      alert("URL copied to clipboard.");
                                    }
                                  }}
                                >
                                  Copy URL
                                </button>
                              )}
                              {company.status === "requires_auth" && (
                                <button
                                  className="action-btn"
                                  style={{ background: "var(--good-soft)", color: "var(--good)", borderColor: "var(--good)" }}
                                  onClick={() => handleRestoreCompany(company.id)}
                                >
                                  Mark Resolved
                                </button>
                              )}
                              
                              {company.status !== "requires_auth" && (
                                <button className="action-btn" onClick={() => handleToggleStatus(company)}>
                                  {company.status === "paused" ? "Resume" : "Pause"}
                                </button>
                              )}

                              <button className="action-btn-danger" onClick={() => handleArchiveCompany(company.id)}>
                                Archive
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination-bar">
              <span style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
                Showing page <strong>{metadata.page}</strong> of <strong>{metadata.totalPages}</strong> ({metadata.total} companies total)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="action-btn"
                  disabled={metadata.page <= 1}
                  onClick={() => setPage(metadata.page - 1)}
                  style={{ opacity: metadata.page <= 1 ? 0.5 : 1, cursor: metadata.page <= 1 ? "not-allowed" : "pointer" }}
                >
                  Previous
                </button>
                <button
                  className="action-btn"
                  disabled={metadata.page >= metadata.totalPages}
                  onClick={() => setPage(metadata.page + 1)}
                  style={{ opacity: metadata.page >= metadata.totalPages ? 0.5 : 1, cursor: metadata.page >= metadata.totalPages ? "not-allowed" : "pointer" }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
