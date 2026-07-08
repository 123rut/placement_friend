"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import CareerPilotPanel from "./CareerPilotPanel";

interface Student {
  id: string;
  full_name: string;
  college_email: string;
  branch: string;
  cgpa: string;
  batch_year: number;
  colleges?: { name: string };
}

interface DashboardShellProps {
  student: Student;
  user: any;
  children: React.ReactNode;
}

export default function DashboardShell({ student, user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const agentCloseRef = useRef<HTMLButtonElement>(null);
  const agentToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileOpen && !isAgentOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMobileOpen(false);
      if (isAgentOpen) {
        setIsAgentOpen(false);
        agentToggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAgentOpen, isMobileOpen]);

  useEffect(() => {
    if (isAgentOpen) agentCloseRef.current?.focus();
  }, [isAgentOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const collegeName = student.colleges?.name || "Unknown College";
  const isAdmin = student.college_email?.toLowerCase().includes("admin");

  const navLinks = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      name: "Opportunities",
      href: "/opportunities",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    ...(isAdmin
      ? [
          {
            name: "ATS Registry",
            href: "/companies",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
        ]
      : []),
    {
      name: "Target Companies",
      href: "/watchlist",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      name: "Tune Profile",
      href: "/profile",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="authenticated-layout-container">
      {/* Mobile Top Navbar */}
      <header className="mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="logo-orb"></div>
          <span className="logo-text">CareerPilot</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="hamburger-btn"
          aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
          aria-controls="primary-sidebar"
          aria-expanded={isMobileOpen}
        >
          <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Main Sidebar */}
      <aside
        id="primary-sidebar"
        className={`sidebar-container ${isMobileOpen ? "mobile-open" : ""}`}
        aria-label="Primary navigation"
      >
        <div>
          <div className="sidebar-header">
            <div className="logo-orb"></div>
            <span className="logo-text">CareerPilot AI</span>
          </div>

          <nav className="sidebar-nav-links">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`sidebar-nav-link ${isActive ? "active" : ""}`}
                  onClick={() => setIsMobileOpen(false)}
                >
                  {link.icon}
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user-badge">
            <div className="user-avatar" title={student.full_name}>
              {getInitials(student.full_name)}
            </div>
            <div className="user-info">
              <span className="user-name">{student.full_name}</span>
              <span className="user-college" title={collegeName}>
                {collegeName}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="primary-link ghost-link"
            style={{ minHeight: "36px", padding: "6px 12px", width: "100%" }}
          >
            <svg style={{ width: "16px", height: "16px", marginRight: "8px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content page area */}
      <main className="main-content">{children}</main>

      {(isMobileOpen || isAgentOpen) && (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="Close open panel"
          onClick={() => {
            setIsMobileOpen(false);
            setIsAgentOpen(false);
            agentToggleRef.current?.focus();
          }}
        />
      )}

      {/* Persistent CareerPilot Agent Side Panel */}
      <div
        id="careerpilot-drawer"
        className={`agent-drawer-container ${isAgentOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="careerpilot-drawer-title"
        aria-hidden={!isAgentOpen}
      >
        <div className="agent-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="logo-orb" style={{ width: "16px", height: "16px" }}></div>
            <h3 id="careerpilot-drawer-title">CareerPilot Copilot</h3>
          </div>
          <button
            onClick={() => setIsAgentOpen(false)}
            className="close-drawer-btn"
            aria-label="Close CareerPilot Copilot"
            ref={agentCloseRef}
          >
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="agent-drawer-content">
          <CareerPilotPanel />
        </div>
      </div>

      {/* Floating Copilot Button */}
      <button
        onClick={() => setIsAgentOpen(!isAgentOpen)}
        className="agent-chat-toggle-btn"
        title="Open CareerPilot Agent"
        aria-label={isAgentOpen ? "Close CareerPilot Copilot" : "Open CareerPilot Copilot"}
        aria-controls="careerpilot-drawer"
        aria-expanded={isAgentOpen}
        ref={agentToggleRef}
      >
        <svg style={{ width: "24px", height: "24px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    </div>
  );
}
