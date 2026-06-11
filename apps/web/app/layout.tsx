import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Placement & Internship Alert Agent",
  description: "Centralized placement and internship alerts with eligibility-aware notifications."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
