"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { College, Company } from "@piaa/domain";
import { filterColleges, getCollegeByEmail } from "@piaa/domain";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../../../lib/supabase/client";
import { branchOptions } from "../../../lib/sprint-one";

type ProfileEditShellProps = {
  user: User;
  profile: any;
  initialCandidateProfile?: any;
  colleges?: College[];
  companies: Company[];
  initialSelectedCompanyIds: string[];
};

const currentYearVal = new Date().getFullYear();
const maxYear = currentYearVal + 5;
const batchYearOptions = Array.from({ length: maxYear - 2000 + 1 }, (_, i) => 2000 + i).reverse();

export function ProfileEditShell({
  user,
  profile: initialProfile,
  initialCandidateProfile,
  colleges = [],
}: ProfileEditShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);


  // -------------------------------------------------------------
  // Profile & Academic State
  // -------------------------------------------------------------
  const [profile, setProfile] = useState(initialProfile);
  const [fullName, setFullName] = useState(initialProfile.full_name ?? "");
  const [branch, setBranch] = useState(initialProfile.branch ?? "Computer Science");
  const [cgpa, setCgpa] = useState(initialProfile.cgpa?.toString() ?? "7.55");
  const [batchYear, setBatchYear] = useState(initialProfile.batch_year?.toString() ?? "2027");

  // Institution State
  const autoDetectedCollege = useMemo(() => getCollegeByEmail(user.email || ""), [user.email]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>(initialProfile.college_id ?? (autoDetectedCollege?.id || ""));
  const [customInstitutionName, setCustomInstitutionName] = useState<string>(initialProfile.custom_institution_name ?? "");
  const [collegeSearchQuery, setCollegeSearchQuery] = useState("");
  const [isSelectingCollege, setIsSelectingCollege] = useState(!initialProfile.college_id && !initialProfile.custom_institution_name);

  const filteredColleges = useMemo(() => {
    return filterColleges(colleges, collegeSearchQuery, 20);
  }, [colleges, collegeSearchQuery]);

  const currentInstitutionName = useMemo(() => {
    if (customInstitutionName) return customInstitutionName;
    if (selectedCollegeId) {
      const match = colleges.find((c) => c.id.toLowerCase() === selectedCollegeId.toLowerCase());
      if (match) return match.name;
    }
    if (autoDetectedCollege) return autoDetectedCollege.name;
    return "BITS Pilani";
  }, [customInstitutionName, selectedCollegeId, colleges, autoDetectedCollege]);

  // -------------------------------------------------------------
  // Resume & Candidate Profile State (from database / candidate_profiles)
  // -------------------------------------------------------------
  const [skills, setSkills] = useState<string[]>(
    Array.isArray(initialCandidateProfile?.skills) ? initialCandidateProfile.skills : []
  );

  const [experiences, setExperiences] = useState<any[]>(
    Array.isArray(initialCandidateProfile?.experience) ? initialCandidateProfile.experience : []
  );
  const [preferredRoles, setPreferredRoles] = useState<string[]>(
    Array.isArray(initialCandidateProfile?.preferred_roles) && initialCandidateProfile.preferred_roles.length > 0
      ? initialCandidateProfile.preferred_roles
      : []
  );
  const [preferredLocations, setPreferredLocations] = useState<string[]>(
    Array.isArray(initialCandidateProfile?.preferred_locations)
      ? initialCandidateProfile.preferred_locations
      : initialCandidateProfile?.preferred_location
      ? [initialCandidateProfile.preferred_location]
      : []
  );
  const [preferredIndustries, setPreferredIndustries] = useState<string[]>(
    Array.isArray(initialCandidateProfile?.preferred_industries) ? initialCandidateProfile.preferred_industries : []
  );
  const [expectedCtc, setExpectedCtc] = useState<string>("12 – 20 LPA");
  const [willingToRelocate, setWillingToRelocate] = useState<string>("Yes");

  const [socialLinks, setSocialLinks] = useState<{ linkedin?: string; github?: string; portfolio?: string }>({
    linkedin: initialCandidateProfile?.personal?.linkedin || "",
    github: initialCandidateProfile?.personal?.github || "",
    portfolio: initialCandidateProfile?.personal?.portfolio || initialCandidateProfile?.personal?.website || "",
  });


  // Modal Control States
  const [activeModal, setActiveModal] = useState<"profile" | "skills" | "experience" | "preferences" | "links" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Skill Editor Input
  const [newSkillInput, setNewSkillInput] = useState("");

  // Experience Form Fields
  const [expTitle, setExpTitle] = useState("");
  const [expCompany, setExpCompany] = useState("");
  const [expEmploymentType, setExpEmploymentType] = useState("Full-time");
  const [expLocation, setExpLocation] = useState("");
  const [expStartYear, setExpStartYear] = useState(new Date().getFullYear());
  const [expEndYear, setExpEndYear] = useState(new Date().getFullYear());
  const [expCurrent, setExpCurrent] = useState(false);
  const [expDescription, setExpDescription] = useState("");

  // -------------------------------------------------------------
  // Load Candidate Profile from Backend
  // -------------------------------------------------------------
  useEffect(() => {
    async function loadResumeProfile() {
      try {
        const res = await fetch(`/api/careerpilot/resume?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            if (Array.isArray(data.skills) && data.skills.length > 0) {
              setSkills(data.skills);
            }
            if (Array.isArray(data.experience)) {
              setExperiences(data.experience);
            }
            if (Array.isArray(data.preferredRoles) && data.preferredRoles.length > 0) {
              setPreferredRoles(data.preferredRoles);
            }
            if (Array.isArray(data.preferredLocations) && data.preferredLocations.length > 0) {
              setPreferredLocations(data.preferredLocations);
            } else if (data.preferredLocation) {
              setPreferredLocations([data.preferredLocation]);
            }
            if (Array.isArray(data.preferredIndustries) && data.preferredIndustries.length > 0) {
              setPreferredIndustries(data.preferredIndustries);
            }
            if (data.personal && typeof data.personal === "object") {
              setSocialLinks({
                linkedin: data.personal.linkedin || "",
                github: data.personal.github || "",
                portfolio: data.personal.portfolio || data.personal.website || "",
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch resume profile:", err);
      }
    }
    loadResumeProfile();
  }, []);

  // Compute initials
  const initials = useMemo(() => {
    const clean = (fullName || user.email || "Candidate").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, [fullName, user.email]);

  const targetFocus = useMemo(() => {
    if (preferredRoles.length > 0) return preferredRoles[0];
    return "Software Engineering";
  }, [preferredRoles]);

  // -------------------------------------------------------------
  // SAVE HANDLERS
  // -------------------------------------------------------------
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    try {
      // 1. Update students table in Supabase
      const { error: studentErr } = await supabase
        .from("students")
        .update({
          full_name: fullName,
          branch,
          cgpa: parseFloat(cgpa) || 8.0,
          batch_year: parseInt(batchYear, 10) || 2027,
          college_id: selectedCollegeId || null,
          custom_institution_name: customInstitutionName || null,
        })
        .eq("id", user.id);

      if (studentErr) throw studentErr;

      setProfile((prev: any) => ({
        ...prev,
        full_name: fullName,
        branch,
        cgpa,
        batch_year: batchYear,
        college_id: selectedCollegeId,
        custom_institution_name: customInstitutionName,
      }));

      setActiveModal(null);
      setSaveStatus("Profile saved successfully");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      console.error("Failed to save profile:", err);
      setSaveStatus(`Error: ${err.message || "Failed to save profile"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSaveSkills = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/careerpilot/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills }),
      });
      setActiveModal(null);
      setSaveStatus("Skills updated successfully");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Failed to update skills:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expCompany.trim()) return;

    const newExp = {
      title: expTitle.trim(),
      company: expCompany.trim(),
      employmentType: expEmploymentType,
      location: expLocation.trim(),
      startYear: expStartYear,
      endYear: expCurrent ? "Present" : expEndYear,
      current: expCurrent,
      description: expDescription.trim(),
    };

    const updated = [...experiences, newExp];
    setExperiences(updated);

    try {
      await fetch("/api/careerpilot/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience: updated }),
      });
    } catch (err) {
      console.error("Failed to update experience:", err);
    }

    setExpTitle("");
    setExpCompany("");
    setExpLocation("");
    setExpDescription("");
    setActiveModal(null);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await fetch("/api/careerpilot/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRoles,
          preferredIndustries,
          preferredLocation: preferredLocations[0] || "Remote",
        }),
      });
      setActiveModal(null);
      setSaveStatus("Preferences updated");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Failed to update preferences:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await fetch("/api/careerpilot/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personal: socialLinks,
        }),
      });
      setActiveModal(null);
      setSaveStatus("Social links updated");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Failed to update links:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      // 1. Update students table in Supabase
      const { error: studentErr } = await supabase
        .from("students")
        .update({
          full_name: fullName,
          branch,
          cgpa: parseFloat(cgpa) || 8.0,
          batch_year: parseInt(batchYear, 10) || 2027,
          college_id: selectedCollegeId || null,
          custom_institution_name: customInstitutionName || null,
        })
        .eq("id", user.id);

      if (studentErr) throw studentErr;

      // 2. Update candidate_profiles in Nest API
      await fetch("/api/careerpilot/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills,
          experience: experiences,
          preferredRoles,
          preferredIndustries,
          preferredLocation: preferredLocations[0] || "Remote",
        }),
      });

      setSaveStatus("Profile saved! Entering Dashboard...");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Failed to complete profile:", err);
      setSaveStatus(`Error saving: ${err.message || "Please check your network"}`);
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1160px", margin: "0 auto" }}>
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER                                                 */}
      {/* ------------------------------------------------------------- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            My Profile
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.88rem" }}>
            Manage your academic background, skills, and career preferences. This helps CareerPilot find the best opportunities for you.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveModal("profile")}
            className="primary-link ghost-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.82rem",
              padding: "8px 14px",
              borderRadius: "8px",
              fontWeight: 600,
            }}
          >
            ✏️ Edit Profile
          </button>

          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={isSaving}
            className="primary-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.85rem",
              padding: "8px 20px",
              borderRadius: "8px",
              fontWeight: 700,
              background: "var(--good)",
              color: "#022c22",
              cursor: "pointer",
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>



      {saveStatus && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: saveStatus.includes("Error") ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
            border: `1px solid ${saveStatus.includes("Error") ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
            color: saveStatus.includes("Error") ? "#ef4444" : "var(--good)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {saveStatus}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO IDENTITY BANNER (Glassmorphism & Radial Glow)         */}
      {/* ------------------------------------------------------------- */}
      <section
        style={{
          position: "relative",
          borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.85) 50%, rgba(99, 102, 241, 0.08) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
          boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Left: Avatar & Identity Details */}
        <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Avatar Circle with Verified Checkmark */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
                border: "2px solid rgba(16, 185, 129, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#34d399",
                fontWeight: 900,
                fontSize: "1.6rem",
                boxShadow: "0 4px 16px rgba(16, 185, 129, 0.2)",
              }}
            >
              {initials}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "0",
                right: "0",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "var(--good)",
                color: "#022c22",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 900,
                border: "2.5px solid #0f172a",
              }}
              title="Academic Identity Verified"
            >
              ✓
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
              {fullName || "Student Candidate"}
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem", color: "var(--muted)" }}>
              <span>✉️</span>
              <span>{user.email}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              <span>🏛️</span>
              <span>{currentInstitutionName}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <span
                style={{
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: "rgba(168, 85, 247, 0.15)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  color: "#c084fc",
                }}
              >
                {branch}
              </span>
              <span
                style={{
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "var(--good)",
                }}
              >
                {batchYear}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Career Focus Tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "16px 20px",
            borderRadius: "12px",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <span style={{ fontSize: "1.6rem" }}>🎯</span>
          <div>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
              Building a career in
            </span>
            <strong style={{ fontSize: "1.05rem", color: "var(--good)", fontWeight: 700 }}>
              {targetFocus}
            </strong>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. OVERVIEW (4 KPI Snapshot Cards)                            */}
      {/* ------------------------------------------------------------- */}
      <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
          Overview
        </h2>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "-6px" }}>
          Quick snapshot of your profile
        </span>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginTop: "6px",
          }}
        >
          {/* Card 1: Education */}
          <article
            className="panel"
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#60a5fa",
                  fontSize: "0.95rem",
                }}
              >
                🎓
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Education</span>
            </div>

            <div style={{ marginTop: "12px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{currentInstitutionName}</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "2px 0 0" }}>{branch}</p>
              <div style={{ marginTop: "8px" }}>

                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "rgba(59, 130, 246, 0.1)",
                    color: "#93c5fd",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                  }}
                >
                  {parseInt(batchYear, 10) - 4} – {batchYear}
                </span>
              </div>
            </div>
          </article>

          {/* Card 2: Target Role */}
          <article
            className="panel"
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--good)",
                  fontSize: "0.95rem",
                }}
              >
                💼
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Target Role</span>
            </div>

            <div style={{ marginTop: "12px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{preferredRoles[0] || "Software Engineer"}</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "2px 0 0" }}>Full-time • Entry Level</p>
              <div style={{ marginTop: "8px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "var(--good)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                  }}
                >
                  Preferred
                </span>
              </div>
            </div>
          </article>

          {/* Card 3: Location Preference */}
          <article
            className="panel"
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(236, 72, 153, 0.12)",
                  border: "1px solid rgba(236, 72, 153, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f472b6",
                  fontSize: "0.95rem",
                }}
              >
                📍
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Location Preference</span>
            </div>

            <div style={{ marginTop: "12px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{preferredLocations[0] || "Bengaluru, India"}</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "2px 0 0" }}>Open to Remote</p>
              <div style={{ marginTop: "8px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "rgba(168, 85, 247, 0.1)",
                    color: "#c084fc",
                    border: "1px solid rgba(168, 85, 247, 0.2)",
                  }}
                >
                  Flexible
                </span>
              </div>
            </div>
          </article>

          {/* Card 4: Current CGPA */}
          <article
            className="panel"
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(168, 85, 247, 0.12)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#c084fc",
                  fontSize: "0.95rem",
                }}
              >
                📄
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Current CGPA</span>
            </div>

            <div style={{ marginTop: "12px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{Number.parseFloat(cgpa || "0").toFixed(2)} / 10</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "2px 0 0" }}>Academic Registry</p>
              <div style={{ marginTop: "8px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "var(--good)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                  }}
                >
                  Good
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. CORE TWO-COLUMN GRID                                       */}
      {/* ------------------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        {/* ========================================================= */}
        {/* LEFT COLUMN: Skills & Work Experience                     */}
        {/* ========================================================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Section: Skills & Technologies */}
          <section className="panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                  Skills & Technologies
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Technologies and tools you work with</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("skills")}
                className="primary-link ghost-link"
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ✏️ Edit Skills
              </button>
            </div>

            {skills.length === 0 ? (
              <div style={{ padding: "16px 8px", color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
                  No skills added yet. Add your core languages, frameworks, and tools or upload your resume to auto-extract them.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveModal("skills")}
                  className="primary-link"
                  style={{ fontSize: "0.78rem", padding: "5px 14px", borderRadius: "8px" }}
                >
                  + Add Skills
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {skills.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      padding: "4px 12px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--line)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </section>


          {/* Section: Work Experience */}
          <section className="panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(59, 130, 246, 0.12)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#60a5fa",
                    fontSize: "0.9rem",
                  }}
                >
                  💼
                </div>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                    Work Experience
                  </h3>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Your professional experience</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("experience")}
                className="primary-link ghost-link"
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ✏️ Edit
              </button>
            </div>

            {experiences.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 16px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    fontSize: "1.2rem",
                    color: "var(--muted)",
                  }}
                >
                  💼
                </div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px" }}>No work experience added yet</h4>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 auto 16px", maxWidth: "340px", lineHeight: 1.4 }}>
                  Add your internships, part-time jobs, or full-time work experience to improve your recommendations.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveModal("experience")}
                  className="primary-link"
                  style={{ fontSize: "0.82rem", padding: "6px 16px", borderRadius: "8px" }}
                >
                  + Add Experience
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {experiences.map((exp, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{exp.title || exp.role}</strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--accent)" }}>{exp.company}</div>
                      </div>
                      <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
                        {exp.startYear} – {exp.endYear || "Present"}
                      </span>
                    </div>
                    {exp.description && (
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.3 }}>
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Academic Details & Career Preferences       */}
        {/* ========================================================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Section: Academic Details */}
          <section className="panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#60a5fa",
                  fontSize: "0.9rem",
                }}
              >
                🎓
              </div>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                  Academic Details
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Your education journey</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Institution</span>
                <strong style={{ color: "var(--text-primary)" }}>{currentInstitutionName}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Branch / Stream</span>
                <strong style={{ color: "var(--text-primary)" }}>{branch}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Graduation Year</span>
                <strong style={{ color: "var(--text-primary)" }}>{batchYear}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--muted)" }}>CGPA</span>
                <strong style={{ color: "var(--good)" }}>{Number.parseFloat(cgpa || "0").toFixed(2)} / 10</strong>
              </div>
            </div>
          </section>

          {/* Section: Career Preferences */}
          <section className="panel" style={{ padding: "20px", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(236, 72, 153, 0.12)",
                    border: "1px solid rgba(236, 72, 153, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#f472b6",
                    fontSize: "0.9rem",
                  }}
                >
                  🎯
                </div>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                    Career Preferences
                  </h3>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>What you&apos;re looking for</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("preferences")}
                className="primary-link ghost-link"
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              >
                ✏️ Edit
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Preferred Job Roles</span>
                <strong style={{ color: "var(--text-primary)" }}>{preferredRoles.join(", ")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Preferred Locations</span>
                <strong style={{ color: "var(--text-primary)" }}>{preferredLocations.join(", ")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Preferred Industries</span>
                <strong style={{ color: "var(--text-primary)" }}>{preferredIndustries.join(", ")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: "8px" }}>
                <span style={{ color: "var(--muted)" }}>Expected Salary (CTC)</span>
                <strong style={{ color: "var(--text-primary)" }}>{expectedCtc}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--muted)" }}>Willing to Relocate</span>
                <strong style={{ color: "var(--good)" }}>{willingToRelocate}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: EDIT PROFILE & ACADEMICS                             */}
      {/* ------------------------------------------------------------- */}


      {activeModal === "profile" && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="panel"
            style={{
              maxWidth: "500px",
              width: "100%",
              borderRadius: "16px",
              padding: "24px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Edit Academic Profile</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="danger-action-btn"
                style={{ padding: "2px 8px", borderRadius: "6px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  College / Institution Name
                </label>
                <input
                  type="text"
                  value={customInstitutionName}
                  onChange={(e) => setCustomInstitutionName(e.target.value)}
                  placeholder="e.g. BITS Pilani"
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Branch / Major
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  >
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Graduation Year
                  </label>
                  <select
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  >
                    {batchYearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  CGPA (out of 10)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="primary-link ghost-link"
                  style={{ padding: "6px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="primary-link"
                  style={{ padding: "6px 18px", borderRadius: "8px", background: "var(--good)", color: "#022c22", fontWeight: 700 }}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: EDIT SKILLS                                          */}
      {/* ------------------------------------------------------------- */}
      {activeModal === "skills" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="panel"
            style={{
              maxWidth: "520px",
              width: "100%",
              borderRadius: "16px",
              padding: "24px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Edit Skills & Technologies</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="danger-action-btn"
                style={{ padding: "2px 8px", borderRadius: "6px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="Add a new skill (e.g. Docker, Rust, PyTorch)..."
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                className="input-field"
                style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="primary-link"
                style={{ padding: "8px 16px", borderRadius: "8px" }}
              >
                Add
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxHeight: "240px", overflowY: "auto", padding: "4px 0" }}>
              {skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    padding: "4px 10px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--line)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="primary-link ghost-link"
                style={{ padding: "6px 14px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSkills}
                disabled={isSaving}
                className="primary-link"
                style={{ padding: "6px 18px", borderRadius: "8px", background: "var(--good)", color: "#022c22", fontWeight: 700 }}
              >
                {isSaving ? "Saving..." : "Save Skills"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: ADD/EDIT EXPERIENCE                                  */}
      {/* ------------------------------------------------------------- */}
      {activeModal === "experience" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="panel"
            style={{
              maxWidth: "500px",
              width: "100%",
              borderRadius: "16px",
              padding: "24px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Add Work Experience</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="danger-action-btn"
                style={{ padding: "2px 8px", borderRadius: "6px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExperience} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Role / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineering Intern"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google, Microsoft, Startup"
                  value={expCompany}
                  onChange={(e) => setExpCompany(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Start Year
                  </label>
                  <input
                    type="number"
                    value={expStartYear}
                    onChange={(e) => setExpStartYear(parseInt(e.target.value, 10) || 2024)}
                    className="input-field"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    End Year
                  </label>
                  <input
                    type="number"
                    value={expEndYear}
                    onChange={(e) => setExpEndYear(parseInt(e.target.value, 10) || 2025)}
                    disabled={expCurrent}
                    className="input-field"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Key Contributions & Technologies
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe your work, architecture contributions, and technologies used..."
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="primary-link ghost-link"
                  style={{ padding: "6px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-link"
                  style={{ padding: "6px 18px", borderRadius: "8px", background: "var(--good)", color: "#022c22", fontWeight: 700 }}
                >
                  Add Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: EDIT CAREER PREFERENCES                             */}
      {/* ------------------------------------------------------------- */}
      {activeModal === "preferences" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="panel"
            style={{
              maxWidth: "500px",
              width: "100%",
              borderRadius: "16px",
              padding: "24px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Edit Career Preferences</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="danger-action-btn"
                style={{ padding: "2px 8px", borderRadius: "6px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Preferred Job Roles (comma-separated)
                </label>
                <input
                  type="text"
                  value={preferredRoles.join(", ")}
                  onChange={(e) => setPreferredRoles(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Preferred Locations (comma-separated)
                </label>
                <input
                  type="text"
                  value={preferredLocations.join(", ")}
                  onChange={(e) => setPreferredLocations(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Preferred Industries (comma-separated)
                </label>
                <input
                  type="text"
                  value={preferredIndustries.join(", ")}
                  onChange={(e) => setPreferredIndustries(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  className="input-field"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Expected Salary (CTC)
                  </label>
                  <input
                    type="text"
                    value={expectedCtc}
                    onChange={(e) => setExpectedCtc(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Willing to Relocate
                  </label>
                  <select
                    value={willingToRelocate}
                    onChange={(e) => setWillingToRelocate(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--line)", color: "inherit" }}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Remote Only">Remote Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="primary-link ghost-link"
                  style={{ padding: "6px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="primary-link"
                  style={{ padding: "6px 18px", borderRadius: "8px", background: "var(--good)", color: "#022c22", fontWeight: 700 }}
                >
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

