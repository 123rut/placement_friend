"use client";

import Link from "next/link";
import { getCollegeByEmail } from "@piaa/domain";
import type { College, Company, CompanyCategory, StudentProfile } from "@piaa/domain";
import { useMemo, useState } from "react";
import { branchOptions, categoryLabels } from "../lib/sprint-one";

import type { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";

type SprintOneShellProps = {
  colleges: College[];
  companies: Company[];
  user: User;
  existingProfile: any;
};

const batchYearOptions = [2026, 2027, 2028, 2029];

export function SprintOneShell({
  colleges,
  companies,
  user,
  existingProfile
}: SprintOneShellProps) {
  const [email, setEmail] = useState(user.email ?? "");
  const [fullName, setFullName] = useState(existingProfile?.full_name ?? "");
  const [branch, setBranch] = useState(existingProfile?.branch ?? "Computer Science");
  const [cgpa, setCgpa] = useState(existingProfile?.cgpa?.toString() ?? "8.0");
  const [batchYear, setBatchYear] = useState(existingProfile?.batch_year?.toString() ?? "2026");
  const [categoryFilter, setCategoryFilter] = useState<CompanyCategory | "all">("all");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage("");
    const supabase = createClient();
    const college = getCollegeByEmail(email);
    
    if (!college) {
      setMessage("Error: Invalid college email.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from('students').upsert({
      id: user.id,
      full_name: fullName,
      college_email: email,
      college_id: college.id,
      branch,
      cgpa: parseFloat(cgpa),
      batch_year: parseInt(batchYear),
      is_verified: true,
      updated_at: new Date().toISOString()
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Profile saved successfully!");
    }
    setIsSaving(false);
  };

  const detectedCollege = useMemo(() => getCollegeByEmail(email), [email]);

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
          <div className="topbar-kicker">Sprint 1</div>
          <h1>Placement & Internship Alert Agent</h1>
        </div>
        <nav className="topbar-actions">
          <span className="pill">College email auth</span>
          <span className="pill">100 seeded companies</span>
          <Link className="primary-link" href="/dashboard">
            Open foundation dashboard
          </Link>
        </nav>
      </header>

      <section className="workspace-section intro-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Access</div>
              <h2>College email verification</h2>
            </div>
            <span className={detectedCollege ? "status-good" : "status-warn"}>
              {detectedCollege ? "Domain matched" : "College domain required"}
            </span>
          </div>

          <label className="field">
            <span>College email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@college.edu"
              type="email"
            />
          </label>

          <div className="summary-grid">
            <div>
              <div className="summary-label">Detected college</div>
              <div className="summary-value">
                {detectedCollege ? detectedCollege.name : "No mapped college yet"}
              </div>
            </div>
            <div>
              <div className="summary-label">Verification mode</div>
              <div className="summary-value">Supabase magic link / OTP</div>
            </div>
          </div>

          <p className="panel-note">
            {detectedCollege
              ? `Domain ${detectedCollege.emailDomain} maps to ${detectedCollege.city}, ${detectedCollege.state}.`
              : `Currently mapped colleges: ${colleges.length}. Add more domains in the Sprint 1 seed set as onboarding expands.`}
          </p>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Profile</div>
              <h2>Student setup</h2>
            </div>
            <span className="status-good">Profile ready</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>

            <label className="field">
              <span>Branch</span>
              <select value={branch} onChange={(event) => setBranch(event.target.value)}>
                {branchOptions.map((option) => (
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
              />
            </label>

            <label className="field">
              <span>Batch year</span>
              <select value={batchYear} onChange={(event) => setBatchYear(event.target.value)}>
                {batchYearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button 
              onClick={handleSaveProfile} 
              disabled={isSaving}
              style={{ padding: '8px 16px', background: 'var(--blue-500)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
            {message && <span style={{ marginLeft: '12px', color: message.includes('Error') ? 'red' : 'green' }}>{message}</span>}
          </div>

          <div className="summary-grid" style={{ marginTop: '24px' }}>
            <div>
              <div className="summary-label">Eligible company preview</div>
              <div className="summary-value">{eligiblePreviewCount} matches in current seed set</div>
            </div>
            <div>
              <div className="summary-label">Tracked companies</div>
              <div className="summary-value">{selectedCompanyIds.length} selected</div>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-bar">
          <div>
            <div className="section-label">Seed catalog</div>
            <h2>Top 100 company base</h2>
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
