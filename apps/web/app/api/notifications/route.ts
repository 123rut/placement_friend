import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { pool } from "../../../../worker/src/db";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";

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

    const params: any[] = [user.id];

    if (unreadOnly) {
      query += " AND a.read = FALSE";
    }

    query += " ORDER BY a.sent_at DESC";

    const res = await pool.query(query, params);

    return NextResponse.json({ data: res.rows }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching notifications:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
