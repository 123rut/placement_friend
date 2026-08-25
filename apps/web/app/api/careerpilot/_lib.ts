import { createClient } from "../../../lib/supabase/server";

export function getCareerPilotApiBaseUrl() {
  let url =
    process.env.CAREERPILOT_API_URL?.trim() ||
    "http://127.0.0.1:4000/api";

  url = url.replace(/\/+$/, "");

  if (!url.endsWith("/api")) {
    url = `${url}/api`;
  }

  return url;
}

function getInternalApiKey() {
  return process.env.INTERNAL_API_KEY ?? "";
}


export function getInternalHeaders(
  extra: HeadersInit = {},
  options: { includeContentType?: boolean } = {},
): HeadersInit {
  const includeContentType = options.includeContentType ?? true;
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    "x-internal-key": getInternalApiKey(),
    ...extra,
  };
}

export function structuredError(error: string, status = 500) {
  return Response.json({ success: false, error }, { status });
}

export async function readUpstreamBody(response: Response) {
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

export function logRouteError(route: string, error: unknown) {
  console.error(`[${route}]`, error);

  if (error instanceof Error) {
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause) {
      console.error("Cause:", cause);
    }
  }
}

export async function proxyOpportunityAction(
  paramsPromise: Promise<{ id: string }> | { id: string },
  action: "apply" | "dismiss" | "restore" | "view" | "save" | "unsave"
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return structuredError("Unauthorized", 401);
    }

    const resolved = await paramsPromise;
    const jobId = resolved?.id;
    if (!jobId) {
      return Response.json({ error: "Job ID required" }, { status: 400 });
    }

    const response = await fetch(
      `${getCareerPilotApiBaseUrl()}/opportunities/${encodeURIComponent(jobId)}/${action}?studentId=${encodeURIComponent(user.id)}`,
      {
        method: "POST",
        headers: getInternalHeaders(),
        cache: "no-store",
      }
    );

    const data = await readUpstreamBody(response);
    return Response.json(data, { status: response.status });
  } catch (error) {
    logRouteError(`opportunities/:id/${action} POST`, error);
    return structuredError("CareerPilot API is not reachable.", 503);
  }
}
