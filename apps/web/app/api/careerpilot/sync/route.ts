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

// Allow up to 10 minutes for a full sync across all companies (serverless platforms)
export const maxDuration = 600;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 10-minute timeout — sync iterates over many companies and generates embeddings
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/worker/sync`, {
      method: "POST",
      headers: getInternalHeaders(),
      body: JSON.stringify({ userId: user.id }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.code === "UND_ERR_CONNECT_TIMEOUT";
    return NextResponse.json(
      {
        error: isTimeout
          ? "Sync timed out after 10 minutes. Try syncing fewer companies or check ATS connectivity."
          : "CareerPilot API is not reachable. Start the Nest API on port 4000.",
      },
      { status: isTimeout ? 504 : 503 },
    );
  }
}
