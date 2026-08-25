import { proxyOpportunityAction } from "../../../careerpilot/_lib";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return proxyOpportunityAction(params, "view");
}

