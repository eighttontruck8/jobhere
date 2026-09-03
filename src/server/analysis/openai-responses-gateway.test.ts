import { describe, expect, it, vi } from "vitest";
import {
  JOB_POSTINGS_JSON_SCHEMA,
  OpenAiResponsesGateway,
  type ResponsesFetcher,
} from "./openai-responses-gateway";

function outputResponse(output: unknown, status = 200): Response {
  return new Response(JSON.stringify(output), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const structuredOutput = {
  postings: [
    {
      enterpriseType: "PRIVATE",
      company: "잡핏테크",
      jobRole: "백엔드",
      title: "백엔드 개발자 채용",
      deadline: null,
      jobCategory: "IT",
      recruitmentCount: "2명",
      details: "백엔드 서비스 개발",
      criteria: [],
    },
  ],
};

function responsesApiOutput(value: unknown) {
  return {
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: JSON.stringify(value) },
        ],
      },
    ],
  };
}

describe("OpenAiResponsesGateway", () => {
  it("텍스트 원문을 strict JSON schema 요청으로 전송하고 구조화 결과를 반환한다", async () => {
    const fetcher = vi.fn<ResponsesFetcher>(async () =>
      outputResponse(responsesApiOutput(structuredOutput)),
    );
    const gateway = new OpenAiResponsesGateway({
      apiKey: "test-key",
      model: "test-model",
      baseUrl: "https://llm.example.test/v1/",
      fetcher,
    });

    await expect(
      gateway.generateStructuredPostings({
        kind: "text",
        text: "개발자 채용 원문",
        sourceUrl: "https://example.com/job",
      }),
    ).resolves.toEqual(structuredOutput);

    const [endpoint, init] = fetcher.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      input: Array<{ content: Array<{ type: string; text?: string }> }>;
      text: { format: { strict: boolean; schema: unknown } };
      store: boolean;
    };

    expect(endpoint).toBe("https://llm.example.test/v1/responses");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ authorization: "Bearer test-key" });
    expect(body.model).toBe("test-model");
    expect(body.input[0].content[0].text).toContain("개발자 채용 원문");
    expect(body.text.format).toMatchObject({
      strict: true,
      schema: JOB_POSTINGS_JSON_SCHEMA,
    });
    expect(body.store).toBe(false);
  });

  it("이미지는 원본 바이트 대신 비전용 데이터 URL로 전송한다", async () => {
    const fetcher = vi.fn<ResponsesFetcher>(async () =>
      outputResponse(responsesApiOutput(structuredOutput)),
    );
    const gateway = new OpenAiResponsesGateway({
      apiKey: "test-key",
      model: "vision-model",
      fetcher,
    });

    await gateway.generateStructuredPostings({
      kind: "image",
      mimeType: "image/png",
      data: new Uint8Array([1, 2, 3]),
      dataUrl: "data:image/png;base64,AQID",
    });

    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
      input: Array<{
        content: Array<{ type: string; image_url?: string; detail?: string }>;
      }>;
    };
    expect(body.input[0].content[1]).toEqual({
      type: "input_image",
      image_url: "data:image/png;base64,AQID",
      detail: "high",
    });
    expect(JSON.stringify(body)).not.toContain("1,2,3");
  });

  it("HTTP 실패와 잘못된 출력 형식을 명확한 게이트웨이 오류로 반환한다", async () => {
    const httpGateway = new OpenAiResponsesGateway({
      apiKey: "test-key",
      model: "test-model",
      fetcher: async () => outputResponse({ error: "failed" }, 429),
    });
    const invalidGateway = new OpenAiResponsesGateway({
      apiKey: "test-key",
      model: "test-model",
      fetcher: async () => outputResponse({ output: [] }),
    });
    const content = {
      kind: "text" as const,
      text: "원문",
      sourceUrl: "https://example.com",
    };

    await expect(
      httpGateway.generateStructuredPostings(content),
    ).rejects.toMatchObject({ name: "OpenAiGatewayError" });
    await expect(
      invalidGateway.generateStructuredPostings(content),
    ).rejects.toThrow("출력 텍스트를 찾지 못했습니다.");
  });

  it("API 키나 모델명이 비어 있으면 생성 시점에 거부한다", () => {
    expect(
      () => new OpenAiResponsesGateway({ apiKey: "", model: "model" }),
    ).toThrow("LLM API 키가 필요합니다.");
    expect(
      () => new OpenAiResponsesGateway({ apiKey: "key", model: "" }),
    ).toThrow("LLM 모델명이 필요합니다.");
  });
});
