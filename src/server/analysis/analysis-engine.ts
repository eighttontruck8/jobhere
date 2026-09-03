import { UnsupportedImageError } from "./image-validation";
import { ExtractionError, type LlmExtractionServiceContract } from "./llm-extraction-service";
import { SourceAccessError } from "./link-parser";
import { RoleFilter } from "./role-filter";
import type {
  AnalysisError,
  AnalysisResult,
  RoleFilterSpec,
} from "./analysis-types";
import type { SourceInput, SourceParser } from "./source-parser";

function toAnalysisError(error: unknown): AnalysisError {
  if (error instanceof SourceAccessError) {
    return { code: "SOURCE_ACCESS_FAILED", message: error.message };
  }

  if (error instanceof UnsupportedImageError) {
    return { code: "UNSUPPORTED_IMAGE", message: error.message };
  }

  if (error instanceof ExtractionError) {
    return { code: "EXTRACTION_FAILED", message: error.message };
  }

  return {
    code: "ANALYSIS_FAILED",
    message: "공고 정보를 분석하지 못했습니다.",
  };
}

export class AnalysisEngine {
  constructor(
    private readonly parsers: readonly SourceParser[],
    private readonly extractionService: LlmExtractionServiceContract,
    private readonly roleFilter = new RoleFilter(),
  ) {}

  async analyze(
    input: SourceInput,
    filter?: RoleFilterSpec | null,
  ): Promise<AnalysisResult> {
    try {
      const parser = this.parsers.find((candidate) => candidate.supports(input));

      if (!parser) {
        return {
          ok: false,
          error: {
            code: "UNSUPPORTED_SOURCE",
            message: "지원하지 않는 공고 소스입니다.",
          },
          originalSource: input,
        };
      }

      const content = await parser.extractRawContent(input);
      const postings = await this.extractionService.extract(content);

      return {
        ok: true,
        postings: this.roleFilter.apply(postings, filter),
      };
    } catch (error) {
      return {
        ok: false,
        error: toAnalysisError(error),
        originalSource: input,
      };
    }
  }
}
