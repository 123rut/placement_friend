import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "web",
    sprint: 1,
    checkedAt: new Date().toISOString()
  });
}
