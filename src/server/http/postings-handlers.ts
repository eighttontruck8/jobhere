import {
  PostingDraftValidationError,
  type PostingServiceContract,
} from "@/server/services/posting-service";
import type { TableServiceContract } from "@/server/services/table-service";
import {
  parseJobPostingDraft,
  RequestBodyValidationError,
} from "./posting-draft-parser";

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

        return Response.json(
          { error: "공고를 저장하지 못했습니다." },
          { status: 500 },
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
