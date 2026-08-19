"use client";

import React, { useState } from "react";

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}

export function getCompanyInitials(name: string): string {
  if (!name || !name.trim()) return "CP";
  const clean = name.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export default function CompanyLogo({
  name,
  logoUrl,
  size = 44,
  className = "",
}: CompanyLogoProps) {
  const [imageError, setImageError] = useState(false);
  const initials = getCompanyInitials(name);

  return (
    <div
      className={`company-logo-badge ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: "10px",
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#f8fafc",
        fontWeight: 800,
        fontSize: size <= 36 ? "0.75rem" : "0.95rem",
        letterSpacing: "-0.5px",
        userSelect: "none",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
      }}
      title={name}
    >
      {logoUrl && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          onError={() => setImageError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: "4px",
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
