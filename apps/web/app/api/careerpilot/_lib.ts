export function getCareerPilotApiBaseUrl() {
  return process.env.CAREERPILOT_API_URL ?? "http://127.0.0.1:4000/api";
}

function getInternalApiKey() {
  const key = process.env.INTERNAL_API_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("INTERNAL_API_KEY must be set in production.");
  }

  return key ?? "";
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
