"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

const batchYearOptions = [2026, 2027, 2028, 2029];

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
          <div className="topbar-kicker">Settings</div>
          <h1>Edit Student Profile</h1>
        </div>
        <nav className="topbar-actions">
          <Link className="primary-link" style={{ background: 'var(--muted)' }} href="/dashboard">
            Back to Dashboard
          </Link>
        </nav>
      </header>

      <section className="workspace-section intro-grid">
        {/* Info panel */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Account details</div>
              <h2>Verified email domain</h2>
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
            College domains are matched against verified education institutions database. To update your college domain, please register a new account.
          </p>
        </div>

        {/* Profile editing form */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-label">Information</div>
              <h2>Student setup</h2>
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

      {/* Target companies selection section */}
      <section className="workspace-section">
        <div className="section-bar">
          <div>
            <div className="section-label">Seed catalog</div>
            <h2>Top 100 company base</h2>
            <p style={{ marginTop: '4px' }}>Select the companies you want to track for placement/internship drives.</p>
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
