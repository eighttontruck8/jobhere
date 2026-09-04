import { describe, expect, it, vi } from "vitest";
import { EnterpriseType, PostingSource, RequiredFlag, CriterionType } from "@/domain";
import {
  ExtractionError,
  LlmExtractionService,
  type LlmExtractionGateway,
} from "./llm-extraction-service";

const content = {
  kind: "text" as const,
  text: "채용 공고 원문",
  sourceUrl: "https://example.com/job",
};

describe("LlmExtractionService", () => {
  it("외부 응답을 검증된 Review용 공고 draft로 변환한다", async () => {
    const gateway: LlmExtractionGateway = {
      generateStructuredPostings: vi.fn(async () => ({
        postings: [
          {
            enterpriseType: EnterpriseType.PUBLIC,
            company: "한국전력공사",
            jobRole: "전산",
            title: "신입 채용",
            deadline: "2026-09-30T00:00:00.000Z",
            jobCategory: "IT",
            recruitmentCount: "3명",
            details: "전산 시스템 개발 및 운영",
            criteria: [
              {
                type: CriterionType.LANGUAGE,
                requiredFlag: RequiredFlag.REQUIRED,
                cutoffScore: 800,
                acceptableCerts: [],
              },
            ],
          },
        ],
      })),
    };
    const service = new LlmExtractionService(gateway);

    const result = await service.extract(content);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      enterpriseType: EnterpriseType.PUBLIC,
      company: "한국전력공사",
      jobRole: "전산",
      source: PostingSource.USER,
      deadline: new Date("2026-09-30T00:00:00.000Z"),
      recruitmentCount: "3명",
      details: "전산 시스템 개발 및 운영",
      originalUrl: "https://example.com/job",
    });
  });

  it.each([
    { postings: [] },
    { postings: [{ enterpriseType: "UNKNOWN", title: "공고" }] },
    { postings: [{ enterpriseType: EnterpriseType.PRIVATE, title: 123 }] },
    { unexpected: true },
  ])("유효하지 않은 외부 응답을 INVALID_RESPONSE로 거부한다", async (response) => {
    const service = new LlmExtractionService({
      generateStructuredPostings: async () => response,
    });

    await expect(service.extract(content)).rejects.toMatchObject({
      name: "ExtractionError",
      reason: "INVALID_RESPONSE",
    });
  });

  it("외부 API 오류를 GATEWAY_ERROR로 변환하고 원인을 보존한다", async () => {
    const cause = new Error("timeout");
    const service = new LlmExtractionService({
      generateStructuredPostings: async () => {
        throw cause;
      },
    });

    try {
      await service.extract(content);
      throw new Error("오류가 발생해야 합니다.");
    } catch (error) {
      expect(error).toBeInstanceOf(ExtractionError);
      expect(error).toMatchObject({ reason: "GATEWAY_ERROR", cause });
    }
  });

  it("링크에서 가져온 이미지 분석 결과에도 원본 URL을 보존한다", async () => {
    const service = new LlmExtractionService({
      generateStructuredPostings: async () => ({
        postings: [{
          enterpriseType: EnterpriseType.PUBLIC,
          company: "한국공사",
          jobRole: "행정",
          title: "신입 채용",
          deadline: null,
          jobCategory: null,
          recruitmentCount: null,
          details: null,
          criteria: [],
        }],
      }),
    });

    const [result] = await service.extract({
      kind: "image",
      images: [{ mimeType: "image/png", data: new Uint8Array([1]), dataUrl: "data:image/png;base64,AQ==" }],
      sourceUrl: "https://example.com/image-posting",
    });

    expect(result.originalUrl).toBe("https://example.com/image-posting");
  });

  it("연도가 생략된 한국식 마감 일시를 현재 연도로 보정한다", async () => {
    const service = new LlmExtractionService({
      generateStructuredPostings: async () => ({
        postings: [{
          enterpriseType: EnterpriseType.PRIVATE,
          company: "KT",
          jobRole: "네트워크",
          title: "대졸 신입 채용",
          deadline: "9/7(월) 16시",
          jobCategory: null,
          recruitmentCount: null,
          details: null,
          criteria: [],
        }],
      }),
    });

    const [result] = await service.extract(content);

    expect(result.deadline?.getFullYear()).toBe(new Date().getFullYear());
    expect(result.deadline?.getMonth()).toBe(8);
    expect(result.deadline?.getDate()).toBe(7);
  });
});
