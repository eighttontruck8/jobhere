import { describe, expect, it, vi } from "vitest";
import {
  extractTextFromHtml,
  LinkParser,
  SourceAccessError,
  type LinkFetcher,
} from "./link-parser";

function response(
  body: string,
  options: ResponseInit & { url?: string } = {},
): Response {
  const result = new Response(body, options);

  if (options.url) {
    Object.defineProperty(result, "url", { value: options.url });
  }

  return result;
}

describe("extractTextFromHtml", () => {
  it("본문의 태그와 실행 불가능한 요소를 제거하고 엔티티를 복원한다", () => {
    const html = `
      <html>
        <head><title>검색용 제목</title></head>
        <body>
          <main>
            <h1>신입 &amp; 경력 채용</h1>
            <script>window.secret = "노출 금지";</script>
            <style>.hidden { display: none; }</style>
            <p>직무: 백엔드&nbsp;개발</p>
            <!-- 내부 메모 -->
          </main>
        </body>
      </html>
    `;

    expect(extractTextFromHtml(html)).toBe(
      "신입 & 경력 채용\n직무: 백엔드 개발",
    );
  });
});

describe("LinkParser", () => {
  it("링크 소스만 지원한다", () => {
    const parser = new LinkParser({ fetcher: vi.fn() as LinkFetcher });

    expect(parser.supports({ kind: "link", url: "https://example.com" })).toBe(true);
    expect(
      parser.supports({
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 1,
        data: new Uint8Array(),
      }),
    ).toBe(false);
  });

  it("정상 HTML 링크에서 본문 텍스트와 최종 URL을 추출한다", async () => {
    const fetcher = vi.fn<LinkFetcher>(async () =>
      response(
        "<html><body><h1>채용 공고</h1><p>플랫폼 개발자 모집</p></body></html>",
        {
          headers: { "content-type": "text/html; charset=utf-8" },
          url: "https://careers.example.com/jobs/1",
        },
      ),
    );
    const parser = new LinkParser({ fetcher });

    await expect(
      parser.extractRawContent({ kind: "link", url: "https://example.com/job" }),
    ).resolves.toEqual({
      kind: "text",
      text: "채용 공고\n플랫폼 개발자 모집",
      sourceUrl: "https://careers.example.com/jobs/1",
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://example.com/job"),
      expect.objectContaining({ redirect: "follow" }),
    );
  });

  it("일반 텍스트 응답은 앞뒤 공백만 정리해 반환한다", async () => {
    const parser = new LinkParser({
      fetcher: async () =>
        response("  채용 공고 원문\n두 번째 줄  ", {
          headers: { "content-type": "text/plain" },
        }),
    });

    await expect(
      parser.extractRawContent({ kind: "link", url: "https://example.com/job.txt" }),
    ).resolves.toMatchObject({ text: "채용 공고 원문\n두 번째 줄" });
  });

  it.each([
    ["상대 경로", "/jobs/1"],
    ["지원하지 않는 프로토콜", "ftp://example.com/jobs/1"],
    ["인증 정보 포함 URL", "https://user:password@example.com/jobs/1"],
  ])("%s를 INVALID_URL로 거부한다", async (_, url) => {
    const fetcher = vi.fn<LinkFetcher>();
    const parser = new LinkParser({ fetcher });
    const input = { kind: "link" as const, url };

    await expect(parser.extractRawContent(input)).rejects.toMatchObject({
      name: "SourceAccessError",
      reason: "INVALID_URL",
      source: input,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("HTTP 오류 상태를 접근 실패로 변환한다", async () => {
    const input = { kind: "link" as const, url: "https://example.com/missing" };
    const parser = new LinkParser({
      fetcher: async () => response("Not found", { status: 404 }),
    });

    await expect(parser.extractRawContent(input)).rejects.toMatchObject({
      name: "SourceAccessError",
      reason: "HTTP_ERROR",
      source: input,
    });
  });

  it("네트워크 예외를 원본 링크가 포함된 접근 실패로 변환한다", async () => {
    const networkError = new TypeError("fetch failed");
    const input = { kind: "link" as const, url: "https://example.com/jobs/1" };
    const parser = new LinkParser({
      fetcher: async () => {
        throw networkError;
      },
    });

    try {
      await parser.extractRawContent(input);
      throw new Error("오류가 발생해야 합니다.");
    } catch (error) {
      expect(error).toBeInstanceOf(SourceAccessError);
      expect(error).toMatchObject({ reason: "NETWORK_ERROR", source: input });
      expect((error as SourceAccessError).cause).toBe(networkError);
    }
  });

  it("HTML이나 텍스트가 아닌 응답을 거부한다", async () => {
    const parser = new LinkParser({
      fetcher: async () =>
        response("binary", { headers: { "content-type": "application/pdf" } }),
    });

    await expect(
      parser.extractRawContent({ kind: "link", url: "https://example.com/job.pdf" }),
    ).rejects.toMatchObject({ reason: "UNSUPPORTED_CONTENT" });
  });

  it("선언되거나 실제로 수신한 본문이 제한을 넘으면 거부한다", async () => {
    const declaredParser = new LinkParser({
      maximumResponseCharacters: 5,
      fetcher: async () =>
        response("short", {
          headers: { "content-type": "text/plain", "content-length": "6" },
        }),
    });
    const actualParser = new LinkParser({
      maximumResponseCharacters: 5,
      fetcher: async () =>
        response("123456", { headers: { "content-type": "text/plain" } }),
    });
    const input = { kind: "link" as const, url: "https://example.com/large" };

    await expect(declaredParser.extractRawContent(input)).rejects.toMatchObject({
      reason: "CONTENT_TOO_LARGE",
    });
    await expect(actualParser.extractRawContent(input)).rejects.toMatchObject({
      reason: "CONTENT_TOO_LARGE",
    });
  });

  it("분석할 내용이 없는 문서를 거부한다", async () => {
    const parser = new LinkParser({
      fetcher: async () =>
        response("<html><body><script>ignore()</script></body></html>", {
          headers: { "content-type": "text/html" },
        }),
    });

    await expect(
      parser.extractRawContent({ kind: "link", url: "https://example.com/empty" }),
    ).rejects.toMatchObject({ reason: "EMPTY_CONTENT" });
  });
});
