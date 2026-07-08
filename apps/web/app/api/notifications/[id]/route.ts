import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../../careerpilot/_lib";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return structuredError("Unauthorized", 401);
    }

    const { id: alertId } = await params;
    if (!alertId) {
      return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const readVal = body.read !== undefined ? body.read : true;

    const response = await fetch(`${getCareerPilotApiBaseUrl()}/notifications/${alertId}?studentId=${user.id}`, {
      method: "PATCH",
      headers: getInternalHeaders(),
      body: JSON.stringify({ read: readVal })
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("notifications/:id PATCH", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
