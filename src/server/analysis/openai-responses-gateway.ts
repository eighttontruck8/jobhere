import type { LlmExtractionGateway } from "./llm-extraction-service";
import type { RawContent } from "./source-parser";

export const JOB_POSTING_EXTRACTION_INSTRUCTIONS = `
채용 공고 원문에서 직무별 공고를 추출해 JSON으로 반환하세요.
enterpriseType은 PUBLIC 또는 PRIVATE, criterion type은 LANGUAGE, KOREAN_HISTORY, OTHER_CERT,
requiredFlag는 REQUIRED 또는 OPTIONAL만 사용하세요. 알 수 없는 nullable 필드는 null,
평가 기준을 찾지 못하면 criteria는 빈 배열로 반환하세요. 원문에 여러 직무가 있으면 각각 분리하세요.
`.trim();

export const JOB_POSTINGS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["postings"],
  properties: {
    postings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "enterpriseType",
          "company",
          "jobRole",
          "title",
          "deadline",
          "jobCategory",
          "criteria",
        ],
        properties: {
          enterpriseType: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
          company: { type: ["string", "null"] },
          jobRole: { type: ["string", "null"] },
          title: { type: "string" },
          deadline: { type: ["string", "null"] },
          jobCategory: { type: ["string", "null"] },
          criteria: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "type",
                "requiredFlag",
                "cutoffScore",
                "acceptableCerts",
              ],
              properties: {
                type: {
                  type: "string",
                  enum: ["LANGUAGE", "KOREAN_HISTORY", "OTHER_CERT"],
                },
                requiredFlag: {
                  type: "string",
                  enum: ["REQUIRED", "OPTIONAL"],
                },
                cutoffScore: { type: ["integer", "null"] },
                acceptableCerts: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export class OpenAiGatewayError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OpenAiGatewayError";
  }
}

export type ResponsesFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAiResponsesGatewayOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetcher?: ResponsesFetcher;
  timeoutMilliseconds?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOutputText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.output)) {
    throw new OpenAiGatewayError("LLM 응답에서 출력 메시지를 찾지 못했습니다.");
  }

  for (const item of value.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }

  throw new OpenAiGatewayError("LLM 응답에서 출력 텍스트를 찾지 못했습니다.");
}

function buildUserContent(content: RawContent) {
  if (content.kind === "text") {
    return [
      {
        type: "input_text",
        text: `${JOB_POSTING_EXTRACTION_INSTRUCTIONS}\n\n원문:\n${content.text}`,
      },
    ];
  }

  return [
    { type: "input_text", text: JOB_POSTING_EXTRACTION_INSTRUCTIONS },
    { type: "input_image", image_url: content.dataUrl, detail: "high" },
  ];
}

export class OpenAiResponsesGateway implements LlmExtractionGateway {
  private readonly endpoint: string;
  private readonly fetcher: ResponsesFetcher;
  private readonly timeoutMilliseconds: number;

  constructor(private readonly options: OpenAiResponsesGatewayOptions) {
    if (!options.apiKey.trim()) {
      throw new TypeError("LLM API 키가 필요합니다.");
    }

    if (!options.model.trim()) {
      throw new TypeError("LLM 모델명이 필요합니다.");
    }

    this.endpoint = `${(options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/responses`;
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? 25_000;
  }

  async generateStructuredPostings(content: RawContent): Promise<unknown> {
    let response: Response;

    try {
      response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          input: [{ role: "user", content: buildUserContent(content) }],
          text: {
            format: {
              type: "json_schema",
              name: "job_postings",
              strict: true,
              schema: JOB_POSTINGS_JSON_SCHEMA,
            },
          },
          store: false,
        }),
        signal: AbortSignal.timeout(this.timeoutMilliseconds),
      });
    } catch (error) {
      throw new OpenAiGatewayError("LLM API에 연결하지 못했습니다.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new OpenAiGatewayError(
        `LLM API 요청에 실패했습니다. (HTTP ${response.status})`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
      return JSON.parse(readOutputText(body)) as unknown;
    } catch (error) {
      if (error instanceof OpenAiGatewayError) throw error;

      throw new OpenAiGatewayError(
        "LLM API가 올바른 JSON 공고 데이터를 반환하지 않았습니다.",
        { cause: error },
      );
    }
  }
}
