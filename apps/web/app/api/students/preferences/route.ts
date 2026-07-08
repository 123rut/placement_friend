import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../../careerpilot/_lib";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return structuredError("Unauthorized", 401);
    }

    const body = await request.json().catch(() => ({}));
    const { company_id, notify_email, notify_dashboard } = body;

    if (!company_id) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    const response = await fetch(`${getCareerPilotApiBaseUrl()}/students/preferences`, {
      method: "PATCH",
      headers: getInternalHeaders(),
      body: JSON.stringify({
        studentId: user.id,
        company_id,
        notify_email,
        notify_dashboard
      })
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("students/preferences PATCH", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
