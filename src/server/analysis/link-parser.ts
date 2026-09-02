import type {
  LinkSourceInput,
  SourceInput,
  SourceParser,
  TextRawContent,
} from "./source-parser";

export const LINK_PARSER_LIMITS = {
  timeoutMilliseconds: 10_000,
  maximumResponseCharacters: 2_000_000,
} as const;

export type SourceAccessErrorReason =
  | "INVALID_URL"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "UNSUPPORTED_CONTENT"
  | "CONTENT_TOO_LARGE"
  | "EMPTY_CONTENT";

export class SourceAccessError extends Error {
  constructor(
    public readonly source: LinkSourceInput,
    public readonly reason: SourceAccessErrorReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SourceAccessError";
  }
}

export type LinkFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface LinkParserOptions {
  fetcher?: LinkFetcher;
  timeoutMilliseconds?: number;
  maximumResponseCharacters?: number;
}

const TEXT_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
] as const;

const BLOCK_BOUNDARY_PATTERN =
  /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
      if (decimal) {
        return String.fromCodePoint(Number.parseInt(decimal, 10));
      }

      if (hexadecimal) {
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      }

      return named ? (namedEntities[named.toLowerCase()] ?? entity) : entity;
    },
  );
}

export function extractTextFromHtml(html: string): string {
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;

  return decodeHtmlEntities(
    body
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(BLOCK_BOUNDARY_PATTERN, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeLink(input: LinkSourceInput): URL {
  try {
    const url = new URL(input.url);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== ""
    ) {
      throw new Error("unsupported URL");
    }

    return url;
  } catch (error) {
    throw new SourceAccessError(
      input,
      "INVALID_URL",
      "유효한 HTTP(S) 링크를 입력해 주세요.",
      { cause: error },
    );
  }
}

function isTextContentType(contentType: string): boolean {
  if (!contentType) return true;

  const normalized = contentType.split(";", 1)[0].trim().toLowerCase();
  return TEXT_CONTENT_TYPES.some((supported) => normalized === supported);
}

export class LinkParser implements SourceParser {
  private readonly fetcher: LinkFetcher;
  private readonly timeoutMilliseconds: number;
  private readonly maximumResponseCharacters: number;

  constructor(options: LinkParserOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.timeoutMilliseconds =
      options.timeoutMilliseconds ?? LINK_PARSER_LIMITS.timeoutMilliseconds;
    this.maximumResponseCharacters =
      options.maximumResponseCharacters ??
      LINK_PARSER_LIMITS.maximumResponseCharacters;
  }

  supports(input: SourceInput): input is LinkSourceInput {
    return input.kind === "link";
  }

  async extractRawContent(input: SourceInput): Promise<TextRawContent> {
    if (!this.supports(input)) {
      throw new TypeError("LinkParser는 링크 소스만 처리할 수 있습니다.");
    }

    const url = normalizeLink(input);

    try {
      const response = await this.fetcher(url, {
        headers: {
          accept: "text/html, application/xhtml+xml, text/plain;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMilliseconds),
      });

      if (!response.ok) {
        throw new SourceAccessError(
          input,
          "HTTP_ERROR",
          `링크에 접근하지 못했습니다. (HTTP ${response.status})`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!isTextContentType(contentType)) {
        throw new SourceAccessError(
          input,
          "UNSUPPORTED_CONTENT",
          "링크가 HTML 또는 텍스트 문서를 가리키지 않습니다.",
        );
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > this.maximumResponseCharacters
      ) {
        throw new SourceAccessError(
          input,
          "CONTENT_TOO_LARGE",
          "링크의 본문이 처리 가능한 크기를 초과했습니다.",
        );
      }

      const responseText = await response.text();
      if (responseText.length > this.maximumResponseCharacters) {
        throw new SourceAccessError(
          input,
          "CONTENT_TOO_LARGE",
          "링크의 본문이 처리 가능한 크기를 초과했습니다.",
        );
      }

      const text = contentType.toLowerCase().startsWith("text/plain")
        ? responseText.trim()
        : extractTextFromHtml(responseText);

      if (!text) {
        throw new SourceAccessError(
          input,
          "EMPTY_CONTENT",
          "링크에서 분석할 본문을 찾지 못했습니다.",
        );
      }

      return {
        kind: "text",
        text,
        sourceUrl: response.url || url.toString(),
      };
    } catch (error) {
      if (error instanceof SourceAccessError) {
        throw error;
      }

      throw new SourceAccessError(
        input,
        "NETWORK_ERROR",
        "링크에 접근하지 못했습니다. 주소와 네트워크 상태를 확인해 주세요.",
        { cause: error },
      );
    }
  }
}
