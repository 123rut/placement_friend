import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../_lib";

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return structuredError("Unauthorized", 401);
  }

  const body = await request.json();

  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/agent/chat`, {
      method: "POST",
      headers: getInternalHeaders(),
      body: JSON.stringify({
        userId: user.id,
        message: body.message,
        conversationId: body.conversationId,
      }),
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/agent", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
