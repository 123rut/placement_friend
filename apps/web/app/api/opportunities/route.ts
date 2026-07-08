import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { pool } from "../../../../worker/src/db";
import { matchStudentToOpportunity, StudentProfile, Opportunity } from "@piaa/domain";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch student profile
    const studentRes = await pool.query(
      `SELECT s.*, c.name as college_name 
       FROM students s
       JOIN colleges c ON s.college_id = c.id
       WHERE s.id = $1`,
      [user.id]
    );
    const student = studentRes.rows[0];
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    // Fetch targets
    const targetsRes = await pool.query(
      "SELECT company_id FROM student_company_targets WHERE student_id = $1",
      [user.id]
    );
    const trackedCompanyIds = targetsRes.rows.map(r => r.company_id);

    if (trackedCompanyIds.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    // Fetch jobs for tracked companies
    const jobsRes = await pool.query(
      `SELECT j.id,
              j.company_id,
              j.title AS role,
              j.employment_type AS role_type,
              j.url AS apply_url,
              j.created_at AS posted_at,
              j.location,
              c.name as company_name,
              c.min_cgpa,
              c.eligible_branches
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE j.company_id = ANY($1::text[])
       ORDER BY j.created_at DESC`,
      [trackedCompanyIds]
    );

    const studentProfile: StudentProfile = {
      id: student.id,
      fullName: student.full_name,
      email: student.college_email,
      collegeId: student.college_id,
      collegeName: student.college_name,
      branch: student.branch,
      cgpa: parseFloat(student.cgpa),
      batchYear: student.batch_year,
      isVerified: student.is_verified,
      trackedCompanyIds: trackedCompanyIds
    };

    const matchedOpportunities = [];

    for (const job of jobsRes.rows) {
      // Parse database branches constraint
      const rawBranches = job.eligible_branches ? String(job.eligible_branches) : "";
      const allowedBranches = rawBranches.replace(/[{}"']/g, "").split(",").map(b => b.trim()).filter(Boolean);

      const opportunity: Opportunity = {
        id: job.id,
        companyId: job.company_id,
        title: job.role,
        roleType: job.role_type === "internship" ? "internship" : "full-time",
        location: job.location || "Bengaluru",
        description: "",
        applicationUrl: job.apply_url,
        sourceUrl: job.apply_url,
        deadline: null,
        minCgpa: job.min_cgpa ? parseFloat(job.min_cgpa) : null,
        allowedBranches: allowedBranches,
        allowedBatchYears: [],
        postedAt: job.posted_at ? job.posted_at.toISOString() : new Date().toISOString()
      };

      const match = matchStudentToOpportunity(studentProfile, opportunity);
      if (match.qualifies) {
        matchedOpportunities.push({
          id: job.id,
          company_name: job.company_name,
          role: job.role,
          role_type: job.role_type,
          min_cgpa: job.min_cgpa ? parseFloat(job.min_cgpa) : null,
          allowed_branches: opportunity.allowedBranches,
          deadline: null,
          apply_url: job.apply_url,
          posted_at: job.posted_at
        });
      }
    }

    return NextResponse.json({ data: matchedOpportunities }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching matching opportunities:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
