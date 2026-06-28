"use client";

import { useEffect, useState } from "react";

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
  matchScore: number;
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
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("Find backend jobs in Bangalore");
  const [agentReply, setAgentReply] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [jobQuery, setJobQuery] = useState("backend engineer");
  const [jobLocation, setJobLocation] = useState("Bangalore");
  const [searchingJobs, setSearchingJobs] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<JobSearchResult[]>([]);
  const [topMatches, setTopMatches] = useState<JobMatchResult[]>([]);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

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
            vectorSimilarity: null,
            explanation: item.explanation,
            strengths: Array.isArray(item.strengths) ? item.strengths : [],
            missingSkills: Array.isArray(item.missing_skills) ? item.missing_skills : [],
            applyUrl: item.url,
          })),
        );
      }
    } catch {
      // Keep panel usable even if matches are not available yet.
    }
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/careerpilot/resume");
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

  const handleAsk = async () => {
    if (!message.trim()) {
      return;
    }
    setError("");
    setAsking(true);
    try {
      const res = await fetch("/api/careerpilot/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId,
        }),
      });
      const data = (await res.json()) as AgentReply;
      if (!res.ok) {
        setError(data.error || "Agent request failed.");
      } else {
        setAgentReply(data.reply || "");
        setConversationId(data.conversationId);
      }
    } catch {
      setError("Agent request failed.");
    } finally {
      setAsking(false);
    }
  };

  const handleSyncJobs = async () => {
    setError("");
    setSyncMessage("");
    setSyncing(true);
    try {
      const res = await fetch("/api/careerpilot/sync", {
        method: "POST",
      });
      const data = (await res.json()) as SyncResultSummary & { error?: string };
      if (!res.ok) {
        setError(data.error || "Job sync failed.");
      } else {
        setSyncMessage(
          `Sync finished. ${data.success ?? 0} companies succeeded, ${data.failed ?? 0} failed.`,
        );
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
      setError("Add a role or keyword to search the jobs cache.");
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
        setError(data.error || "Match calculation failed.");
        return;
      }

      setTopMatches((current) => {
        const withoutCurrent = current.filter((item) => item.jobId !== data.jobId);
        return [data, ...withoutCurrent].slice(0, 6);
      });
    } catch {
      setError("Match calculation failed.");
    } finally {
      setMatchingJobId(null);
    }
  };

  const formatPostedAt = (value: string | null) => {
    if (!value) {
      return "Recently";
    }

    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <div className="section-label">CareerPilot workspace</div>
          <h2>Resume, search, and fit scoring in one place</h2>
        </div>
        <span className={profile ? "status-good" : "status-warn"}>
          {profile ? "Resume parsed" : "Resume needed"}
        </span>
      </div>

      <p className="panel-note">
        Keep the flow simple: sync jobs, upload a resume, search roles, then score the best matches.
      </p>

      <div className="careerpilot-form-stack">
        <section className="careerpilot-block">
          <div className="careerpilot-block-head">
            <div>
              <div className="section-label">Step 1</div>
              <h3>Prepare your profile</h3>
            </div>
          </div>
          <div className="careerpilot-action-row">
            <button className="primary-link panel-button" onClick={handleSyncJobs} disabled={syncing}>
              {syncing ? "Syncing jobs..." : "Sync jobs cache"}
            </button>
            {syncMessage ? <span className="sync-note">{syncMessage}</span> : null}
          </div>

          <label className="field">
            <span>Resume file</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            />
          </label>

          <button className="primary-link panel-button" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Parsing resume..." : "Upload and parse resume"}
          </button>

          {loadingProfile ? <p className="panel-note">Checking for an existing parsed profile...</p> : null}
          {profile ? (
            <div className="resume-preview">
              <div className="summary-grid">
                <div>
                  <div className="summary-label">Skills</div>
                  <div className="summary-value">{profile.skills?.slice(0, 6).join(", ") || "No skills extracted yet"}</div>
                </div>
                <div>
                  <div className="summary-label">Experience entries</div>
                  <div className="summary-value">{profile.experience?.length || 0}</div>
                </div>
                <div>
                  <div className="summary-label">Education entries</div>
                  <div className="summary-value">{profile.education?.length || 0}</div>
                </div>
                <div>
                  <div className="summary-label">Projects</div>
                  <div className="summary-value">{profile.projects?.length || 0}</div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="careerpilot-block">
          <div className="careerpilot-block-head">
            <div>
              <div className="section-label">Step 2</div>
              <h3>Search the job cache</h3>
            </div>
          </div>

          <div className="field">
            <span>Role and location</span>
            <div className="careerpilot-search-grid">
              <input
                className="careerpilot-input"
                value={jobQuery}
                onChange={(event) => setJobQuery(event.target.value)}
                placeholder="Backend engineer"
              />
              <input
                className="careerpilot-input"
                value={jobLocation}
                onChange={(event) => setJobLocation(event.target.value)}
                placeholder="Bangalore"
              />
            </div>
          </div>

          <button className="primary-link panel-button" onClick={handleSearchJobs} disabled={searchingJobs}>
            {searchingJobs ? "Searching jobs..." : "Search job cache"}
          </button>
        </section>

        <section className="careerpilot-block">
          <div className="careerpilot-block-head">
            <div>
              <div className="section-label">Step 3</div>
              <h3>Ask the agent</h3>
            </div>
          </div>

          <div className="field">
            <span>Question</span>
            <textarea
              className="careerpilot-textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="I'm a Java developer with 2 years of experience. Find backend jobs in Bangalore."
            />
          </div>

          <button className="primary-link panel-button" onClick={handleAsk} disabled={asking}>
            {asking ? "Thinking..." : "Ask the agent"}
          </button>

          {agentReply ? (
            <div className="agent-reply">
              <div className="summary-label">Agent reply</div>
              <pre>{agentReply}</pre>
            </div>
          ) : null}
        </section>

        {error ? <p className="alert-inline">{error}</p> : null}

        {jobResults.length > 0 ? (
          <div className="careerpilot-results">
            <div className="summary-label">Search results</div>
            {jobResults.map((job) => (
              <div key={job.id} className="careerpilot-result-card">
                <div className="careerpilot-result-head">
                  <div>
                    <strong>{job.title}</strong>
                    <div className="panel-note">
                      {job.company_name} {job.location ? `• ${job.location}` : ""} {job.remote ? "• Remote-friendly" : ""}
                    </div>
                  </div>
                  <button
                    className="primary-link ghost-link"
                    onClick={() => handleComputeMatch(job.id)}
                    disabled={matchingJobId === job.id}
                  >
                    {matchingJobId === job.id ? "Scoring..." : "Score fit"}
                  </button>
                </div>
                <div className="panel-note">
                  Posted {formatPostedAt(job.posted_at)}
                  {typeof job.similarity_score === "number" ? ` • Similarity ${Math.round(job.similarity_score * 100)}%` : ""}
                </div>
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="primary-link">
                  Open listing
                </a>
              </div>
            ))}
          </div>
        ) : null}

        {topMatches.length > 0 ? (
          <div className="careerpilot-results">
            <div className="summary-label">Top ranked matches</div>
            {topMatches.map((match) => (
              <div key={match.jobId} className="careerpilot-result-card">
                <div className="careerpilot-result-head">
                  <div>
                    <strong>{match.jobTitle}</strong>
                    <div className="panel-note">{match.company}</div>
                  </div>
                  <span className="status-good">{match.matchScore}% match</span>
                </div>
                <p className="panel-note">{match.explanation}</p>
                <div className="panel-note">
                  Strengths: {match.strengths.length > 0 ? match.strengths.join(", ") : "Resume aligned with the role baseline"}
                </div>
                <div className="panel-note">
                  Gaps: {match.missingSkills.length > 0 ? match.missingSkills.join(", ") : "No major gaps detected"}
                </div>
                <a href={match.applyUrl} target="_blank" rel="noopener noreferrer" className="primary-link">
                  Apply to role
                </a>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
