import { fitService } from "@/server/container";
import { createFitHandler } from "@/server/http/fit-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getFit = createFitHandler(fitService);

export async function GET(
  _request: Request,
  context: RouteContext<"/api/postings/[id]/fit">,
) {
  const { id } = await context.params;

  return getFit(id);
}
