import type { FitServiceContract } from "@/server/services/fit-service";

const ERROR_STATUS = {
  PROFILE_NOT_FOUND: 409,
  POSTING_NOT_FOUND: 404,
  CUTOFF_NOT_DEFINED: 409,
} as const;

export function createFitHandler(service: FitServiceContract) {
  return async function GET(postingId: string): Promise<Response> {
    try {
      const result = await service.getFit(postingId);

      if (result.ok) {
        return Response.json({ data: result.value });
      }

      return Response.json(
        { error: result.message, code: result.code },
        { status: ERROR_STATUS[result.code] },
      );
    } catch {
      return Response.json(
        { error: "적합도를 계산하지 못했습니다." },
        { status: 500 },
      );
    }
  };
}
