import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db";
import { matchStudentToOpportunity, StudentProfile, Opportunity } from "@piaa/domain";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRATCH_DIR = path.join(__dirname, "../scratch");
const LOG_FILE_PATH = path.join(SCRATCH_DIR, "notifications_log.txt");

/**
 * Redacts PII before it ever touches a log file.
 * "Ruturaj Challawar" -> "R****** C*********"
 * "ruturajchallawar2811@gmail.com" -> "ru***@gmail.com"
 */
function redactName(fullName: string | null | undefined): string {
  if (!fullName) return "[no-name]";
  return fullName
    .split(" ")
    .map((part) => (part.length <= 1 ? part : part[0] + "*".repeat(part.length - 1)))
    .join(" ");
}

function redactEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "[no-email]";
  const [local, domain] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export interface NotifierSummary {
  studentsMatched: number;
  emailsDispatched: number;
  dashboardAlertsDispatched: number;
  skippedDuplicates: number;
}

export async function dispatchNotifications(): Promise<NotifierSummary> {
  console.log("Starting Notifier Engine...");
  
  const summary: NotifierSummary = {
    studentsMatched: 0,
    emailsDispatched: 0,
    dashboardAlertsDispatched: 0,
    skippedDuplicates: 0
  };

  // 1. Get last notifier run timestamp from DB
  let lastNotifierRun = new Date(Date.now() - 24 * 60 * 60 * 1000); // default 24h ago
  
  try {
    const timeRes = await pool.query(
      `SELECT value FROM system_state WHERE key = 'last_notifier_run'`
    );
    if (timeRes.rows.length > 0) {
      lastNotifierRun = new Date(timeRes.rows[0].value);
      console.log(`Last notifier run was at: ${lastNotifierRun.toISOString()}`);
    } else {
      console.log(`No last notifier run found. Defaulting to: ${lastNotifierRun.toISOString()}`);
      await pool.query(
        `INSERT INTO system_state (key, value) VALUES ('last_notifier_run', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [lastNotifierRun.toISOString()]
      );
    }
  } catch (err) {
    console.error("Error fetching system state. Using default timestamp.", err);
  }

  const currentRunTime = new Date();

  // 2. Fetch new drives scraped/created since last run
  const drivesRes = await pool.query(
    `SELECT d.*, c.name as company_name 
     FROM drives d
     JOIN companies c ON d.company_id = c.id
     WHERE d.created_at > $1`,
    [lastNotifierRun.toISOString()]
  );
  
  const newDrives = drivesRes.rows;
  console.log(`Found ${newDrives.length} new drives since last run.`);
  
  if (newDrives.length === 0) {
    // Update last run time to prevent backlog and exit early
    await pool.query(
      `INSERT INTO system_state (key, value) VALUES ('last_notifier_run', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [currentRunTime.toISOString()]
    );
    return summary;
  }

  // 3. Fetch active students & targets
  // Resolve student ID — same 3-layer logic as the pipeline worker
  let loggedInStudentId = process.env.LOGGED_IN_STUDENT_ID || process.env.STUDENT_ID || null;

  if (!loggedInStudentId) {
    try {
      const stateRes = await pool.query(
        "SELECT value FROM system_state WHERE key = 'active_student_id'"
      );
      if (stateRes.rows.length > 0) {
        loggedInStudentId = stateRes.rows[0].value;
        console.log(`[Notifier] Auto-detected student ID from system_state: ${loggedInStudentId}`);
      }
    } catch (err: any) {
      console.warn("[Notifier] Could not read active_student_id from system_state:", err.message);
    }
  }

  if (!loggedInStudentId) {
    try {
      const targetRes = await pool.query(
        `SELECT student_id FROM student_company_targets GROUP BY student_id ORDER BY COUNT(*) DESC LIMIT 1`
      );
      if (targetRes.rows.length > 0) {
        loggedInStudentId = targetRes.rows[0].student_id;
        console.log(`[Notifier] Auto-detected student ID from targets: ${loggedInStudentId}`);
      }
    } catch (err: any) {
      console.warn("[Notifier] Could not auto-detect student from targets:", err.message);
    }
  }

  const studentsQuery = loggedInStudentId
    ? `SELECT s.*, c.name as college_name 
       FROM students s
       JOIN colleges c ON s.college_id = c.id
       WHERE s.id = $1`
    : `SELECT s.*, c.name as college_name 
       FROM students s
       JOIN colleges c ON s.college_id = c.id`;

  const studentsRes = await pool.query(studentsQuery, loggedInStudentId ? [loggedInStudentId] : []);
  const students = studentsRes.rows;

  const targetsQuery = loggedInStudentId
    ? `SELECT * FROM student_company_targets WHERE student_id = $1`
    : `SELECT * FROM student_company_targets`;

  const targetsRes = await pool.query(targetsQuery, loggedInStudentId ? [loggedInStudentId] : []);
  const targets = targetsRes.rows;


  // Build target and channel preferences map per student
  const studentTargetsMap = new Map<string, string[]>();
  const channelPrefsMap = new Map<string, Map<string, { email: boolean; dashboard: boolean }>>();

  for (const t of targets) {
    // Tracked companies
    const companyIds = studentTargetsMap.get(t.student_id) || [];
    companyIds.push(t.company_id);
    studentTargetsMap.set(t.student_id, companyIds);

    // Channel configurations
    let compMap = channelPrefsMap.get(t.student_id);
    if (!compMap) {
      compMap = new Map();
      channelPrefsMap.set(t.student_id, compMap);
    }
    compMap.set(t.company_id, {
      email: t.notify_email ?? true,
      dashboard: t.notify_dashboard ?? true
    });
  }

  // Prepare scratch dir for logs
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  // 4. Match student profiles to new drives and dispatch alerts
  for (const student of students) {
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
      trackedCompanyIds: studentTargetsMap.get(student.id) || []
    };

    let matchedAny = false;

    for (const drive of newDrives) {
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
        matchedAny = true;

        // Fetch channel preferences for this specific target company
        const prefs = channelPrefsMap.get(student.id)?.get(drive.company_id) || {
          email: true,
          dashboard: true
        };

        // Channel 1: Dashboard Notification
        if (prefs.dashboard) {
          const isDup = await checkDuplicateAlert(student.id, drive.id, "dashboard");
          if (!isDup) {
            await pool.query(
              `INSERT INTO alerts_sent (student_id, drive_id, channel, read)
               VALUES ($1, $2, 'dashboard', FALSE)`,
              [student.id, drive.id]
            );
            summary.dashboardAlertsDispatched++;
          } else {
            summary.skippedDuplicates++;
          }
        }

        // Channel 2: Email Alert (Mock Log File)
        if (prefs.email) {
          const isDup = await checkDuplicateAlert(student.id, drive.id, "email");
          if (!isDup) {
            // Write to mock email log
            const emailBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[${new Date().toISOString()}] EMAIL ALERT
To:      ${redactEmail(student.college_email)}
Subject: New Opportunity: ${drive.role} at ${drive.company_name}

Hi ${redactName(student.full_name)},
A new placement drive matching your profile has been posted.

Company:  ${drive.company_name}
Role:     ${drive.role}
Type:     ${drive.type}
Source:   ${drive.source ?? "unknown"}
Min CGPA: ${drive.min_cgpa ?? "None"}
Branches: ${drive.allowed_branches ? drive.allowed_branches.join(", ") : "All"}
Deadline: ${drive.deadline ? new Date(drive.deadline).toLocaleDateString() : "N/A"}
Apply:    ${drive.apply_link}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            fs.appendFileSync(LOG_FILE_PATH, emailBlock, "utf8");

            await pool.query(
              `INSERT INTO alerts_sent (student_id, drive_id, channel, read, email_logged_at)
               VALUES ($1, $2, 'email', TRUE, NOW())`,
              [student.id, drive.id]
            );
            summary.emailsDispatched++;
          } else {
            summary.skippedDuplicates++;
          }
        }
      }
    }

    if (matchedAny) {
      summary.studentsMatched++;
    }
  }

  // 5. Update system timestamp for delta calculations
  await pool.query(
    `INSERT INTO system_state (key, value) VALUES ('last_notifier_run', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [currentRunTime.toISOString()]
  );

  console.log(`Notifier cycle completed. Summary:
  - Students Matched: ${summary.studentsMatched}
  - Mock Emails Logged: ${summary.emailsDispatched}
  - Dashboard Notifications: ${summary.dashboardAlertsDispatched}
  - Skipped Duplicates: ${summary.skippedDuplicates}
  `);

  return summary;
}

async function checkDuplicateAlert(
  studentId: string,
  driveId: string,
  channel: string
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM alerts_sent 
     WHERE student_id = $1 AND drive_id = $2 AND channel = $3`,
    [studentId, driveId, channel]
  );
  return res.rows.length > 0;
}

// Standalone execution trigger
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  dispatchNotifications()
    .then((summary) => {
      console.log("Standalone notifier completed successfully.");
      pool.end();
    })
    .catch((err) => {
      console.error("Notifier execution failed:", err);
      pool.end();
      process.exit(1);
    });
}
