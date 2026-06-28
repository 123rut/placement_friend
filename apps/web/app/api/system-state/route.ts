import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { pool } from "../../../../worker/src/db";

/**
 * POST /api/system-state
 * Called after student profile is saved to persist the logged-in student ID
 * into the system_state table so the worker can pick it up automatically.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify this student exists in the students table
    const studentRes = await pool.query(
      "SELECT id FROM students WHERE id = $1",
      [user.id]
    );

    if (studentRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Student profile not found. Please complete your profile first." },
        { status: 404 }
      );
    }

    // Write the active student ID into system_state
    await pool.query(
      `INSERT INTO system_state (key, value, updated_at)
       VALUES ('active_student_id', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [user.id]
    );

    console.log(`[system-state] Active student ID set to: ${user.id}`);

    return NextResponse.json({ success: true, student_id: user.id });
  } catch (err: any) {
    console.error("Error setting system state:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/system-state
 * Returns the current active_student_id from system_state.
 */
export async function GET() {
  try {
    const result = await pool.query(
      "SELECT value FROM system_state WHERE key = 'active_student_id'"
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ active_student_id: null });
    }

    return NextResponse.json({ active_student_id: result.rows[0].value });
  } catch (err: any) {
    console.error("Error reading system state:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}
