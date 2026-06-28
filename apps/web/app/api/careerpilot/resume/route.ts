import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl } from "../_lib";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/resume/${user.id}`, {
      method: "GET",
      cache: "no-store",
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incomingForm = await request.formData();
  const file = incomingForm.get("file");

  if (!file || typeof (file as any).arrayBuffer !== "function") {
    return NextResponse.json({ error: "A PDF or DOCX file is required." }, { status: 400 });
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
      body: outgoingForm,
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
