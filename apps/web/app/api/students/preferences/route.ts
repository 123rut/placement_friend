import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { pool } from "../../../../../worker/src/db";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { company_id, notify_email, notify_dashboard } = body;

    if (!company_id) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    const emailPref = notify_email !== undefined ? notify_email : true;
    const dashboardPref = notify_dashboard !== undefined ? notify_dashboard : true;

    const res = await pool.query(
      `INSERT INTO student_company_targets (student_id, company_id, notify_email, notify_dashboard, created_at, added_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (student_id, company_id)
       DO UPDATE SET 
         notify_email = $3, 
         notify_dashboard = $4
       RETURNING *`,
      [user.id, company_id, emailPref, dashboardPref]
    );

    return NextResponse.json(
      {
        company_id: res.rows[0].company_id,
        notify_email: res.rows[0].notify_email,
        notify_dashboard: res.rows[0].notify_dashboard,
        updated_at: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error updating preferences:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
