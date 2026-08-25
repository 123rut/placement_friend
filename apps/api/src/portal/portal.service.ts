import { Injectable, Inject, HttpException, HttpStatus } from "@nestjs/common";
import { Pool } from "pg";
import { DB_POOL } from "../db/db.module";
import { LogicalJobKey } from "../classifier/logical-job-key";


@Injectable()
export class PortalService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  // 1. Opportunities Endpoints
  async getOpportunities(studentId: string) {
    // Fetch student profile
    const studentRes = await this.pool.query(
      `SELECT s.*, c.name as college_name 
       FROM students s
       LEFT JOIN colleges c ON s.college_id = c.id
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

    // Fetch jobs for tracked companies with user-specific tracking status (excluding dismissed jobs)
    const jobsRes = await this.pool.query(
      `SELECT j.id,
              j.company_id,
              j.title AS role,
              j.employment_type AS role_type,
              j.url AS apply_url,
              j.created_at AS posted_at,
              j.location,
              j.logical_job_key,
              c.name as company_name,
              c.min_cgpa,
              c.eligible_branches,
              COALESCE(ot.status, 'NOT_VIEWED') AS status,
              COALESCE(ot.is_saved, FALSE) AS is_saved,
              ot.saved_at,
              ot.viewed_at,
              ot.applied_at
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       LEFT JOIN opportunity_tracking ot ON ot.job_id = j.id AND ot.student_id = $2
       LEFT JOIN student_job_dismissals sjd ON sjd.student_id = $2 AND (
         sjd.job_id = j.id OR
         (j.logical_job_key IS NOT NULL AND sjd.logical_job_key = j.logical_job_key)
       )
       WHERE j.company_id = ANY($1::text[])
         AND (j.relevance_status = 'APPROVED' OR j.relevance_status IS NULL)
         AND sjd.id IS NULL
       ORDER BY j.created_at DESC`,
      [trackedCompanyIds, studentId]
    );

    const matchedOpportunities: any[] = [];
    const seen = new Set<string>();

    for (const job of jobsRes.rows) {
      const key =
        job.logical_job_key ||
        LogicalJobKey.generate(job.company_name || "", job.role || "", job.location || "global");
      if (seen.has(key)) continue;
      seen.add(key);


      const rawBranches = job.eligible_branches ? String(job.eligible_branches) : "";
      const allowedBranches = rawBranches.replace(/[{}"']/g, "").split(",").map(b => b.trim()).filter(Boolean);

      matchedOpportunities.push({
        id: job.id,
        job_id: job.id,
        company_name: job.company_name,
        title: job.role,
        role: job.role,
        role_type: job.role_type,
        employment_type: job.role_type,
        min_cgpa: job.min_cgpa ? parseFloat(job.min_cgpa) : null,
        allowed_branches: allowedBranches,
        deadline: null,
        url: job.apply_url,
        apply_url: job.apply_url,
        posted_at: job.posted_at,
        location: job.location,
        status: job.status || "NOT_VIEWED",
        is_saved: !!job.is_saved,
        saved_at: job.saved_at ? new Date(job.saved_at).toISOString() : null,
        viewed_at: job.viewed_at ? new Date(job.viewed_at).toISOString() : null,
        applied_at: job.applied_at ? new Date(job.applied_at).toISOString() : null,
      });
    }

    return { data: matchedOpportunities };
  }

  async markOpportunityViewed(jobId: string, studentId: string) {
    if (!studentId) {
      throw new HttpException("Student ID is required", HttpStatus.BAD_REQUEST);
    }

    const studentRes = await this.pool.query(
      "SELECT id FROM students WHERE id = $1",
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      throw new HttpException("Student profile not found", HttpStatus.NOT_FOUND);
    }

    const jobRes = await this.pool.query(
      "SELECT id FROM jobs WHERE id = $1",
      [jobId]
    );
    if (jobRes.rows.length === 0) {
      throw new HttpException("Opportunity not found", HttpStatus.NOT_FOUND);
    }

    const res = await this.pool.query(
      `INSERT INTO opportunity_tracking (student_id, job_id, status, viewed_at, created_at, updated_at)
       VALUES ($1, $2, 'VIEWED', NOW(), NOW(), NOW())
       ON CONFLICT (student_id, job_id)
       DO UPDATE SET
         status = CASE WHEN opportunity_tracking.status = 'APPLIED' THEN 'APPLIED' ELSE 'VIEWED' END,
         viewed_at = COALESCE(opportunity_tracking.viewed_at, NOW()),
         updated_at = NOW()
       RETURNING *`,
      [studentId, jobId]
    );

    return {
      success: true,
      data: {
        id: res.rows[0].id,
        job_id: res.rows[0].job_id,
        student_id: res.rows[0].student_id,
        status: res.rows[0].status,
        is_saved: !!res.rows[0].is_saved,
        viewed_at: res.rows[0].viewed_at,
        applied_at: res.rows[0].applied_at,
      }
    };
  }

  async markOpportunityApplied(jobId: string, studentId: string) {
    if (!studentId) {
      throw new HttpException("Student ID is required", HttpStatus.BAD_REQUEST);
    }

    const studentRes = await this.pool.query(
      "SELECT id FROM students WHERE id = $1",
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      throw new HttpException("Student profile not found", HttpStatus.NOT_FOUND);
    }

    const jobRes = await this.pool.query(
      "SELECT id FROM jobs WHERE id = $1",
      [jobId]
    );
    if (jobRes.rows.length === 0) {
      throw new HttpException("Opportunity not found", HttpStatus.NOT_FOUND);
    }

    const res = await this.pool.query(
      `INSERT INTO opportunity_tracking (student_id, job_id, status, viewed_at, applied_at, created_at, updated_at)
       VALUES ($1, $2, 'APPLIED', NOW(), NOW(), NOW(), NOW())
       ON CONFLICT (student_id, job_id)
       DO UPDATE SET
         status = 'APPLIED',
         applied_at = COALESCE(opportunity_tracking.applied_at, NOW()),
         viewed_at = COALESCE(opportunity_tracking.viewed_at, NOW()),
         updated_at = NOW()
       RETURNING *`,
      [studentId, jobId]
    );

    return {
      success: true,
      data: {
        id: res.rows[0].id,
        job_id: res.rows[0].job_id,
        student_id: res.rows[0].student_id,
        status: res.rows[0].status,
        is_saved: !!res.rows[0].is_saved,
        viewed_at: res.rows[0].viewed_at,
        applied_at: res.rows[0].applied_at,
      }
    };
  }

  async markOpportunitySaved(jobId: string, studentId: string) {
    if (!studentId) {
      throw new HttpException("Student ID is required", HttpStatus.BAD_REQUEST);
    }

    const studentRes = await this.pool.query(
      "SELECT id FROM students WHERE id = $1",
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      throw new HttpException("Student profile not found", HttpStatus.NOT_FOUND);
    }

    const jobRes = await this.pool.query(
      "SELECT id FROM jobs WHERE id = $1",
      [jobId]
    );
    if (jobRes.rows.length === 0) {
      throw new HttpException("Opportunity not found", HttpStatus.NOT_FOUND);
    }

    const res = await this.pool.query(
      `INSERT INTO opportunity_tracking (student_id, job_id, status, is_saved, saved_at, created_at, updated_at)
       VALUES ($1, $2, 'VIEWED', TRUE, NOW(), NOW(), NOW())
       ON CONFLICT (student_id, job_id)
       DO UPDATE SET
         is_saved = TRUE,
         saved_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [studentId, jobId]
    );

    return {
      success: true,
      data: {
        job_id: res.rows[0].job_id,
        student_id: res.rows[0].student_id,
        is_saved: true,
        saved_at: res.rows[0].saved_at,
        status: res.rows[0].status,
      }
    };
  }


  async unmarkOpportunitySaved(jobId: string, studentId: string) {

    await this.pool.query(
      `UPDATE opportunity_tracking
       SET is_saved = FALSE, updated_at = NOW()
       WHERE student_id = $1 AND job_id = $2`,
      [studentId, jobId]
    );

    return {
      success: true,
      data: {
        job_id: jobId,
        student_id: studentId,
        is_saved: false,
      }
    };
  }

  async getSavedOpportunities(studentId: string) {
    if (!studentId) {
      return { data: [] };
    }

    const res = await this.pool.query(
      `SELECT j.id,
              j.company_id,
              j.title AS role,
              j.employment_type AS role_type,
              j.url AS apply_url,
              j.created_at AS posted_at,
              j.location,
              j.logical_job_key,
              c.name AS company_name,
              c.min_cgpa,
              c.eligible_branches,
              COALESCE(ot.status, 'NOT_VIEWED') AS status,
              COALESCE(ot.is_saved, FALSE) AS is_saved,
              ot.saved_at,
              ot.viewed_at,
              ot.applied_at,
              jm.match_score,
              jm.explanation,
              jm.strengths,
              jm.missing_skills
       FROM opportunity_tracking ot
       JOIN jobs j ON ot.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       LEFT JOIN job_matches jm ON jm.job_id = j.id AND jm.user_id::text = $1
       WHERE ot.student_id = $1
         AND (ot.is_saved = TRUE OR ot.status = 'APPLIED')
       ORDER BY ot.updated_at DESC`,
      [studentId]
    );


    const data = res.rows.map((job: any) => {
      const rawBranches = job.eligible_branches ? String(job.eligible_branches) : "";
      const allowedBranches = rawBranches.replace(/[{}"']/g, "").split(",").map((b: string) => b.trim()).filter(Boolean);

      return {
        id: job.id,
        job_id: job.id,
        company_name: job.company_name,
        title: job.role,
        role: job.role,
        url: job.apply_url,
        apply_url: job.apply_url,
        role_type: job.role_type,
        employment_type: job.role_type,
        min_cgpa: job.min_cgpa ? parseFloat(job.min_cgpa) : null,
        allowed_branches: allowedBranches,
        posted_at: job.posted_at,
        location: job.location,
        status: job.status || "NOT_VIEWED",
        is_saved: !!job.is_saved,
        saved_at: job.saved_at ? new Date(job.saved_at).toISOString() : null,
        viewed_at: job.viewed_at ? new Date(job.viewed_at).toISOString() : null,
        applied_at: job.applied_at ? new Date(job.applied_at).toISOString() : null,
        match_score: typeof job.match_score === "number" ? job.match_score : null,
        matchScore: typeof job.match_score === "number" ? job.match_score : null,
        explanation: job.explanation || "",
        strengths: Array.isArray(job.strengths) ? job.strengths : [],
        missing_skills: Array.isArray(job.missing_skills) ? job.missing_skills : [],
        missingSkills: Array.isArray(job.missing_skills) ? job.missing_skills : [],
      };
    });

    return { data };
  }

  async dismissOpportunity(jobId: string, studentId: string) {

    if (!studentId) {
      throw new HttpException("Student ID is required", HttpStatus.BAD_REQUEST);
    }

    const jobRes = await this.pool.query(
      "SELECT id, logical_job_key FROM jobs WHERE id = $1",
      [jobId]
    );
    if (jobRes.rows.length === 0) {
      throw new HttpException("Opportunity not found", HttpStatus.NOT_FOUND);
    }

    const logicalKey = jobRes.rows[0].logical_job_key || null;

    await this.pool.query(
      `INSERT INTO student_job_dismissals (student_id, job_id, logical_job_key, dismissed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (student_id, job_id) DO NOTHING`,
      [studentId, jobId, logicalKey]
    );

    return { success: true, message: "Opportunity dismissed successfully." };
  }

  async restoreOpportunity(jobId: string, studentId: string) {
    if (!studentId) {
      throw new HttpException("Student ID is required", HttpStatus.BAD_REQUEST);
    }

    const jobRes = await this.pool.query(
      "SELECT id, logical_job_key FROM jobs WHERE id = $1",
      [jobId]
    );
    const logicalKey = jobRes.rows[0]?.logical_job_key;

    if (logicalKey) {
      await this.pool.query(
        `DELETE FROM student_job_dismissals
         WHERE student_id = $1 AND (job_id = $2 OR logical_job_key = $3)`,
        [studentId, jobId, logicalKey]
      );
    } else {
      await this.pool.query(
        `DELETE FROM student_job_dismissals
         WHERE student_id = $1 AND job_id = $2`,
        [studentId, jobId]
      );
    }

    return { success: true, message: "Opportunity restored successfully." };
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
