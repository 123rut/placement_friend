"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { branchOptions, categoryLabels } from "../../../lib/sprint-one";
import type { Company, CompanyCategory } from "@piaa/domain";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../../../lib/supabase/client";

type ProfileEditShellProps = {
  user: User;
  profile: any;
  companies: Company[];
  initialSelectedCompanyIds: string[];
};

const currentYearVal = new Date().getFullYear();
const maxYear = currentYearVal + 5;
const batchYearOptions = Array.from({ length: maxYear - 2000 + 1 }, (_, i) => 2000 + i).reverse();

export function ProfileEditShell({
  user,
  profile,
  companies,
  initialSelectedCompanyIds
}: ProfileEditShellProps) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [branch, setBranch] = useState(profile.branch ?? "Computer Science");
  const [cgpa, setCgpa] = useState(profile.cgpa?.toString() ?? "8.0");
  const [batchYear, setBatchYear] = useState(profile.batch_year?.toString() ?? "2026");
  const [categoryFilter, setCategoryFilter] = useState<CompanyCategory | "all">("all");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(initialSelectedCompanyIds);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Experience States
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loadingCandidate, setLoadingCandidate] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formEmploymentType, setFormEmploymentType] = useState("Full-Time");
  const [formLocation, setFormLocation] = useState("");
  const [formStartMonth, setFormStartMonth] = useState(1);
  const [formStartYear, setFormStartYear] = useState(new Date().getFullYear());
  const [formEndMonth, setFormEndMonth] = useState(1);
  const [formEndYear, setFormEndYear] = useState(new Date().getFullYear());
  const [formCurrent, setFormCurrent] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [formSkillsText, setFormSkillsText] = useState("");
  const [formError, setFormError] = useState("");

  const monthsList = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const fullMonthsList = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const yearsList = Array.from({ length: 30 }, (_, idx) => currentYearVal - 15 + idx).reverse();

  useEffect(() => {
    async function loadCandidateProfile() {
      try {
        const res = await fetch(`/api/careerpilot/resume?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error && Array.isArray(data.experience)) {
            const mapped = data.experience.map((exp: any) => ({
              id: exp.id || Math.random().toString(36).substring(2, 9),
              title: exp.title || exp.role || "",
              company: exp.company || "",
              employmentType: exp.employmentType || "Full-Time",
              location: exp.location || "",
              startMonth: Number(exp.startMonth) || 1,
              startYear: Number(exp.startYear) || currentYearVal,
              endMonth: exp.endMonth ? Number(exp.endMonth) : undefined,
              endYear: exp.endYear ? Number(exp.endYear) : undefined,
              current: !!exp.current,
              description: exp.description || "",
              skills: Array.isArray(exp.skills) ? exp.skills : [],
            }));
            setExperiences(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load candidate profile:", err);
      } finally {
        setLoadingCandidate(false);
      }
    }
    loadCandidateProfile();
  }, []);

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setFormTitle("");
    setFormCompany("");
    setFormEmploymentType("Full-Time");
    setFormLocation("");
    setFormStartMonth(1);
    setFormStartYear(currentYearVal);
    setFormEndMonth(1);
    setFormEndYear(currentYearVal);
    setFormCurrent(false);
    setFormDescription("");
    setFormSkillsText("");
    setFormError("");
    setShowForm(true);
  };

  const handleEdit = (index: number) => {
    const exp = experiences[index];
    setEditingIndex(index);
    setFormTitle(exp.title || "");
    setFormCompany(exp.company || "");
    setFormEmploymentType(exp.employmentType || "Full-Time");
    setFormLocation(exp.location || "");
    setFormStartMonth(exp.startMonth || 1);
    setFormStartYear(exp.startYear || currentYearVal);
    setFormEndMonth(exp.endMonth || 1);
    setFormEndYear(exp.endYear || currentYearVal);
    setFormCurrent(!!exp.current);
    setFormDescription(exp.description || "");
    setFormSkillsText(Array.isArray(exp.skills) ? exp.skills.join(", ") : "");
    setFormError("");
    setShowForm(true);
  };

  const handleDelete = (index: number) => {
    if (confirm("Are you sure you want to delete this experience?")) {
      setExperiences(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleSaveExperienceEntry = () => {
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Job title is required.");
      return;
    }
    if (!formCompany.trim()) {
      setFormError("Company name is required.");
      return;
    }

    const startMonth = Number(formStartMonth);
    const startYear = Number(formStartYear);
    const endMonth = Number(formEndMonth);
    const endYear = Number(formEndYear);

    if (!formCurrent && (!endMonth || !endYear)) {
      setFormError("End date is required unless this is the current position.");
      return;
    }

    if (!formCurrent) {
      if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
        setFormError("End date must be after the start date.");
        return;
      }
    }

    const newEntry = {
      id: editingIndex !== null ? experiences[editingIndex].id : Math.random().toString(36).substring(2, 9),
      title: formTitle.trim(),
      company: formCompany.trim(),
      employmentType: formEmploymentType,
      location: formLocation.trim(),
      startMonth,
      startYear,
      endMonth: formCurrent ? undefined : endMonth,
      endYear: formCurrent ? undefined : endYear,
      current: formCurrent,
      description: formDescription.trim(),
      skills: formSkillsText.split(",").map(s => s.trim()).filter(Boolean),
    };

    if (editingIndex !== null) {
      setExperiences(prev => prev.map((exp, idx) => idx === editingIndex ? newEntry : exp));
    } else {
      setExperiences(prev => [...prev, newEntry]);
    }

    setShowForm(false);
  };

  const getDurationText = (exp: any) => {
    const startStr = `${monthsList[exp.startMonth - 1]} ${exp.startYear}`;
    const endStr = exp.current ? "Present" : `${monthsList[exp.endMonth - 1]} ${exp.endYear}`;
    
    const start = new Date(exp.startYear, exp.startMonth - 1, 1);
    const end = exp.current ? new Date() : new Date(exp.endYear, exp.endMonth - 1, 1);
    
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    if (months < 0) months = 0;
    
    const yrs = Math.floor(months / 12);
    const mos = months % 12;
    
    let durationStr = "";
    if (yrs > 0) durationStr += `${yrs} yr${yrs > 1 ? 's' : ''}`;
    if (mos > 0) durationStr += `${durationStr ? ' ' : ''}${mos} mo${mos > 1 ? 's' : ''}`;
    if (!durationStr) durationStr = "1 mo";

    return `${startStr} – ${endStr} (${durationStr})`;
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    const supabase = createClient();

    const parsedCgpa = parseFloat(cgpa);
    if (isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
      setErrorMessage("Please enter a valid CGPA between 0.0 and 10.0.");
      setIsSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("students")
      .update({
        full_name: fullName,
        branch,
        cgpa: parsedCgpa,
        batch_year: parseInt(batchYear),
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (profileError) {
      setErrorMessage(`Failed to update profile: ${profileError.message}`);
      setIsSaving(false);
      return;
    }

    // Fetch existing company targets for this student to preserve their preferences
    const { data: existingTargets, error: fetchTargetsError } = await supabase
      .from("student_company_targets")
      .select("company_id, notify_email, notify_dashboard, notify_via")
      .eq("student_id", user.id);

    if (fetchTargetsError) {
      setErrorMessage(`Failed to fetch existing company targets: ${fetchTargetsError.message}`);
      setIsSaving(false);
      return;
    }

    const existingTargetMap = new Map(existingTargets?.map(t => [t.company_id, t]) || []);
    
    // Identify targets to delete (in db but not selected anymore)
    const toDeleteIds = Array.from(existingTargetMap.keys()).filter(id => !selectedCompanyIds.includes(id));
    
    // Identify targets to insert (selected but not in db yet)
    const toInsertIds = selectedCompanyIds.filter(id => !existingTargetMap.has(id));

    // Delete removed ones
    if (toDeleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("student_company_targets")
        .delete()
        .eq("student_id", user.id)
        .in("company_id", toDeleteIds);

      if (deleteError) {
        setErrorMessage(`Failed to delete company targets: ${deleteError.message}`);
        setIsSaving(false);
        return;
      }
    }

    // Insert new ones
    if (toInsertIds.length > 0) {
      const targetsToInsert = toInsertIds.map(companyId => ({
        student_id: user.id,
        company_id: companyId,
        notify_via: "email",
        notify_email: true,
        notify_dashboard: true
      }));

      const { error: insertError } = await supabase
        .from("student_company_targets")
        .insert(targetsToInsert);

      if (insertError) {
        setErrorMessage(`Failed to insert new company targets: ${insertError.message}`);
        setIsSaving(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/careerpilot/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience: experiences }),
      });
      if (!res.ok) {
        const errData = await res.json();
        setErrorMessage(`Failed to update experience: ${errData.error || res.statusText}`);
        setIsSaving(false);
        return;
      }
    } catch (err: any) {
      setErrorMessage(`Failed to update experience: ${err.message}`);
      setIsSaving(false);
      return;
    }

    setMessage("Changes saved successfully! Redirecting...");
    setTimeout(() => {
      window.location.href = "/watchlist";
    }, 1000);
  };

  // Profile completeness percentage
  const completeness = useMemo(() => {
    let score = 0;
    if (fullName.trim()) score += 20;
    if (branch) score += 20;
    if (cgpa && parseFloat(cgpa) > 0) score += 20;
    if (batchYear) score += 20;
    if (experiences.length > 0) score += 20;
    return score;
  }, [fullName, branch, cgpa, batchYear, experiences]);

  const visibleCompanies = useMemo(
    () =>
      companies.filter((company) => {
        const matchesCategory = categoryFilter === "all" || company.category === categoryFilter;
        const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSelectedOnly = !showSelectedOnly || selectedCompanyIds.includes(company.id);
        return matchesCategory && matchesSearch && matchesSelectedOnly;
      }),
    [categoryFilter, searchQuery, showSelectedOnly, selectedCompanyIds, companies]
  );

  const eligiblePreviewCount = useMemo(() => {
    const parsedCgpa = Number(cgpa);
    if (Number.isNaN(parsedCgpa)) return 0;

    return companies.filter((company) => {
      const cgpaEligible = company.minCgpa === null || parsedCgpa >= company.minCgpa;
      const branchEligible =
        company.eligibleBranches.length === 0 || company.eligibleBranches.includes(branch);

      return cgpaEligible && branchEligible;
    }).length;
  }, [branch, cgpa, companies]);

  const toggleCompany = (companyId: string) => {
    setSelectedCompanyIds((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId]
    );
  };

  const handleSelectAllResults = () => {
    setSelectedCompanyIds((current) => {
      const visibleIds = visibleCompanies.map((c) => c.id);
      const uniqueNewIds = visibleIds.filter((id) => !current.includes(id));
      return [...current, ...uniqueNewIds];
    });
  };

  const handleClearAllResults = () => {
    setSelectedCompanyIds((current) => {
      const visibleIds = new Set(visibleCompanies.map((c) => c.id));
      return current.filter((id) => !visibleIds.has(id));
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Hierarchy: Page Title -> Short Description */}
      <div>
        <span className="topbar-kicker">Settings & baseline</span>
        <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "4px 0 0" }}>
          Candidate Profile Tuning
        </h1>
        <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.9rem" }}>
          Manage your verified academic credentials, target watchlist, and professional milestones.
        </p>
      </div>

      <section className="dashboard-layout" style={{ gap: "20px" }}>
        {/* Left Side: General baseline and account info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Profile Completeness progress card */}
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div>
                <div className="section-label">Profile completeness</div>
                <h2>Workspace baseline progress</h2>
              </div>
              <span className="status-info" style={{ fontWeight: 700 }}>{completeness}%</span>
            </div>
            <div style={{ background: "var(--surface-muted)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  background: "var(--accent)",
                  width: `${completeness}%`,
                  height: "100%",
                  borderRadius: "4px",
                  transition: "width 0.3s ease",
                }}
              ></div>
            </div>
            <p className="panel-note" style={{ marginTop: "10px" }}>
              {completeness < 100
                ? "Complete all fields and add work history/internships to achieve 100% and unlock accurate AI match scoring."
                : "Your profile baseline is fully complete! Copilot has optimal context."}
            </p>
          </div>

          {/* Account Details Verification Card */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">Identity Anchor</div>
                <h2>Verified academic registry</h2>
              </div>
              <span className="status-good">Verified</span>
            </div>

            <label className="field" style={{ opacity: 0.6 }}>
              <span>College email</span>
              <input
                value={profile.college_email || ""}
                disabled
                type="email"
                style={{ cursor: "not-allowed" }}
              />
            </label>
            <p className="panel-note" style={{ marginTop: "12px" }}>
              Your college domain validates your credentials and unlocks target access rules. Domain changes require registering a new identity.
            </p>
          </div>

          {/* Profile form credentials */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="section-label">Candidate Baseline</div>
                <h2>Update baseline metrics</h2>
              </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: "1fr", gap: "14px" }}>
              <label className="field">
                <span>Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </label>

              <label className="field">
                <span>Academic branch</span>
                <select value={branch} onChange={(event) => setBranch(event.target.value)}>
                  {branchOptions.map((option: string) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Current CGPA</span>
                <input
                  value={cgpa}
                  max="10"
                  min="0"
                  onChange={(event) => setCgpa(event.target.value)}
                  step="0.1"
                  type="number"
                  required
                />
              </label>

              <label className="field">
                <span>Graduation Batch</span>
                <select value={batchYear} onChange={(event) => setBatchYear(event.target.value)}>
                  {batchYearOptions.map((option: number) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

          </div>
        </div>

        {/* Right Side: Professional Work history & Experience details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel">
            <div className="panel-header" style={{ alignItems: "center" }}>
              <div>
                <div className="section-label">Professional History</div>
                <h2>Work Experience & Internships</h2>
                <p className="panel-note" style={{ marginTop: "2px" }}>
                  Manage work records. Saved milestones will enrich your resume context.
                </p>
              </div>
              <button
                onClick={handleOpenAdd}
                type="button"
                className="primary-link"
                style={{ minHeight: "34px", padding: "6px 12px", fontSize: "0.82rem" }}
              >
                + Add Role
              </button>
            </div>

            {loadingCandidate ? (
              <p className="panel-note" style={{ padding: "16px 0" }}>Loading experience history...</p>
            ) : experiences.length === 0 ? (
              /* Better Empty State for experience catalog */
              <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "36px 16px" }}>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  style={{ width: "32px", height: "32px", color: "var(--muted)" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h5" />
                </svg>
                <h3>No work experience yet</h3>
                <p style={{ maxWidth: "280px", margin: "0 auto", color: "var(--muted)" }}>
                  Add internships, projects, or contract work to improve your AI Copilot recommendations.
                </p>
                <button
                  onClick={handleOpenAdd}
                  type="button"
                  className="primary-link ghost-link"
                  style={{ minHeight: "32px", fontSize: "0.8rem", marginTop: "8px" }}
                >
                  Add Experience
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                {experiences.map((exp, index) => (
                  <div
                    key={exp.id || index}
                    className="timeline-card"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{exp.title}</h3>
                        <p style={{ margin: "2px 0 0 0", color: "var(--accent)", fontWeight: 600, fontSize: "0.85rem" }}>
                          {exp.company} {exp.employmentType ? ` | ${exp.employmentType}` : ""}
                        </p>
                        <p style={{ margin: "2px 0 0 0", color: "var(--muted)", fontSize: "0.78rem" }}>
                          {getDurationText(exp)}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => handleEdit(index)}
                          type="button"
                          className="primary-link ghost-link"
                          style={{ minHeight: "26px", fontSize: "0.75rem", padding: "2px 8px" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(index)}
                          type="button"
                          className="action-btn-danger"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {exp.description && (
                      <p style={{ margin: "8px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                        {exp.description}
                      </p>
                    )}
                    {exp.skills && exp.skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "10px" }}>
                        {exp.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="pill"
                            style={{ fontSize: "0.7rem", padding: "1px 6px", minHeight: "20px" }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Inline Add/Edit Form Panel - Restyled for Dark Theme */}
            {showForm && (
              <div
                style={{
                  marginTop: "24px",
                  padding: "18px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  background: "var(--surface-muted)",
                }}
              >
                <h3 style={{ margin: "0 0 16px 0", fontSize: "1.05rem", fontWeight: 700 }}>
                  {editingIndex !== null ? "Edit Experience Entry" : "Add Experience Entry"}
                </h3>

                <div className="form-grid" style={{ gap: "12px" }}>
                  <label className="field">
                    <span>Job Title</span>
                    <input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Senior Backend Engineer"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Company</span>
                    <input
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      placeholder="e.g. Stripe"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Employment Type</span>
                    <select
                      value={formEmploymentType}
                      onChange={(e) => setFormEmploymentType(e.target.value)}
                    >
                      <option value="Full-Time">Full-Time</option>
                      <option value="Internship">Internship</option>
                      <option value="Contract">Contract</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Part-Time">Part-Time</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Location</span>
                    <input
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="e.g. Remote"
                    />
                  </label>

                  <div className="form-grid" style={{ gridColumn: "span 2", padding: 0, gap: "10px" }}>
                    <label className="field">
                      <span>Start Month</span>
                      <select
                        value={formStartMonth}
                        onChange={(e) => setFormStartMonth(Number(e.target.value))}
                      >
                        {fullMonthsList.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Start Year</span>
                      <select
                        value={formStartYear}
                        onChange={(e) => setFormStartYear(Number(e.target.value))}
                      >
                        {yearsList.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>End Month</span>
                      <select
                        disabled={formCurrent}
                        value={formEndMonth}
                        onChange={(e) => setFormEndMonth(Number(e.target.value))}
                        style={{ cursor: formCurrent ? "not-allowed" : "default" }}
                      >
                        {fullMonthsList.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>End Year</span>
                      <select
                        disabled={formCurrent}
                        value={formEndYear}
                        onChange={(e) => setFormEndYear(Number(e.target.value))}
                        style={{ cursor: formCurrent ? "not-allowed" : "default" }}
                      >
                        {yearsList.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", margin: "4px 0" }}>
                    <input
                      type="checkbox"
                      checked={formCurrent}
                      onChange={(e) => setFormCurrent(e.target.checked)}
                      style={{ width: "15px", height: "15px", accentColor: "var(--accent)" }}
                    />
                    <strong style={{ fontSize: "0.85rem" }}>I currently work in this role</strong>
                  </label>

                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>Description</span>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Describe achievements, backend tech stack, etc..."
                      rows={4}
                      style={{ resize: "vertical" }}
                    />
                  </label>

                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>Skills (comma-separated tags)</span>
                    <input
                      value={formSkillsText}
                      onChange={(e) => setFormSkillsText(e.target.value)}
                      placeholder="e.g. Node.js, Postgres, Redis"
                    />
                  </label>
                </div>

                {formError && (
                  <p className="alert-inline" style={{ marginTop: "12px" }}>{formError}</p>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                  <button
                    onClick={handleSaveExperienceEntry}
                    type="button"
                    className="primary-link"
                  >
                    Save Role
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    type="button"
                    className="primary-link ghost-link"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Target companies registry section - Hierarchy tuned */}
      <section className="workspace-section">
        <div style={{ marginBottom: "16px" }}>
          <span className="topbar-kicker">Watchlist</span>
          <h2 style={{ margin: "4px 0 0", fontSize: "1.35rem", fontWeight: 700 }}>Add Companies to Watchlist</h2>
          <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
            Select target employers whose job listings should be checked and matched against your resume.
          </p>
        </div>

        {/* Sticky Toolbar (Compact Area) */}
        <div 
          style={{ 
            position: "sticky", 
            top: 0, 
            background: "var(--surface)", 
            zIndex: 10, 
            paddingBottom: "14px", 
            borderBottom: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          {/* Watchlist Overview Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "var(--text-primary)" }}>
              {selectedCompanyIds.length} of {companies.length} Companies Selected
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => setShowSelectedOnly(e.target.checked)}
                style={{ cursor: "pointer", accentColor: "var(--accent)" }}
              />
              <span>Show Selected Only</span>
            </label>
          </div>

          {/* Search & Filter Row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between" }}>
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: "1 1 200px",
                padding: "8px 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
                background: "var(--surface-muted)",
                color: "var(--text)",
                fontSize: "0.85rem",
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
            />

            <div className="filter-row" style={{ margin: 0, gap: "6px" }}>
              <button
                className={categoryFilter === "all" ? "filter-chip active" : "filter-chip"}
                onClick={() => setCategoryFilter("all")}
                type="button"
                style={{ padding: "4px 10px", fontSize: "0.8rem" }}
              >
                All Sectors
              </button>
              {Object.entries(categoryLabels).map(([category, label]) => (
                <button
                  className={categoryFilter === category ? "filter-chip active" : "filter-chip"}
                  key={category}
                  onClick={() => setCategoryFilter(category as CompanyCategory)}
                  type="button"
                  style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Bulk Actions */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={handleSelectAllResults}
                className="primary-link ghost-link"
                style={{ padding: "4px 10px", fontSize: "0.8rem", minHeight: "30px" }}
              >
                Select All Results
              </button>
              <button
                type="button"
                onClick={handleClearAllResults}
                className="primary-link ghost-link"
                style={{ padding: "4px 10px", fontSize: "0.8rem", minHeight: "30px", color: "var(--accent)" }}
              >
                Clear All Results
              </button>
            </div>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            * Bulk actions apply only to the companies currently matching the active search query and category filters.
          </div>
        </div>

        {/* Scrollable Checklist */}
        <div 
          style={{ 
            maxHeight: "320px", 
            overflowY: "auto", 
            marginTop: "12px", 
            display: "flex", 
            flexDirection: "column", 
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            background: "var(--surface-muted)",
            padding: "8px 0"
          }}
        >
          {visibleCompanies.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted)", padding: "32px 16px" }}>
              <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--text)" }}>No companies found.</strong>
              <span style={{ fontSize: "0.8rem", marginTop: "4px", display: "block" }}>Try another search term or change the selected category.</span>
            </div>
          ) : (
            visibleCompanies.map((company) => {
              const isSelected = selectedCompanyIds.includes(company.id);

              return (
                <label
                  key={company.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 16px",
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                    borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
                    background: isSelected ? "var(--accent-soft)" : "transparent"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isSelected ? "var(--accent-soft)" : "var(--surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? "var(--accent-soft)" : "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCompany(company.id)}
                      style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                    />
                    <strong style={{ fontSize: "0.9rem", color: isSelected ? "var(--accent)" : "var(--text)" }}>
                      {company.name}
                    </strong>
                  </div>
                  <span 
                    className="tile-badge" 
                    style={{ 
                      fontSize: "0.72rem", 
                      padding: "2px 8px", 
                      borderRadius: "4px", 
                      background: "var(--surface)",
                      border: "1px solid var(--line)"
                    }}
                  >
                    {categoryLabels[company.category]}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </section>

      {/* Global Page-level Save Changes button at the very bottom */}
      <div 
        style={{ 
          marginTop: "12px", 
          padding: "20px 0", 
          borderTop: "1px solid var(--line)", 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "flex-end", 
          gap: "10px" 
        }}
      >
        {errorMessage && <p className="alert-inline" style={{ width: "100%", textAlign: "right" }}>{errorMessage}</p>}
        {message && <div className="status-good" style={{ padding: "10px", borderRadius: "var(--radius)", width: "100%", textAlign: "right" }}>{message}</div>}
        
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="primary-link"
            style={{ padding: "10px 24px" }}
          >
            {isSaving ? "Saving Changes..." : "Save Changes"}
          </button>
          <Link
            href="/watchlist"
            className="primary-link ghost-link"
            style={{ padding: "10px 24px", display: "flex", alignItems: "center" }}
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
