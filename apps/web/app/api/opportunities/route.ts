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

    // Fetch drives for tracked companies
    const drivesRes = await pool.query(
      `SELECT d.*, c.name as company_name 
       FROM drives d
       JOIN companies c ON d.company_id = c.id
       WHERE d.company_id = ANY($1::text[])
       ORDER BY d.deadline ASC NULLS LAST, d.created_at DESC`,
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

    for (const drive of drivesRes.rows) {
      const opportunity: Opportunity = {
        id: drive.id,
        companyId: drive.company_id,
        title: drive.role,
        roleType: drive.type === "internship" ? "internship" : "full-time",
        location: "Bengaluru",
        description: "",
        applicationUrl: drive.apply_link,
        sourceUrl: drive.apply_link,
        deadline: drive.deadline ? drive.deadline.toISOString() : null,
        minCgpa: drive.min_cgpa ? parseFloat(drive.min_cgpa) : null,
        allowedBranches: drive.allowed_branches || [],
        allowedBatchYears: [],
        postedAt: drive.scraped_at.toISOString()
      };

      const match = matchStudentToOpportunity(studentProfile, opportunity);
      if (match.qualifies) {
        matchedOpportunities.push({
          id: drive.id,
          company_name: drive.company_name,
          role: drive.role,
          role_type: drive.type,
          min_cgpa: drive.min_cgpa ? parseFloat(drive.min_cgpa) : null,
          allowed_branches: opportunity.allowedBranches,
          deadline: drive.deadline,
          apply_url: drive.apply_link,
          posted_at: drive.scraped_at
        });
      }
    }

    return NextResponse.json({ data: matchedOpportunities }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching matching opportunities:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
