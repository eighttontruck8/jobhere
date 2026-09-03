import {
  PostingDraftValidationError,
  type PostingServiceContract,
} from "@/server/services/posting-service";
import type { TableServiceContract } from "@/server/services/table-service";
import {
  parseJobPostingDraft,
  RequestBodyValidationError,
} from "./posting-draft-parser";

interface ErrorDetails {
  status: number;
  code: string;
  error: string;
  detail: string;
}

function findErrorCode(error: unknown): string | null {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    const record = current as Record<string, unknown>;
    const code = record.code ?? record.errorCode;
    if (typeof code === "string") return code;
    current = record.cause;
  }
  return null;
}

function findErrorName(error: unknown): string | null {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    const record = current as Record<string, unknown>;
    if (typeof record.name === "string" && record.name.startsWith("Prisma")) {
      return record.name;
    }
    current = record.cause;
  }
  return null;
}

export function classifyPostingSaveError(error: unknown): ErrorDetails {
  const code = findErrorCode(error);
  const name = findErrorName(error);

  if (name === "PrismaClientValidationError") {
    return {
      status: 500,
      code: "PRISMA_CLIENT_OUTDATED",
      error: "실행 중인 데이터베이스 클라이언트가 현재 앱 구조와 맞지 않습니다.",
      detail: "npx prisma generate를 실행하고 개발 서버를 완전히 종료한 뒤 다시 시작해 주세요.",
    };
  }

  if (code === "P1001" || code === "P1002") {
    return {
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      error: "데이터베이스에 연결할 수 없습니다.",
      detail: "PostgreSQL 서버가 실행 중인지와 DATABASE_URL의 주소·포트를 확인해 주세요.",
    };
  }

  if (code === "P2021" || code === "P2022") {
    return {
      status: 500,
      code: "DATABASE_SCHEMA_OUTDATED",
      error: "데이터베이스 구조가 현재 앱과 맞지 않습니다.",
      detail: "터미널에서 npx prisma migrate dev를 실행한 뒤 개발 서버를 다시 시작해 주세요.",
    };
  }

  if (code === "P2002") {
    return {
      status: 409,
      code: "DUPLICATE_POSTING_DATA",
      error: "중복되는 공고 데이터가 있습니다.",
      detail: "이미 저장된 공고인지 확인한 뒤 다시 시도해 주세요.",
    };
  }

  return {
    status: 500,
    code: "POSTING_SAVE_FAILED",
    error: "공고 저장 중 서버 오류가 발생했습니다.",
    detail: "아래 오류 ID를 서버 로그에서 확인해 주세요.",
  };
}

export function createPostingsHandlers(service: PostingServiceContract) {
  return {
    async GET(request: Request): Promise<Response> {
      try {
        const view = new URL(request.url).searchParams.get("view");

        if (view !== null && view !== "private") {
          return Response.json(
            { error: "지원하지 않는 조회 방식입니다." },
            { status: 400 },
          );
        }

        const postings =
          view === "private"
            ? await service.listPrivatePostings()
            : await service.listPostings();

        return Response.json({ data: postings });
      } catch {
        return Response.json(
          { error: "공고 목록을 불러오지 못했습니다." },
          { status: 500 },
        );
      }
    },

    async POST(request: Request): Promise<Response> {
      try {
        const body: unknown = await request.json();
        const draft = parseJobPostingDraft(body);
        const posting = await service.savePosting(draft);

        return Response.json({ data: posting }, { status: 201 });
      } catch (error) {
        if (error instanceof RequestBodyValidationError) {
          return Response.json(
            { error: error.message, fields: error.fields },
            { status: 400 },
          );
        }

        if (error instanceof PostingDraftValidationError) {
          return Response.json(
            { error: error.message, fields: error.fields },
            { status: 422 },
          );
        }

        if (error instanceof SyntaxError) {
          return Response.json(
            { error: "요청 본문이 올바른 JSON이 아닙니다." },
            { status: 400 },
          );
        }

        const requestId = crypto.randomUUID();
        const failure = classifyPostingSaveError(error);
        console.error("[postings.save]", { requestId, error });

        return Response.json(
          {
            error: failure.error,
            detail: failure.detail,
            code: failure.code,
            requestId,
          },
          { status: failure.status },
        );
      }
    },
  };
}

export function createPostingTableHandler(service: TableServiceContract) {
  return async function GET(request: Request): Promise<Response> {
    try {
      const category = new URL(request.url).searchParams.get("category");
      const table = await service.buildEvaluationTable(category || null);

      return Response.json({ data: table });
    } catch {
      return Response.json(
        { error: "공기업 평가 기준표를 불러오지 못했습니다." },
        { status: 500 },
      );
    }
  };
}
