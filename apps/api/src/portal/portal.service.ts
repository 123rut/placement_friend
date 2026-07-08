import { Injectable, Inject, HttpException, HttpStatus } from "@nestjs/common";
import { Pool } from "pg";
import { DB_POOL } from "../db/db.module";
import { matchStudentToOpportunity, StudentProfile, Opportunity } from "@piaa/domain";

@Injectable()
export class PortalService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  // 1. Opportunities Endpoints
  async getOpportunities(studentId: string) {
    // Fetch student profile
    const studentRes = await this.pool.query(
      `SELECT s.*, c.name as college_name 
       FROM students s
       JOIN colleges c ON s.college_id = c.id
       WHERE s.id = $1`,
      [studentId]
    );
    const student = studentRes.rows[0];
    if (!student) {
      throw new HttpException("Student profile not found", HttpStatus.NOT_FOUND);
    }

    // Fetch targets
    const targetsRes = await this.pool.query(
      "SELECT company_id FROM student_company_targets WHERE student_id = $1",
      [studentId]
    );
    const trackedCompanyIds = targetsRes.rows.map(r => r.company_id);

    if (trackedCompanyIds.length === 0) {
      return { data: [] };
    }

    // Fetch jobs for tracked companies
    const jobsRes = await this.pool.query(
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

    const matchedOpportunities: any[] = [];

    for (const job of jobsRes.rows) {
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
        postedAt: job.posted_at ? new Date(job.posted_at).toISOString() : new Date().toISOString()
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

    return { data: matchedOpportunities };
  }

  // 2. Notifications Endpoints
  async getNotifications(studentId: string, unreadOnly: boolean) {
    let query = `
      SELECT 
        a.id, 
        a.drive_id, 
        a.channel, 
        a.read, 
        a.sent_at,
        d.role,
        c.name as company_name
      FROM alerts_sent a
      JOIN drives d ON a.drive_id = d.id
      JOIN companies c ON d.company_id = c.id
      WHERE a.student_id = $1 AND a.channel = 'dashboard'
    `;

    const params: any[] = [studentId];

    if (unreadOnly) {
      query += " AND a.read = FALSE";
    }

    query += " ORDER BY a.sent_at DESC";

    const res = await this.pool.query(query, params);
    return { data: res.rows };
  }

  async updateNotification(alertId: string, studentId: string, read: boolean) {
    const res = await this.pool.query(
      `UPDATE alerts_sent
       SET read = $1
       WHERE id = $2 AND student_id = $3
       RETURNING *`,
      [read, alertId, studentId]
    );

    if (res.rows.length === 0) {
      throw new HttpException("Notification not found or access denied", HttpStatus.NOT_FOUND);
    }

    return { data: res.rows[0] };
  }

  async markAllNotificationsRead(studentId: string) {
    const res = await this.pool.query(
      `UPDATE alerts_sent
       SET read = TRUE
       WHERE student_id = $1 AND channel = 'dashboard' AND read = FALSE`,
      [studentId]
    );

    return { updated_count: res.rowCount || 0 };
  }

  // 3. Student Preferences Endpoints
  async updatePreferences(studentId: string, companyId: string, notifyEmail?: boolean, notifyDashboard?: boolean) {
    const emailPref = notifyEmail !== undefined ? notifyEmail : true;
    const dashboardPref = notifyDashboard !== undefined ? notifyDashboard : true;

    const res = await this.pool.query(
      `INSERT INTO student_company_targets (student_id, company_id, notify_email, notify_dashboard, created_at, added_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (student_id, company_id)
       DO UPDATE SET 
         notify_email = $3, 
         notify_dashboard = $4
       RETURNING *`,
      [studentId, companyId, emailPref, dashboardPref]
    );

    return {
      company_id: res.rows[0].company_id,
      notify_email: res.rows[0].notify_email,
      notify_dashboard: res.rows[0].notify_dashboard,
      updated_at: new Date().toISOString()
    };
  }

  // 4. System State Endpoints
  async setSystemState(studentId: string) {
    const studentRes = await this.pool.query(
      "SELECT id FROM students WHERE id = $1",
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      throw new HttpException("Student profile not found. Please complete your profile first.", HttpStatus.NOT_FOUND);
    }

    await this.pool.query(
      `INSERT INTO system_state (key, value, updated_at)
       VALUES ('active_student_id', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [studentId]
    );

    return { success: true, student_id: studentId };
  }

  async getSystemState() {
    const result = await this.pool.query(
      "SELECT value FROM system_state WHERE key = 'active_student_id'"
    );

    if (result.rows.length === 0) {
      return { active_student_id: null };
    }

    return { active_student_id: result.rows[0].value };
  }
}
