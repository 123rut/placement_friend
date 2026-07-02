"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { branchOptions, categoryLabels } from "../../lib/sprint-one";
import type { Company, CompanyCategory } from "@piaa/domain";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../../lib/supabase/client";

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
  const currentYearVal = new Date().getFullYear();
  const yearsList = Array.from({ length: 30 }, (_, i) => currentYearVal - 15 + i).reverse();

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
      setExperiences(prev => prev.filter((_, i) => i !== index));
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

    // Validation
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
      setExperiences(prev => prev.map((exp, i) => i === editingIndex ? newEntry : exp));
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

    // 1. Update students profile
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

    // 2. Synchronize tracked companies
    const { error: deleteError } = await supabase
      .from("student_company_targets")
      .delete()
      .eq("student_id", user.id);

    if (deleteError) {
      setErrorMessage(`Failed to update company targets: ${deleteError.message}`);
      setIsSaving(false);
      return;
    }

    if (selectedCompanyIds.length > 0) {
      const targets = selectedCompanyIds.map(companyId => ({
        student_id: user.id,
        company_id: companyId,
        notify_via: "email"
      }));

      const { error: insertError } = await supabase
        .from("student_company_targets")
        .insert(targets);

      if (insertError) {
        setErrorMessage(`Failed to add company targets: ${insertError.message}`);
        setIsSaving(false);
        return;
      }
    }

    // Update candidate profile manually
    try {
      const res = await fetch("/api/careerpilot/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience: experiences,
        }),
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
      window.location.href = "/dashboard";
    }, 1000);
  };

  const visibleCompanies = useMemo(
    () =>
      companies.filter((company) => {
        if (categoryFilter === "all") {
          return true;
        }
        return company.category === categoryFilter;
      }),
    [categoryFilter, companies]
  );

  const eligiblePreviewCount = useMemo(() => {
    const parsedCgpa = Number(cgpa);
    if (Number.isNaN(parsedCgpa)) {
      return 0;
    }

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="topbar-kicker">CareerPilot settings</div>
          <h1>Tune your candidate profile</h1>
        </div>
        <nav className="topbar-actions">
          <Link className="primary-link" style={{ background: 'var(--muted)' }} href="/dashboard">
            Back to workspace
          </Link>
        </nav>
      </header>

      <section className="workspace-section intro-grid">
        {/* Info panel */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Account details</div>
              <h2>Verified academic identity</h2>
            </div>
            <span className="status-good">Verified</span>
          </div>

          <label className="field" style={{ opacity: 0.7 }}>
            <span>College email</span>
            <input
              value={profile.college_email}
              disabled
              type="email"
              style={{ cursor: 'not-allowed' }}
            />
          </label>

          <p className="panel-note" style={{ marginTop: '16px' }}>
            Your college email anchors the trust layer for recommendations. To switch institutions, register a fresh account with the new domain.
          </p>
        </div>

        {/* Profile editing form */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Information</div>
              <h2>Candidate baseline</h2>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </label>

            <label className="field">
              <span>Branch</span>
              <select value={branch} onChange={(event) => setBranch(event.target.value)}>
                {branchOptions.map((option: string) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>CGPA</span>
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
              <span>Batch year</span>
              <select value={batchYear} onChange={(event) => setBatchYear(event.target.value)}>
                {batchYearOptions.map((option: number) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {errorMessage && <p className="status-warn" style={{ padding: '10px', marginTop: '16px', borderRadius: 'var(--radius)' }}>{errorMessage}</p>}
          {message && <p className="status-good" style={{ padding: '10px', marginTop: '16px', borderRadius: 'var(--radius)' }}>{message}</p>}

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button 
              onClick={handleSaveChanges} 
              disabled={isSaving}
              className="primary-link"
              style={{ border: 'none', padding: '10px 20px', cursor: 'pointer' }}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <Link 
              href="/dashboard"
              className="primary-link"
              style={{ background: '#e2e8f0', color: 'var(--text)', border: 'none', padding: '10px 20px' }}
            >
              Cancel
            </Link>
          </div>

          <div className="summary-grid" style={{ marginTop: '24px' }}>
            <div>
              <div className="summary-label">Immediate fit preview</div>
              <div className="summary-value">{eligiblePreviewCount} companies align right now</div>
            </div>
            <div>
              <div className="summary-label">Watchlist size</div>
              <div className="summary-value">{selectedCompanyIds.length} selected</div>
            </div>
          </div>
        </div>
      </section>

      {/* Experience list section */}
      <section className="workspace-section">
        <div className="panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="section-label">Professional Profile</div>
              <h2>Work Experience</h2>
              <p className="panel-note" style={{ marginTop: '4px' }}>
                Manage your work history. Manually saved experience overrides resume parsing.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              type="button"
              className="primary-link"
              style={{ border: 'none', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              + Add Experience
            </button>
          </div>

          {loadingCandidate ? (
            <p className="panel-note" style={{ marginTop: '16px' }}>Loading experience records...</p>
          ) : experiences.length === 0 ? (
            <p className="panel-note" style={{ marginTop: '24px', textAlign: 'center', padding: '24px 0' }}>
              No experience records found. Add your internships, jobs, or contracts here to build your semantic profile.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              {experiences.map((exp, index) => (
                <div
                  key={exp.id || index}
                  style={{
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius)',
                    background: '#f8fafc',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{exp.title}</h3>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--primary)', fontWeight: 500, fontSize: '0.9rem' }}>
                        {exp.company} {exp.employmentType ? `• ${exp.employmentType}` : ""} {exp.location ? `• ${exp.location}` : ""}
                      </p>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {getDurationText(exp)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEdit(index)}
                        type="button"
                        className="primary-link ghost-link"
                        style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#e2e8f0', color: 'var(--text)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        type="button"
                        className="action-btn-danger"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {exp.description && (
                    <p style={{ margin: '12px 0 0 0', fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {exp.description}
                    </p>
                  )}
                  {exp.skills && exp.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                      {exp.skills.map((skill: string) => (
                        <span
                          key={skill}
                          className="pill"
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            background: '#e2e8f0',
                            color: 'var(--text)',
                            borderRadius: '4px'
                          }}
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

          {/* Inline Edit Form */}
          {showForm && (
            <div
              style={{
                marginTop: '32px',
                padding: '24px',
                border: '2px solid var(--primary)',
                borderRadius: 'var(--radius)',
                background: '#ffffff'
              }}
            >
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 600 }}>
                {editingIndex !== null ? "Edit Experience Entry" : "Add Experience Entry"}
              </h3>

              <div className="form-grid">
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
                    placeholder="e.g. San Francisco, CA (or Remote)"
                  />
                </label>

                <div className="form-grid" style={{ gridColumn: 'span 2', padding: 0, gap: '12px' }}>
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
                      style={{ cursor: formCurrent ? 'not-allowed' : 'default' }}
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
                      style={{ cursor: formCurrent ? 'not-allowed' : 'default' }}
                    >
                      {yearsList.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '8px 0' }}>
                  <input
                    type="checkbox"
                    checked={formCurrent}
                    onChange={(e) => setFormCurrent(e.target.checked)}
                  />
                  <strong>Current Position (I currently work here)</strong>
                </label>

                <label className="field" style={{ gridColumn: 'span 2' }}>
                  <span>Description</span>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe your role, responsibilities, and achievements..."
                    rows={4}
                    style={{ width: '100%', fontFamily: 'inherit', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                  />
                </label>

                <label className="field" style={{ gridColumn: 'span 2' }}>
                  <span>Skills (comma-separated tags)</span>
                  <input
                    value={formSkillsText}
                    onChange={(e) => setFormSkillsText(e.target.value)}
                    placeholder="e.g. React, TypeScript, Node.js, AWS"
                  />
                </label>
              </div>

              {formError && (
                <p className="status-warn" style={{ marginTop: '16px', padding: '8px 12px', borderRadius: 'var(--radius)' }}>
                  {formError}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={handleSaveExperienceEntry}
                  type="button"
                  className="primary-link"
                  style={{ border: 'none', padding: '10px 20px', cursor: 'pointer' }}
                >
                  Save Entry
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  type="button"
                  className="primary-link"
                  style={{ background: '#e2e8f0', color: 'var(--text)', border: 'none', padding: '10px 20px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Target companies selection section */}
      <section className="workspace-section">
        <div className="section-bar">
          <div>
            <div className="section-label">Watchlist editor</div>
            <h2>Choose the companies your agent should monitor</h2>
            <p style={{ marginTop: '4px' }}>These employers shape your shortlist, alerts, and future job-match flows.</p>
          </div>
          <div className="filter-row">
            <button
              className={categoryFilter === "all" ? "filter-chip active" : "filter-chip"}
              onClick={() => setCategoryFilter("all")}
              type="button"
            >
              All
            </button>
            {Object.entries(categoryLabels).map(([category, label]) => (
              <button
                className={categoryFilter === category ? "filter-chip active" : "filter-chip"}
                key={category}
                onClick={() => setCategoryFilter(category as CompanyCategory)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-grid">
          {visibleCompanies.map((company) => {
            const selected = selectedCompanyIds.includes(company.id);

            return (
              <button
                className={selected ? "company-tile selected" : "company-tile"}
                key={company.id}
                onClick={() => toggleCompany(company.id)}
                type="button"
              >
                <div className="tile-top">
                  <strong>{company.name}</strong>
                  <span className="tile-badge">{categoryLabels[company.category]}</span>
                </div>
                <div className="tile-meta">
                  <span>Min CGPA {company.minCgpa ?? "Open"}</span>
                  <span>{company.avgPackageLpa ? `${company.avgPackageLpa} LPA avg` : "Package TBD"}</span>
                </div>
                <p>{company.eligibleBranches.join(", ")}</p>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
