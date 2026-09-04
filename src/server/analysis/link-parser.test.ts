import { describe, expect, it, vi } from "vitest";
import {
  extractPageImageUrls,
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

describe("extractPageImageUrls", () => {
  it("지연 로딩된 공고 이미지를 우선하고 장식 이미지를 제외한다", () => {
    const urls = extractPageImageUrls(`
      <img src="/assets/logo.png" width="80" height="40">
      <img src="/placeholder.png" data-src="/uploads/job-posting.png" width="1000" height="1800" alt="채용 공고">
      <img src="https://cdn.example.com/content/detail.jpg">
    `, new URL("https://careers.example.com/jobs/1"));

    expect(urls.map(String)).toEqual([
      "https://careers.example.com/uploads/job-posting.png",
      "https://cdn.example.com/content/detail.jpg",
    ]);
  });
});

describe("LinkParser", () => {
  it("링크 소스만 지원한다", () => {
    const parser = new LinkParser({ fetcher: vi.fn() as LinkFetcher });

    expect(parser.supports({ kind: "link", url: "https://example.com" })).toBe(true);
    expect(
      parser.supports({
        kind: "image",
        images: [{ mimeType: "image/png", sizeBytes: 1, data: new Uint8Array([1]) }],
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

  it("실질적인 본문 텍스트가 없으면 페이지 이미지를 비전 입력으로 반환한다", async () => {
    const fetcher = vi.fn<LinkFetcher>(async (input) => {
      const url = String(input);
      if (url.endsWith("posting.png")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png", "content-length": "3" },
        });
      }
      return response(`
        <html><body>
          <nav>홈 채용공고 입사지원</nav>
          <img data-src="/uploads/posting.png" width="1000" height="1800" alt="채용 공고문">
        </body></html>
      `, {
        headers: { "content-type": "text/html; charset=utf-8" },
        url: "https://careers.example.com/jobs/1",
      });
    });
    const parser = new LinkParser({ fetcher });

    await expect(
      parser.extractRawContent({ kind: "link", url: "https://careers.example.com/jobs/1" }),
    ).resolves.toEqual({
      kind: "image",
      images: [{
        mimeType: "image/png",
        data: new Uint8Array([1, 2, 3]),
        dataUrl: "data:image/png;base64,AQID",
      }],
      sourceUrl: "https://careers.example.com/jobs/1",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("KT처럼 클라이언트에서 공고를 그리는 페이지는 공개 데이터에서 이미지를 찾는다", async () => {
    const fetcher = vi.fn<LinkFetcher>(async (input) => {
      const url = String(input);
      if (url.includes("/api/recruit?")) {
        return response(JSON.stringify({
          data: [{
            recruitNoticeSn: 263897,
            contents: '<p><img src="https://kt.recruiter.co.kr/upload/posting.jpg"></p>',
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("posting.jpg")) {
        return new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          headers: { "content-type": "image/jpeg" },
        });
      }
      return response('<html><body><div id="__nuxt"></div></body></html>', {
        headers: { "content-type": "text/html" },
        url: "https://recruit.kt.com/careers/263897",
      });
    });
    const parser = new LinkParser({ fetcher });

    const result = await parser.extractRawContent({
      kind: "link",
      url: "https://recruit.kt.com/careers/263897",
    });

    expect(result).toMatchObject({
      kind: "image",
      sourceUrl: "https://recruit.kt.com/careers/263897",
      images: [{ mimeType: "image/jpeg" }],
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
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
