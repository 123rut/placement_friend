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

interface SyncResultSummary {
  success?: number;
  failed?: number;
}

interface CareerPilotPanelProps {
  onSyncComplete?: () => void | Promise<void>;
}

export default function CareerPilotPanel({ onSyncComplete }: CareerPilotPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "resume">("chat");

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  // Chat message history
  const [messages, setMessages] = useState<Array<{ sender: "user" | "agent"; text: string }>>([
    {
      sender: "agent",
      text: "Hi! I'm your CareerPilot Copilot. Ask me anything about tailoring your resume, technical interview roadmaps, career questions, or specific job matches!",
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/careerpilot/resume");
      const data = await res.json();
      if (res.ok) {
        const loadedProfile = data.profile || (data.skills || data.id ? data : null);
        if (loadedProfile && (loadedProfile.skills || loadedProfile.experience || loadedProfile.education)) {
          setProfile(loadedProfile);
        }
      }
    } catch {
      // Keep panel usable
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpload = async () => {
    if (!resumeFile) {
      setError("Please select a PDF or Word resume first.");
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
        const loadedProfile = data.profile || (data.skills || data.id ? data : null);
        setProfile(loadedProfile);
        setError("");
        await onSyncComplete?.();
        if (!loadedProfile) {
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
    const controller = new AbortController();
    syncAbortRef.current = controller;
    try {
      const res = await fetch("/api/careerpilot/sync", {
        method: "POST",
        signal: controller.signal,
      });
      const data = (await res.json()) as SyncResultSummary & { error?: string };
      if (!res.ok) {
        setError(data.error || "Job sync failed.");
      } else {
        setSyncMessage(`Sync completed: ${data.success ?? 0} successes.`);
        await onSyncComplete?.();
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError("Job sync failed.");
      }
    } finally {
      syncAbortRef.current = null;
      setSyncing(false);
    }
  };

  const handleStopSync = async () => {
    syncAbortRef.current?.abort();
    syncAbortRef.current = null;
    setSyncing(false);
    setSyncMessage("Stopping...");
    try {
      const res = await fetch("/api/careerpilot/sync/stop", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setSyncMessage(data.message || "Sync stopped.");
    } catch {
      setSyncMessage("Stop signal sent (backend may still be finishing last company).");
    }
  };

  const renderMessageContent = (text: string) => {
    if (!text) return null;

    // Strip internal metadata comments (e.g. <!-- fit-id: ... -->)
    const cleanText = text.replace(/<!--[\s\S]*?-->/g, "");

    // Match markdown links [Label](url) OR standalone http/https URLs
    const combinedRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)\]]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(cleanText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleanText.slice(lastIndex, match.index));
      }

      if (match[1] && match[2]) {
        // [Label](url) format
        parts.push(
          <a
            key={match.index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--accent)",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {match[1]} ↗
          </a>
        );
      } else if (match[3]) {
        // Raw standalone URL
        parts.push(
          <a
            key={match.index}
            href={match[3]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--accent)",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            Apply / View Role ↗
          </a>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < cleanText.length) {
      parts.push(cleanText.slice(lastIndex));
    }

    return parts.length > 0 ? parts : cleanText;
  };

  const suggestionChips = [
    "What are my biggest skill gaps for SDE roles?",
    "Suggest 3 high-impact project ideas for my resume",
    "How can I prepare for system design rounds?",
    "Summarize my parsed resume profile",
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
          💬 AI Chat Copilot
        </button>
        <button
          onClick={() => setActiveTab("resume")}
          className={`copilot-tab-btn ${activeTab === "resume" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "resume"}
          aria-controls="copilot-resume-panel"
        >
          📄 Profile & Sync
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

      {/* Tab 2: Resume uploader and sync stats */}
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
            <h4 style={{ margin: "0 0 6px", fontSize: "0.9rem" }}>2. Scrape & Sync Jobs Cache</h4>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                className="primary-link"
                onClick={syncing ? handleStopSync : handleSyncJobs}
                style={{ flexShrink: 0, ...(syncing ? { background: "#f87171", borderColor: "#f87171" } : {}) }}
              >
                {syncing ? "⏹ Stop Sync" : "Sync Jobs Cache"}
              </button>
              {syncMessage && <span className="sync-note" style={{ fontSize: "0.78rem" }}>{syncMessage}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
