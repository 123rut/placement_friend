"use client";

import { useEffect, useState, useMemo, useRef } from "react";

interface ParsedProfile {
  id?: string;
  skills?: string[];
  experience?: Array<{ role?: string; company?: string }>;
  education?: Array<{ degree?: string; college?: string }>;
  projects?: Array<{ name?: string }>;
  error?: string;
}

interface AgentReply {
  reply?: string;
  conversationId?: string;
  error?: string;
}

interface JobSearchResult {
  id: string;
  title: string;
  location: string | null;
  remote: boolean;
  employment_type: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  url: string;
  posted_at: string | null;
  company_name: string;
  industry?: string | null;
  similarity_score?: number | null;
}

interface JobMatchResult {
  jobId: string;
  jobTitle: string;
  company: string;
  eligible?: boolean;
  matchScore: number | null;
  vectorSimilarity: number | null;
  explanation: string;
  strengths: string[];
  missingSkills: string[];
  applyUrl: string;
  error?: string;
}

interface SyncResultSummary {
  success?: number;
  failed?: number;
}

interface CareerPilotPanelProps {
  onSyncComplete?: () => void | Promise<void>;
}

export default function CareerPilotPanel({ onSyncComplete }: CareerPilotPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "search" | "resume">("chat");

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [jobQuery, setJobQuery] = useState("backend engineer");
  const [jobLocation, setJobLocation] = useState("Bangalore");
  const [searchingJobs, setSearchingJobs] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<JobSearchResult[]>([]);
  const [topMatches, setTopMatches] = useState<JobMatchResult[]>([]);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  // Chat message history
  const [messages, setMessages] = useState<Array<{ sender: "user" | "agent"; text: string }>>([
    {
      sender: "agent",
      text: "Hi! I'm your CareerPilot Copilot. I can query jobs in the database, compute match scores based on your resume, and answer career planning questions. How can I help you today?",
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadTopMatches = async () => {
    try {
      const res = await fetch("/api/careerpilot/jobs");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTopMatches(
          data.map((item: any) => ({
            jobId: item.job_id,
            jobTitle: item.title,
            company: item.company_name,
            matchScore: item.match_score,
            eligible: true,
            vectorSimilarity: null,
            explanation: item.explanation,
            strengths: Array.isArray(item.strengths) ? item.strengths : [],
            missingSkills: Array.isArray(item.missing_skills) ? item.missing_skills : [],
            applyUrl: item.url,
          }))
        );
      }
    } catch {
      // Keep panel usable
    }
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/careerpilot/resume?t=${Date.now()}`);
      const data = await res.json();
      if (res.ok && !data.error) {
        setProfile(data);
        setError("");
      } else {
        setProfile(null);
        if (data.error) {
          setError(data.error);
        }
      }
    } catch {
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadTopMatches();
  }, []);

  const handleUpload = async () => {
    if (!resumeFile) {
      setError("Choose a PDF or DOCX resume first.");
      return;
    }

    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", resumeFile);

    try {
      const res = await fetch("/api/careerpilot/resume", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Resume upload failed.");
      } else {
        setProfile(data.profile || null);
        setError("");
        await loadTopMatches();
        if (!data.profile) {
          await loadProfile();
        }
      }
    } catch {
      setError("Resume upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async (textPrompt = message) => {
    const promptToSend = textPrompt.trim();
    if (!promptToSend) return;

    setError("");
    setAsking(true);
    setMessage(""); // clear input box
    
    // Append user message
    setMessages((prev) => [...prev, { sender: "user", text: promptToSend }]);

    try {
      const res = await fetch("/api/careerpilot/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: promptToSend,
          conversationId,
        }),
      });
      const data = (await res.json()) as AgentReply;
      if (!res.ok) {
        setError(data.error || "Agent request failed.");
        setMessages((prev) => [
          ...prev,
          { sender: "agent", text: `Error: ${data.error || "Failed to fetch response from Copilot."}` },
        ]);
      } else {
        setConversationId(data.conversationId);
        setMessages((prev) => [...prev, { sender: "agent", text: data.reply || "" }]);
        await loadTopMatches();
        await onSyncComplete?.();
      }
    } catch {
      setError("Agent request failed.");
      setMessages((prev) => [
        ...prev,
        { sender: "agent", text: "Error: Copilot API is unreachable. Please verify Nest API is running on port 4000." },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleSyncJobs = async () => {
    setError("");
    setSyncMessage("");
    setSyncing(true);
    try {
      const res = await fetch("/api/careerpilot/sync", { method: "POST" });
      const data = (await res.json()) as SyncResultSummary & { error?: string };
      if (!res.ok) {
        setError(data.error || "Job sync failed.");
      } else {
        setSyncMessage(`Sync completed: ${data.success ?? 0} successes.`);
        await loadTopMatches();
        await onSyncComplete?.();
      }
    } catch {
      setError("Job sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSearchJobs = async () => {
    if (!jobQuery.trim()) {
      setError("Enter a job keyword first.");
      return;
    }

    setError("");
    setSearchingJobs(true);
    try {
      const res = await fetch("/api/careerpilot/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: jobQuery,
          location: jobLocation || undefined,
          limit: 6,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Job search failed.");
        return;
      }
      setJobResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setError("Job search failed.");
    } finally {
      setSearchingJobs(false);
    }
  };

  const handleComputeMatch = async (jobId: string) => {
    setError("");
    setMatchingJobId(jobId);
    try {
      const res = await fetch("/api/careerpilot/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = (await res.json()) as JobMatchResult;

      if (!res.ok || data.error) {
        setError(data.error || "Fit score computation failed.");
        return;
      }

      setTopMatches((current) => {
        const otherMatches = current.filter((item) => item.jobId !== data.jobId);
        return [data, ...otherMatches].slice(0, 6);
      });
      
      // Notify client
      setMessages((prev) => [
        ...prev,
        { sender: "agent", text: `Computed fit for "${data.jobTitle}" at ${data.company}: **${data.matchScore}% Match**\n\n*Explanation:* ${data.explanation}` },
      ]);
      await onSyncComplete?.();
    } catch {
      setError("Fit score computation failed.");
    } finally {
      setMatchingJobId(null);
    }
  };

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const parts = [];
    let lastIndex = 0;
    const regex = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      if (match[1] && match[2]) {
        parts.push(
          <a
            key={matchIndex}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline", fontWeight: "bold", color: "var(--accent)" }}
          >
            {match[1]}
          </a>
        );
      } else if (match[3]) {
        const code = match[3];
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
        if (isUuid) {
          parts.push(
            <span key={matchIndex} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <code className="job-id-inline" title="Technical Job ID">{code.slice(0, 8)}...</code>
              <button
                onClick={() => handleComputeMatch(code)}
                className="primary-link"
                style={{ minHeight: "22px", padding: "1px 6px", fontSize: "0.7em" }}
              >
                Fit
              </button>
            </span>
          );
        } else {
          parts.push(<code key={matchIndex} className="job-id-inline">{code}</code>);
        }
      } else if (match[4]) {
        const code = match[4];
        parts.push(
          <span key={matchIndex} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <code className="job-id-inline">{code.slice(0, 8)}...</code>
            <button
              onClick={() => handleComputeMatch(code)}
              className="primary-link"
              style={{ minHeight: "22px", padding: "1px 6px", fontSize: "0.7em" }}
            >
              Fit
            </button>
          </span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const suggestionChips = [
    "Backend jobs in Bangalore",
    "Java developer roles",
    "Opportunities at Amazon",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab Triggers */}
      <div className="copilot-tabs" role="tablist" aria-label="CareerPilot tools">
        <button
          onClick={() => setActiveTab("chat")}
          className={`copilot-tab-btn ${activeTab === "chat" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "chat"}
          aria-controls="copilot-chat-panel"
        >
          Chat Copilot
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`copilot-tab-btn ${activeTab === "search" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "search"}
          aria-controls="copilot-search-panel"
        >
          Search Jobs
        </button>
        <button
          onClick={() => setActiveTab("resume")}
          className={`copilot-tab-btn ${activeTab === "resume" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "resume"}
          aria-controls="copilot-resume-panel"
        >
          Profile Sync
        </button>
      </div>

      {error && <p className="alert-inline" style={{ marginBottom: "12px" }}>{error}</p>}

      {/* Tab 1: Conversation focus */}
      {activeTab === "chat" && (
        <div id="copilot-chat-panel" className="chat-tab-container" role="tabpanel">
          <div className="chat-history">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.sender}`}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {renderMessageContent(msg.text)}
                </pre>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            {/* Suggestion Chips */}
            <div className="suggestion-chips">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleAsk(chip)}
                  className="suggestion-chip"
                  disabled={asking}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                className="careerpilot-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask your Copilot..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !asking) {
                    handleAsk();
                  }
                }}
                disabled={asking}
                style={{ flex: 1, minHeight: "38px" }}
              />
              <button
                onClick={() => handleAsk()}
                disabled={asking}
                className="primary-link"
                style={{ minHeight: "38px", padding: "0 14px" }}
              >
                {asking ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Clean search without long UUIDs */}
      {activeTab === "search" && (
        <div id="copilot-search-panel" role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="field">
            <span>Keywords</span>
            <input
              type="text"
              value={jobQuery}
              onChange={(e) => setJobQuery(e.target.value)}
              placeholder="e.g. Java Engineer"
            />
          </div>
          <div className="field">
            <span>Location</span>
            <input
              type="text"
              value={jobLocation}
              onChange={(e) => setJobLocation(e.target.value)}
              placeholder="e.g. Bangalore"
            />
          </div>

          <button onClick={handleSearchJobs} disabled={searchingJobs} className="primary-link" style={{ width: "100%" }}>
            {searchingJobs ? "Searching database..." : "Search Job Database"}
          </button>

          {jobResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <span className="topbar-kicker" style={{ fontSize: "0.7rem" }}>Results from search cache</span>
              {jobResults.map((job) => (
                <div key={job.id} className="careerpilot-result-card" style={{ padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{job.title}</strong>
                      <div className="metric-footnote" style={{ fontSize: "0.75rem" }}>
                        {job.company_name} {job.location ? `• ${job.location}` : ""}
                      </div>
                    </div>
                    <button
                      className="primary-link ghost-link"
                      onClick={() => handleComputeMatch(job.id)}
                      disabled={matchingJobId === job.id}
                      style={{ minHeight: "26px", fontSize: "0.75rem", padding: "2px 8px" }}
                    >
                      {matchingJobId === job.id ? "..." : "Score"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {topMatches.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              <span className="topbar-kicker" style={{ fontSize: "0.7rem" }}>Scored Fit Matches</span>
              {topMatches.slice(0, 3).map((match) => (
                <div key={match.jobId} className="careerpilot-result-card" style={{ padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{match.jobTitle}</strong>
                      <div className="metric-footnote" style={{ fontSize: "0.75rem" }}>{match.company}</div>
                    </div>
                    <span className="status-good" style={{ fontSize: "0.72rem", padding: "2px 6px" }}>
                      {match.matchScore}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Resume uploader and sync stats */}
      {activeTab === "resume" && (
        <div id="copilot-resume-panel" role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h4 style={{ margin: "0 0 6px", fontSize: "0.9rem" }}>1. Upload PDF Resume</h4>
            <label className="field" style={{ gap: "6px" }}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                style={{ padding: "6px", fontSize: "0.8rem", border: "1px dashed var(--line)" }}
              />
            </label>
            <button className="primary-link" onClick={handleUpload} disabled={uploading} style={{ width: "100%", marginTop: "10px" }}>
              {uploading ? "Parsing..." : "Upload and Parse"}
            </button>
          </div>

          {loadingProfile ? (
            <p className="panel-note">Checking baseline profile...</p>
          ) : profile ? (
            <div className="resume-preview" style={{ padding: "12px", background: "var(--surface-muted)", borderRadius: "var(--radius)" }}>
              <span className="topbar-kicker" style={{ fontSize: "0.68rem" }}>Active Baseline Resume</span>
              <div className="summary-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "8px" }}>
                <div>
                  <div className="summary-label" style={{ fontSize: "0.7rem" }}>Skills</div>
                  <div className="summary-value" style={{ fontSize: "0.8rem" }}>
                    {profile.skills && profile.skills.length > 0 ? profile.skills.length : 0} extracted
                  </div>
                </div>
                <div>
                  <div className="summary-label" style={{ fontSize: "0.7rem" }}>Experience</div>
                  <div className="summary-value" style={{ fontSize: "0.8rem" }}>{profile.experience?.length || 0} items</div>
                </div>
                <div>
                  <div className="summary-label" style={{ fontSize: "0.7rem" }}>Education</div>
                  <div className="summary-value" style={{ fontSize: "0.8rem" }}>{profile.education?.length || 0} items</div>
                </div>
                <div>
                  <div className="summary-label" style={{ fontSize: "0.7rem" }}>Projects</div>
                  <div className="summary-value" style={{ fontSize: "0.8rem" }}>{profile.projects?.length || 0} items</div>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
            <h4 style={{ margin: "0 0 6px", fontSize: "0.9rem" }}>2. Find Matching Jobs</h4>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button className="primary-link" onClick={handleSyncJobs} disabled={syncing} style={{ flexShrink: 0 }}>
                {syncing ? "Syncing..." : "Sync Jobs Cache"}
              </button>
              {syncMessage && <span className="sync-note" style={{ fontSize: "0.78rem" }}>{syncMessage}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
