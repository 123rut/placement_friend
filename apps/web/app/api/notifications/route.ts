import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../careerpilot/_lib";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return structuredError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";

    const response = await fetch(
      `${getCareerPilotApiBaseUrl()}/notifications?studentId=${user.id}&unread_only=${unreadOnly}`,
      {
        method: "GET",
        headers: getInternalHeaders()
      }
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("notifications GET", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
