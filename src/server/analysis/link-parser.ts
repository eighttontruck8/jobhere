import { encodeImageDataUrl } from "./image-parser";
import {
  MAXIMUM_IMAGE_COUNT,
  MAXIMUM_IMAGE_SIZE_BYTES,
  MAXIMUM_TOTAL_IMAGE_SIZE_BYTES,
  isSupportedImageMimeType,
} from "./image-validation";
import type {
  ImageAssetRawContent,
  ImageRawContent,
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

const POSTING_TEXT_SIGNALS = [
  /모집/,
  /직무|담당\s*업무/,
  /지원\s*자격|자격\s*요건/,
  /전형|채용\s*절차/,
  /접수|마감/,
  /근무|고용\s*형태/,
] as const;
const IMAGE_SOURCE_ATTRIBUTES = ["data-src", "data-original", "data-lazy-src", "src"] as const;
const IMAGE_URL_PREFERENCE_PATTERN = /채용|공고|recruit|job|posting|notice|content|upload|editor|file/i;
const DECORATIVE_IMAGE_PATTERN = /logo|icon|btn|button|arrow|spacer|blank|pixel|favicon/i;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasMeaningfulPostingText(text: string): boolean {
  return text.length >= 200 &&
    POSTING_TEXT_SIGNALS.filter((pattern) => pattern.test(text)).length >= 3;
}

function readTagAttribute(tag: string, attribute: string): string | null {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, "i");
  const match = pattern.exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function readNumericTagAttribute(tag: string, attribute: string): number | null {
  const value = readTagAttribute(tag, attribute);
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export function extractPageImageUrls(html: string, baseUrl: URL): URL[] {
  const candidates = Array.from(html.matchAll(/<img\b[^>]*>/gi)).flatMap(([tag]) => {
    const width = readNumericTagAttribute(tag, "width");
    const height = readNumericTagAttribute(tag, "height");
    if ((width !== null && width < 200) || (height !== null && height < 200)) return [];

    const source = IMAGE_SOURCE_ATTRIBUTES
      .map((attribute) => readTagAttribute(tag, attribute))
      .find(Boolean);
    if (!source || source.startsWith("data:") || source.startsWith("blob:")) return [];

    try {
      const url = new URL(source, baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return [];
      if (/\.(?:svg|gif|ico)(?:$|[?#])/i.test(url.pathname) || DECORATIVE_IMAGE_PATTERN.test(url.pathname)) return [];
      const alt = readTagAttribute(tag, "alt") ?? "";
      const score = IMAGE_URL_PREFERENCE_PATTERN.test(`${url.pathname} ${alt}`) ? 1 : 0;
      return [{ url, score }];
    } catch {
      return [];
    }
  });

  const unique = new Map<string, { url: URL; score: number }>();
  for (const candidate of candidates) unique.set(candidate.url.toString(), candidate);
  return [...unique.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, MAXIMUM_IMAGE_COUNT * 2)
    .map(({ url }) => url);
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

  private async downloadPageImages(urls: URL[], sourceUrl: string): Promise<ImageRawContent | null> {
    const settled = await Promise.allSettled(urls.map(async (url): Promise<ImageAssetRawContent | null> => {
      const response = await this.fetcher(url, {
        headers: { accept: "image/png, image/jpeg" },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMilliseconds),
      });
      if (!response.ok) return null;

      const mimeType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
      if (!isSupportedImageMimeType(mimeType)) return null;
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_IMAGE_SIZE_BYTES) return null;

      const data = new Uint8Array(await response.arrayBuffer());
      if (data.byteLength === 0 || data.byteLength > MAXIMUM_IMAGE_SIZE_BYTES) return null;
      return { mimeType, data, dataUrl: encodeImageDataUrl(data, mimeType) };
    }));

    const images: ImageAssetRawContent[] = [];
    let totalSizeBytes = 0;
    for (const result of settled) {
      if (result.status !== "fulfilled" || !result.value) continue;
      if (images.length >= MAXIMUM_IMAGE_COUNT) break;
      if (totalSizeBytes + result.value.data.byteLength > MAXIMUM_TOTAL_IMAGE_SIZE_BYTES) continue;
      images.push(result.value);
      totalSizeBytes += result.value.data.byteLength;
    }
    return images.length > 0 ? { kind: "image", images, sourceUrl } : null;
  }

  private async loadClientRenderedPostingHtml(url: URL): Promise<string | null> {
    const ktCareer = url.hostname === "recruit.kt.com"
      ? /^\/careers\/(\d+)\/?$/.exec(url.pathname)
      : null;
    if (!ktCareer) return null;

    try {
      const response = await this.fetcher(
        new URL("/api/recruit?isPost=1&isInprogress=1&isContainsContents=1", url),
        {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(this.timeoutMilliseconds),
        },
      );
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.data)) return null;
      const noticeId = Number(ktCareer[1]);
      const posting = body.data.find((item) =>
        isRecord(item) && item.recruitNoticeSn === noticeId);
      return isRecord(posting) && typeof posting.contents === "string"
        ? posting.contents
        : null;
    } catch {
      return null;
    }
  }

  async extractRawContent(input: SourceInput): Promise<TextRawContent | ImageRawContent> {
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

      if (!contentType.toLowerCase().startsWith("text/plain") && !hasMeaningfulPostingText(text)) {
        const sourceUrl = response.url || url.toString();
        const clientRenderedHtml = await this.loadClientRenderedPostingHtml(new URL(sourceUrl));
        const pageImages = await this.downloadPageImages(
          extractPageImageUrls(clientRenderedHtml ?? responseText, new URL(sourceUrl)),
          sourceUrl,
        );
        if (pageImages) return pageImages;
      }

      if (!text) {
        throw new SourceAccessError(
          input,
          "EMPTY_CONTENT",
          "링크에서 분석할 본문이나 공고 이미지를 찾지 못했습니다.",
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
