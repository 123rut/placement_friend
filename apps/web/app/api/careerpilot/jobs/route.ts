import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../_lib";

export const dynamic = "force-dynamic";

async function readUpstreamBody(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return structuredError("Unauthorized", 401);
  }

  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/jobs/matches/${user.id}?limit=100`, {
      method: "GET",
      headers: getInternalHeaders(),
      cache: "no-store",
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/jobs GET", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}

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
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/jobs/search`, {
      method: "POST",
      headers: getInternalHeaders(),
      body: JSON.stringify({
        query: body.query,
        location: body.location,
        employmentType: body.employmentType,
        limit: body.limit,
      }),
      cache: "no-store",
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/jobs POST", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
