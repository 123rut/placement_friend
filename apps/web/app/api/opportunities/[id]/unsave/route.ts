import { NextRequest } from "next/server";
import { proxyOpportunityAction } from "../../../careerpilot/_lib";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return proxyOpportunityAction(context.params, "unsave");
}
