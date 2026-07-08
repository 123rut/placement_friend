import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../../careerpilot/_lib";

export async function PATCH() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return structuredError("Unauthorized", 401);
    }

    const response = await fetch(`${getCareerPilotApiBaseUrl()}/notifications/read-all?studentId=${user.id}`, {
      method: "PATCH",
      headers: getInternalHeaders()
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("notifications/read-all PATCH", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
