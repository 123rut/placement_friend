import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../../../careerpilot/_lib";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return structuredError("Unauthorized", 401);
    }

    const { id: jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    const response = await fetch(
      `${getCareerPilotApiBaseUrl()}/opportunities/${jobId}/restore?studentId=${user.id}`,
      {
        method: "POST",
        headers: getInternalHeaders(),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("opportunities/:id/restore POST", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
