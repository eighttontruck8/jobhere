import { describe, expect, it, vi } from "vitest";
import { EnterpriseType, PostingSource } from "@/domain";
import {
  createAnalyzeHandler,
  type AnalysisEngineContract,
} from "./analyze-handler";

const extractedPosting = {
  enterpriseType: EnterpriseType.PRIVATE,
  company: "잡핏테크",
  jobRole: "백엔드",
  title: "백엔드 개발자 채용",
  deadline: new Date("2026-09-30T00:00:00.000Z"),
  jobCategory: "IT",
  source: PostingSource.USER,
  criteria: [],
};

describe("createAnalyzeHandler", () => {
  it("분석 설정이 없으면 요청 본문을 처리하기 전에 503을 반환한다", async () => {
    const handler = createAnalyzeHandler(() => null);
    const response = await handler(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "link", url: "https://example.com" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "ANALYSIS_NOT_CONFIGURED",
    });
  });

  it("링크와 직무 필터를 분석 엔진에 전달하고 결과를 직렬화한다", async () => {
    const analyze = vi.fn<AnalysisEngineContract["analyze"]>(async () => ({
      ok: true,
      postings: [extractedPosting],
    }));
    const engine: AnalysisEngineContract = { analyze };
    const handler = createAnalyzeHandler(() => engine);
    const response = await handler(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "link",
          url: "https://example.com/job",
          roleFilter: "백엔드",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(engine.analyze).toHaveBeenCalledWith(
      { kind: "link", url: "https://example.com/job" },
      "백엔드",
    );
    await expect(response.json()).resolves.toMatchObject({
      data: [{ deadline: "2026-09-30T00:00:00.000Z" }],
    });
  });

  it("분석 실패 상태와 원본 링크를 적절한 HTTP 오류로 반환한다", async () => {
    const originalSource = { kind: "link" as const, url: "bad-url" };
    const engine: AnalysisEngineContract = {
      analyze: async () => ({
        ok: false,
        error: { code: "SOURCE_ACCESS_FAILED", message: "링크 접근 실패" },
        originalSource,
      }),
    };
    const response = await createAnalyzeHandler(() => engine)(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(originalSource),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "링크 접근 실패",
      code: "SOURCE_ACCESS_FAILED",
      originalSource,
    });
  });

  it("multipart 이미지를 바이트 입력으로 변환한다", async () => {
    const analyze = vi.fn<AnalysisEngineContract["analyze"]>(async () => ({
      ok: true,
      postings: [extractedPosting],
    }));
    const engine: AnalysisEngineContract = { analyze };
    const form = new FormData();
    form.append(
      "images",
      new File([new Uint8Array([1, 2, 3])], "posting.png", {
        type: "image/png",
      }),
    );
    form.append(
      "images",
      new File([new Uint8Array([4, 5])], "posting-2.jpg", {
        type: "image/jpeg",
      }),
    );
    form.set("roleFilter", "백엔드");

    const request = {
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=test",
      }),
      formData: async () => form,
    } as Request;
    const response = await createAnalyzeHandler(() => engine)(request);

    expect(response.status).toBe(200);
    expect(engine.analyze).toHaveBeenCalledWith(
      {
        kind: "image",
        images: [
          { mimeType: "image/png", sizeBytes: 3, data: new Uint8Array([1, 2, 3]) },
          { mimeType: "image/jpeg", sizeBytes: 2, data: new Uint8Array([4, 5]) },
        ],
      },
      "백엔드",
    );
  });

  it("잘못된 JSON 요청을 400으로 거부한다", async () => {
    const engine: AnalysisEngineContract = { analyze: vi.fn() };
    const response = await createAnalyzeHandler(() => engine)(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "image" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(engine.analyze).not.toHaveBeenCalled();
  });
});
