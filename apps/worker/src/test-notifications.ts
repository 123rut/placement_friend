import { pool } from "./db";
import { dispatchNotifications } from "./notifier";

async function runTests() {
  console.log("==================================================");
  console.log("         NOTIFICATIONS & MATCHING TEST SUITE      ");
  console.log("==================================================");

  const testStudentId = "test-student-sprint3";
  const testCompanyId = "google"; // Preseeded in seed_companies.sql
  const driveId1 = "test-drive-1"; // Matching
  const driveId2 = "test-drive-2"; // Non-matching (CGPA too high)
  const driveId3 = "test-drive-3"; // Non-matching (Branch mismatch)

  try {
    // 0. Clean up any leftover test data
    await cleanup(testStudentId, [driveId1, driveId2, driveId3]);

    // 1. Seed a test student (Branch: Computer Science, CGPA: 8.5)
    console.log("Seeding test student...");
    await pool.query(
      `INSERT INTO students (id, full_name, college_email, college_id, branch, cgpa, batch_year, is_verified)
       VALUES ($1, 'Test Student', 'test-student-sprint3@sggs.ac.in', 'sggs-nanded', 'Computer Science', 8.5, 2026, TRUE)`,
      [testStudentId]
    );

    // 2. Map tracking preferences (Google)
    console.log("Seeding company target preferences...");
    await pool.query(
      `INSERT INTO student_company_targets (student_id, company_id, notify_email, notify_dashboard, added_at)
       VALUES ($1, $2, TRUE, TRUE, NOW())`,
      [testStudentId, testCompanyId]
    );

    // Set the notifier's last run to 10 seconds ago to capture the newly inserted drives
    console.log("Resetting last_notifier_run system state...");
    const tenSecsAgo = new Date(Date.now() - 10000);
    await pool.query(
      `INSERT INTO system_state (key, value) VALUES ('last_notifier_run', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [tenSecsAgo.toISOString()]
    );

    // 3. Seed matching & non-matching drives
    console.log("Seeding test drives...");
    // Drive 1: SDE Intern (CSE, min CGPA 8.0, matching)
    await pool.query(
      `INSERT INTO drives (id, company_id, role, type, allowed_branches, min_cgpa, apply_link, dedupe_key, created_at)
       VALUES ($1, $2, 'Software Engineer Intern', 'internship', $3::text[], 8.0, 'https://careers.google.com/test-sde-1', 'dedupe-sde-1', NOW())`,
      [driveId1, testCompanyId, ['Computer Science', 'Information Technology']]
    );

    // Drive 2: SRE Engineer (CSE, min CGPA 9.0, too high - non-matching)
    await pool.query(
      `INSERT INTO drives (id, company_id, role, type, allowed_branches, min_cgpa, apply_link, dedupe_key, created_at)
       VALUES ($1, $2, 'Site Reliability Engineer', 'full-time', $3::text[], 9.0, 'https://careers.google.com/test-sre-2', 'dedupe-sre-2', NOW())`,
      [driveId2, testCompanyId, ['Computer Science']]
    );

    // Drive 3: Hardware Specialist (Mechanical, min CGPA 8.0, branch mismatch - non-matching)
    await pool.query(
      `INSERT INTO drives (id, company_id, role, type, allowed_branches, min_cgpa, apply_link, dedupe_key, created_at)
       VALUES ($1, $2, 'Hardware Specialist', 'full-time', $3::text[], 8.0, 'https://careers.google.com/test-hw-3', 'dedupe-hw-3', NOW())`,
      [driveId3, testCompanyId, ['Mechanical', 'Civil']]
    );

    // 4. Run Notifier dispatch logic
    console.log("\n--- Executing Notifier Dispatch ---");
    const summary1 = await dispatchNotifications();

    console.log(`Summary output details:
    - Students Matched: ${summary1.studentsMatched} (Expected: 1)
    - Emails Sent: ${summary1.emailsDispatched} (Expected: 1)
    - Dashboard Alerts: ${summary1.dashboardAlertsDispatched} (Expected: 1)`);

    if (summary1.studentsMatched !== 1 || summary1.emailsDispatched !== 1 || summary1.dashboardAlertsDispatched !== 1) {
      throw new Error("[FAIL] Notifier matching and initial dispatch counts do not match expected outcomes.");
    }
    console.log("[PASS] Notifier successfully matched student and generated notifications!");

    // 5. Verify alerts are in the database
    console.log("\nVerifying database alerts...");
    const dbAlertsRes = await pool.query(
      `SELECT * FROM alerts_sent WHERE student_id = $1`,
      [testStudentId]
    );
    console.log(`Found ${dbAlertsRes.rows.length} alert rows for test student.`);
    
    const dashboardAlert = dbAlertsRes.rows.find(r => r.channel === "dashboard" && r.drive_id === driveId1);
    const emailAlert = dbAlertsRes.rows.find(r => r.channel === "email" && r.drive_id === driveId1);
    
    if (!dashboardAlert || dashboardAlert.read !== false) {
      throw new Error("[FAIL] Dashboard notification not created or read flag is incorrect.");
    }
    if (!emailAlert) {
      throw new Error("[FAIL] Email notification log row not created.");
    }
    
    const hasDrive2Alert = dbAlertsRes.rows.some(r => r.drive_id === driveId2);
    const hasDrive3Alert = dbAlertsRes.rows.some(r => r.drive_id === driveId3);
    if (hasDrive2Alert || hasDrive3Alert) {
      throw new Error("[FAIL] Non-matching drives mistakenly triggered alerts!");
    }
    console.log("[PASS] Database alerts correctly filtered matching criteria.");

    // 6. Test Deduplication / Duplicate prevention
    console.log("\n--- Testing Alert Deduplication ---");
    // Insert another notifier run state trigger
    const fiveSecsAgo = new Date(Date.now() - 5000);
    await pool.query(
      `UPDATE system_state SET value = $1 WHERE key = 'last_notifier_run'`,
      [fiveSecsAgo.toISOString()]
    );
    
    // Touch drives created_at to trigger inclusion again
    await pool.query(
      `UPDATE drives SET created_at = NOW() WHERE id IN ($1, $2, $3)`,
      [driveId1, driveId2, driveId3]
    );

    const summary2 = await dispatchNotifications();
    console.log(`Second run output details:
    - Emails Sent: ${summary2.emailsDispatched} (Expected: 0)
    - Dashboard Alerts: ${summary2.dashboardAlertsDispatched} (Expected: 0)
    - Skipped Duplicates: ${summary2.skippedDuplicates} (Expected: 2 - email & dashboard for drive 1)`);

    if (summary2.emailsDispatched !== 0 || summary2.dashboardAlertsDispatched !== 0 || summary2.skippedDuplicates !== 2) {
      throw new Error("[FAIL] Deduplication failed to suppress duplicate notifications.");
    }
    console.log("[PASS] Alert deduplication works perfectly!");

    // 7. Verify read status transition
    console.log("\n--- Testing Read Status Transition ---");
    await pool.query(
      `UPDATE alerts_sent SET read = TRUE WHERE id = $1`,
      [dashboardAlert.id]
    );
    const checkReadRes = await pool.query(
      `SELECT read FROM alerts_sent WHERE id = $1`,
      [dashboardAlert.id]
    );
    if (checkReadRes.rows[0].read !== true) {
      throw new Error("[FAIL] Read status transition failed.");
    }
    console.log("[PASS] Notification read state correctly set to true.");

  } catch (error: any) {
    console.error("\nTEST SUITE CRASHED:", error.message || error);
    process.exitCode = 1;
  } finally {
    // 8. Cleanup Database State
    console.log("\nCleaning up test records...");
    await cleanup(testStudentId, [driveId1, driveId2, driveId3]);
    await pool.end();
    console.log("Database connection closed.");
    console.log("==================================================");
  }
}

async function cleanup(studentId: string, driveIds: string[]) {
  await pool.query(`DELETE FROM alerts_sent WHERE student_id = $1`, [studentId]);
  await pool.query(`DELETE FROM student_company_targets WHERE student_id = $1`, [studentId]);
  await pool.query(`DELETE FROM student_notification_preferences WHERE student_id = $1`, [studentId]);
  await pool.query(`DELETE FROM students WHERE id = $1`, [studentId]);
  await pool.query(`DELETE FROM drives WHERE id = ANY($1::text[])`, [driveIds]);
}

runTests();
