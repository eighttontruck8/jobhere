import type { LlmExtractionGateway } from "./llm-extraction-service";
import type { RawContent } from "./source-parser";

export const JOB_POSTING_EXTRACTION_INSTRUCTIONS = `
채용 공고 원문에서 직무별 공고를 추출해 JSON으로 반환하세요.
enterpriseType은 PUBLIC 또는 PRIVATE, criterion type은 LANGUAGE, KOREAN_HISTORY, COMPUTER_SKILL, OTHER_CERT,
requiredFlag는 REQUIRED 또는 OPTIONAL만 사용하세요. 알 수 없는 nullable 필드는 null,
평가 기준을 찾지 못하면 criteria는 빈 배열로 반환하세요. 원문에 여러 직무가 있으면 각각 분리하세요.
recruitmentCount에는 모집 인원을 원문 표현대로 간결하게 넣고(예: "3명", "00명"), 없으면 null로 반환하세요.
details는 긴 문단 대신 파악 가능한 내용만 섹션별 한국어 개조식으로 반환하세요. 모든 섹션을 억지로 만들지 마세요.
같은 의미의 제목이 공고마다 달라지지 않도록 다음 표준 제목을 우선 사용하세요.
[직무], [근무지], [모집인원], [고용형태], [임용예정일자], [근무조건], [전형순서], [지원자격], [우대사항], [제출서류], [유의사항].
어느 표준 제목에도 맞지 않는 유용한 내용은 [기타]에 넣으세요. 필요한 섹션만 출력 반환하고, 각 제목과 항목은 줄바꿈하며 모든 항목은 '- '로 시작하세요.
[전형순서]는 '- 서류전형 (날짜: YYYY년 M월 D일 또는 미정, 장소: 장소명·비대면·추후 공지) -> 다음 전형' 형식으로 작성하세요.
섹션 자체를 파악할 수 없으면 생략하되, 포함된 전형의 날짜가 없으면 '미정', 장소가 없으면 '추후 공지'로 표시하세요.
온라인·화상 등 비대면 전형이면 장소를 '비대면'으로 표시하세요. 마감일을 다른 일정 날짜로 사용하거나 원문에 없는 내용을 추측하지 마세요.
LANGUAGE의 languageRequirements에는 공고가 인정하는 TOEIC, OPIc, TOEIC Speaking 기준을 각각 넣으세요.
testType은 TOEIC, OPIC, TOEIC_SPEAKING 중 하나입니다. TOEIC은 score(0~990)를 사용하고 level은 null로,
OPIc은 IL, IM1, IM2, IM3, IH, AL 중 level을 사용하고 score는 null로,
TOEIC Speaking은 IL, IM, IH, AL, AM, AH 중 level을 사용하고 score는 null로 반환하세요.
같은 표에 제시된 여러 어학 시험은 대체 가능한 기준이므로 한 LANGUAGE 항목의 languageRequirements에 함께 넣으세요.
KOREAN_HISTORY는 1~3급, COMPUTER_SKILL은 컴퓨터활용능력 1~2급을 cutoffScore에 넣으세요.
LANGUAGE 외 항목은 languageRequirements를 빈 배열로 반환하세요.
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
          "recruitmentCount",
          "details",
          "criteria",
        ],
        properties: {
          enterpriseType: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
          company: { type: ["string", "null"] },
          jobRole: { type: ["string", "null"] },
          title: { type: "string" },
          deadline: { type: ["string", "null"] },
          jobCategory: { type: ["string", "null"] },
          recruitmentCount: { type: ["string", "null"] },
          details: { type: ["string", "null"] },
          criteria: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "type",
                "requiredFlag",
                "languageRequirements",
                "cutoffScore",
                "acceptableCerts",
              ],
              properties: {
                type: {
                  type: "string",
                  enum: ["LANGUAGE", "KOREAN_HISTORY", "COMPUTER_SKILL", "OTHER_CERT"],
                },
                languageRequirements: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["testType", "score", "level"],
                    properties: {
                      testType: {
                        type: "string",
                        enum: ["TOEIC", "OPIC", "TOEIC_SPEAKING"],
                      },
                      score: { type: ["integer", "null"] },
                      level: { type: ["string", "null"] },
                    },
                  },
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
