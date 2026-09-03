import type {
  AnalysisResult,
  ImageSourceInput,
  SourceInput,
} from "@/server/analysis";
import { RequestBodyValidationError } from "./posting-draft-parser";

export interface AnalysisEngineContract {
  analyze(
    input: SourceInput,
    roleFilter?: string | null,
  ): Promise<AnalysisResult>;
}

export type AnalysisEngineFactory = () => AnalysisEngineContract | null;

interface ParsedAnalysisRequest {
  input: SourceInput;
  roleFilter: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalRoleFilter(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new RequestBodyValidationError(["roleFilter"]);
  }

  return value;
}

async function parseMultipartRequest(
  request: Request,
): Promise<ParsedAnalysisRequest> {
  const form = await request.formData();
  const image = form.get("image");

  if (!(image instanceof File)) {
    throw new RequestBodyValidationError(["image"]);
  }

  const data = new Uint8Array(await readFileBytes(image));
  const input: ImageSourceInput = {
    kind: "image",
    mimeType: image.type,
    sizeBytes: image.size,
    data,
  };

  return {
    input,
    roleFilter: parseOptionalRoleFilter(form.get("roleFilter")),
  };
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as ArrayBuffer));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsArrayBuffer(file);
  });
}

async function parseJsonRequest(request: Request): Promise<ParsedAnalysisRequest> {
  const body: unknown = await request.json();

  if (!isRecord(body) || body.kind !== "link" || typeof body.url !== "string") {
    throw new RequestBodyValidationError(["kind", "url"]);
  }

  return {
    input: { kind: "link", url: body.url },
    roleFilter: parseOptionalRoleFilter(body.roleFilter),
  };
}

export async function parseAnalysisRequest(
  request: Request,
): Promise<ParsedAnalysisRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  return contentType.includes("multipart/form-data")
    ? parseMultipartRequest(request)
    : parseJsonRequest(request);
}

function serializeOriginalSource(source: SourceInput) {
  if (source.kind !== "image") return source;

  return {
    kind: source.kind,
    mimeType: source.mimeType,
    sizeBytes: source.sizeBytes,
  };
}

function statusForResult(result: Extract<AnalysisResult, { ok: false }>): number {
  if (
    result.error.code === "SOURCE_ACCESS_FAILED" ||
    result.error.code === "UNSUPPORTED_IMAGE" ||
    result.error.code === "UNSUPPORTED_SOURCE"
  ) {
    return 400;
  }

  return 422;
}

export function createAnalyzeHandler(factory: AnalysisEngineFactory) {
  return async function POST(request: Request): Promise<Response> {
    try {
      const engine = factory();
      if (!engine) {
        return Response.json(
          {
            error: "공고 분석 API 설정이 필요합니다.",
            code: "ANALYSIS_NOT_CONFIGURED",
          },
          { status: 503 },
        );
      }

      const { input, roleFilter } = await parseAnalysisRequest(request);
      const result = await engine.analyze(input, roleFilter);

      if (result.ok) {
        return Response.json({ data: result.postings });
      }

      return Response.json(
        {
          error: result.error.message,
          code: result.error.code,
          originalSource: serializeOriginalSource(result.originalSource),
        },
        { status: statusForResult(result) },
      );
    } catch (error) {
      if (error instanceof RequestBodyValidationError) {
        return Response.json(
          { error: error.message, fields: error.fields },
          { status: 400 },
        );
      }

      if (error instanceof SyntaxError) {
        return Response.json(
          { error: "요청 본문이 올바른 JSON이 아닙니다." },
          { status: 400 },
        );
      }

      return Response.json(
        { error: "공고 분석 요청을 처리하지 못했습니다." },
        { status: 500 },
      );
    }
  };
}
