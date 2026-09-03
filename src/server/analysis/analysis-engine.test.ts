import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { EnterpriseType, PostingSource, type JobPostingDraft } from "@/domain";
import { AnalysisEngine } from "./analysis-engine";
import type { LlmExtractionServiceContract } from "./llm-extraction-service";
import type { RawContent, SourceInput, SourceParser } from "./source-parser";

function posting(jobRole: string, index: number): JobPostingDraft {
  return {
    enterpriseType: EnterpriseType.PRIVATE,
    company: `기업 ${index}`,
    jobRole,
    title: `공고 ${index}`,
    deadline: null,
    jobCategory: null,
    source: PostingSource.USER,
    criteria: [],
  };
}

function parserFor(
  kind: SourceInput["kind"],
  content: RawContent,
): SourceParser {
  return {
    supports: (input) => input.kind === kind,
    extractRawContent: vi.fn(async () => content),
  };
}

describe("AnalysisEngine", () => {
  it("소스에 맞는 파서를 선택하고 LLM 추출, 직무 필터, 50개 제한을 순서대로 적용한다", async () => {
    const linkContent: RawContent = {
      kind: "text",
      text: "원문",
      sourceUrl: "https://example.com/job",
    };
    const imageContent: RawContent = {
      kind: "image",
      mimeType: "image/png",
      data: new Uint8Array([1]),
      dataUrl: "data:image/png;base64,AQ==",
    };
    const linkParser = parserFor("link", linkContent);
    const imageParser = parserFor("image", imageContent);
    const extracted = Array.from({ length: 120 }, (_, index) =>
      posting(index % 2 === 0 ? "백엔드" : "프론트엔드", index),
    );
    const extractionService: LlmExtractionServiceContract = {
      extract: vi.fn(async () => extracted),
    };
    const engine = new AnalysisEngine(
      [linkParser, imageParser],
      extractionService,
    );

    const result = await engine.analyze(
      { kind: "link", url: "https://example.com/job" },
      "백엔드",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.postings).toHaveLength(50);
    expect(result.postings.every(({ jobRole }) => jobRole === "백엔드")).toBe(true);
    expect(linkParser.extractRawContent).toHaveBeenCalledTimes(1);
    expect(imageParser.extractRawContent).not.toHaveBeenCalled();
    expect(extractionService.extract).toHaveBeenCalledWith(linkContent);
  });

  it("지원 파서가 없으면 외부 추출을 호출하지 않는다", async () => {
    const extractionService: LlmExtractionServiceContract = {
      extract: vi.fn(),
    };
    const input: SourceInput = { kind: "pdf", data: new Uint8Array([1]) };
    const engine = new AnalysisEngine([], extractionService);

    await expect(engine.analyze(input)).resolves.toEqual({
      ok: false,
      error: {
        code: "UNSUPPORTED_SOURCE",
        message: "지원하지 않는 공고 소스입니다.",
      },
      originalSource: input,
    });
    expect(extractionService.extract).not.toHaveBeenCalled();
  });

  it("Property 15: 분석 실패 시 사용자가 입력한 원본 소스를 변경 없이 보존한다", async () => {
    await fc.assert(
      fc.asyncProperty(fc.webUrl(), async (url) => {
        const input: SourceInput = { kind: "link", url };
        const parser: SourceParser = {
          supports: () => true,
          extractRawContent: async () => {
            throw new Error("parser failure");
          },
        };
        const engine = new AnalysisEngine([parser], { extract: vi.fn() });

        const result = await engine.analyze(input);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.originalSource).toBe(input);
        expect(result.originalSource).toEqual(input);
        expect(result.error.code).toBe("ANALYSIS_FAILED");
      }),
    );
  });
});
