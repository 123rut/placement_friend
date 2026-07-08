import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders } from "../_lib";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  } catch {
    return NextResponse.json(
      { error: "CareerPilot API is not reachable. Start the Nest API on port 4000." },
      { status: 503 },
    );
  }
}
