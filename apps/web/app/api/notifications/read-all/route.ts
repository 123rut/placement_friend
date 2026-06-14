import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { pool } from "../../../../../worker/src/db";

export async function PATCH() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await pool.query(
      `UPDATE alerts_sent
       SET read = TRUE
       WHERE student_id = $1 AND channel = 'dashboard' AND read = FALSE`,
      [user.id]
    );

    return NextResponse.json({ updated_count: res.rowCount || 0 }, { status: 200 });
  } catch (err: any) {
    console.error("Error marking all notifications as read:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
