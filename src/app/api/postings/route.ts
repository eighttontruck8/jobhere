import { postingService } from "@/server/container";
import { createPostingsHandlers } from "@/server/http/postings-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createPostingsHandlers(postingService);

export const GET = handlers.GET;
export const POST = handlers.POST;
