import { NextResponse } from "next/server";
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
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/resume/${user.id}`, {
      method: "GET",
      headers: getInternalHeaders(),
      cache: "no-store",
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/resume GET", error);
    return structuredError("CareerPilot API is not reachable.", 503);
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

  const incomingForm = await request.formData();
  const file = incomingForm.get("file");

  if (!file || typeof (file as any).arrayBuffer !== "function") {
    return structuredError("A PDF or DOCX file is required.", 400);
  }

  const outgoingForm = new FormData();
  if (file instanceof File) {
    outgoingForm.append("file", file, file.name);
  } else {
    outgoingForm.append("file", file);
  }
  outgoingForm.append("userId", user.id);

  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/resume/parse`, {
      method: "POST",
      headers: getInternalHeaders({}, { includeContentType: false }),
      body: outgoingForm,
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/resume POST", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return structuredError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/resume/${user.id}`, {
      method: "PUT",
      headers: getInternalHeaders(),
      body: JSON.stringify(body),
    });
    const data = await readUpstreamBody(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/resume PUT", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
