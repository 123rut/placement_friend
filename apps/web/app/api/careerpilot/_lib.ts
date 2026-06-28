export function getCareerPilotApiBaseUrl() {
  return process.env.CAREERPILOT_API_URL || "http://127.0.0.1:4000/api";
}
