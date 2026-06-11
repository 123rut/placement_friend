import { NextResponse } from "next/server";
import { seedCompanies } from "@piaa/domain";

export async function GET() {
  return NextResponse.json({
    items: seedCompanies
  });
}
