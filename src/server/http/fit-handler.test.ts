import { describe, expect, it, vi } from "vitest";
import type { FitServiceContract } from "@/server/services/fit-service";
import { createFitHandler } from "./fit-handler";

describe("fit handler", () => {
  it("returns a successful fit result", async () => {
    const service: FitServiceContract = {
      getFit: vi.fn(async () => ({
        ok: true as const,
        value: {
          postingId: "posting-1",
          criterionFits: [],
          satisfiedRequiredCount: 1,
          totalRequiredCount: 1,
          passLikelihoodPercent: 100,
          missingCriteria: [],
          computable: true,
        },
      })),
    };
    const response = await createFitHandler(service)("posting-1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { postingId: "posting-1", passLikelihoodPercent: 100 },
    });
  });

  it.each([
    ["PROFILE_NOT_FOUND", 409],
    ["POSTING_NOT_FOUND", 404],
    ["CUTOFF_NOT_DEFINED", 409],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    const service: FitServiceContract = {
      getFit: vi.fn(async () => ({
        ok: false as const,
        code,
        message: "계산할 수 없습니다.",
      })),
    };
    const response = await createFitHandler(service)("posting-1");

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code });
  });

  it("returns a stable response for unexpected failures", async () => {
    const service: FitServiceContract = {
      getFit: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    };
    const response = await createFitHandler(service)("posting-1");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "적합도를 계산하지 못했습니다.",
    });
  });
});
