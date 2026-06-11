import { NextResponse } from "next/server";
import { colleges } from "@piaa/domain";

export async function GET() {
  return NextResponse.json({
    items: colleges
  });
}
