import { NextRequest, NextResponse } from "next/server";
import { filterColleges } from "@piaa/domain";
import { createClient } from "../../../lib/supabase/server";
import { getMergedColleges } from "../../../lib/supabase/colleges";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  const supabase = await createClient();
  const allColleges = await getMergedColleges(supabase);
  const items = query ? filterColleges(allColleges, query) : allColleges;

  return NextResponse.json({
    items,
  });
}

