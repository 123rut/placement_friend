import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, readUpstreamBody, structuredError } from "../_lib";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return structuredError("Unauthorized", 401);
  }

  const body = await request.json();

  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/jobs/match`, {
      method: "POST",
      headers: getInternalHeaders(),
      body: JSON.stringify({
        jobId: body.jobId,
        userId: user.id,
      }),
      cache: "no-store",
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/match", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
