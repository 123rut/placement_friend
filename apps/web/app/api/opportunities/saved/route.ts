import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, readUpstreamBody, structuredError } from "../../careerpilot/_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return structuredError("Unauthorized", 401);
    }

    const response = await fetch(`${getCareerPilotApiBaseUrl()}/opportunities/saved?studentId=${user.id}`, {
      method: "GET",
      headers: getInternalHeaders(),
      cache: "no-store",
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("opportunities/saved GET", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
