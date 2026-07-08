import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { pool } from "../../../../../worker/src/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: alertId } = await params;
    if (!alertId) {
      return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
    }

    // Body could contain read field
    const body = await request.json().catch(() => ({}));
    const readVal = body.read !== undefined ? body.read : true;

    const res = await pool.query(
      `UPDATE alerts_sent
       SET read = $1
       WHERE id = $2 AND student_id = $3
       RETURNING *`,
      [readVal, alertId, user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Notification not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ data: res.rows[0] }, { status: 200 });
  } catch (err: any) {
    console.error("Error updating notification:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
