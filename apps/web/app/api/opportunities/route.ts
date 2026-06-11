import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      items: [],
      message: "Opportunity scraping and drive ingestion begin in Sprint 2."
    },
    { status: 200 }
  );
}
