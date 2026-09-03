import { createAnalysisEngine } from "@/server/container";
import { createAnalyzeHandler } from "@/server/http/analyze-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createAnalyzeHandler(createAnalysisEngine);
