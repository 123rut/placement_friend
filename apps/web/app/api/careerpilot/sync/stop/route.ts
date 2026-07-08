import { NextResponse } from "next/server";
import { getCareerPilotApiBaseUrl, getInternalHeaders, logRouteError, structuredError } from "../../_lib";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const response = await fetch(`${getCareerPilotApiBaseUrl()}/worker/sync/stop`, {
      method: "POST",
      headers: getInternalHeaders(),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({ message: "Stop signal sent." }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    logRouteError("careerpilot/sync/stop", error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
