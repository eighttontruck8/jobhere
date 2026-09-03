import type { ExtractedPosting } from "./analysis-types";
import { parseExtractedPostings } from "./extracted-posting-parser";
import type { RawContent } from "./source-parser";

export type ExtractionErrorReason = "GATEWAY_ERROR" | "INVALID_RESPONSE";

export class ExtractionError extends Error {
  constructor(
    public readonly reason: ExtractionErrorReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExtractionError";
  }
}

export interface LlmExtractionGateway {
  generateStructuredPostings(content: RawContent): Promise<unknown>;
}

export interface LlmExtractionServiceContract {
  extract(content: RawContent): Promise<ExtractedPosting[]>;
}

export class LlmExtractionService
  implements LlmExtractionServiceContract
{
  constructor(private readonly gateway: LlmExtractionGateway) {}

  async extract(content: RawContent): Promise<ExtractedPosting[]> {
    let response: unknown;

    try {
      response = await this.gateway.generateStructuredPostings(content);
    } catch (error) {
      throw new ExtractionError(
        "GATEWAY_ERROR",
        "공고 분석 서비스에 연결하지 못했습니다.",
        { cause: error },
      );
    }

    try {
      return parseExtractedPostings(response);
    } catch (error) {
      throw new ExtractionError(
        "INVALID_RESPONSE",
        "공고 정보를 구조화하지 못했습니다.",
        { cause: error },
      );
    }
  }
}
