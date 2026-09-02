import { profileService } from "@/server/container";
import { createProfileHandlers } from "@/server/http/profile-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createProfileHandlers(profileService);

export const GET = handlers.GET;
export const PUT = handlers.PUT;
