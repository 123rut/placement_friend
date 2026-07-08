import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../careerpilot/_lib";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return structuredError("Unauthorized", 401);
  }

  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/system-state`, {
      method: "POST",
      headers: getInternalHeaders(),
      body: JSON.stringify({ studentId: user.id })
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("system-state POST", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}

export async function GET() {
  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/system-state`, {
      method: "GET",
      headers: getInternalHeaders()
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("system-state GET", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
