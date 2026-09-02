import { tableService } from "@/server/container";
import { createPostingTableHandler } from "@/server/http/postings-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPostingTableHandler(tableService);
