import { describe, expect, it, vi } from "vitest";
import {
  EnterpriseType,
  PostingSource,
  buildEvaluationTable,
  type JobPosting,
} from "@/domain";
import type { PostingServiceContract } from "@/server/services/posting-service";
import { PostingDraftValidationError } from "@/server/services/posting-service";
import type { TableServiceContract } from "@/server/services/table-service";
import {
  createPostingsHandlers,
  createPostingTableHandler,
} from "./postings-handlers";

function createPosting(id = "posting-1"): JobPosting {
  return {
    id,
    enterpriseType: EnterpriseType.PRIVATE,
    company: "테스트 기업",
    jobRole: "개발",
    title: "개발 인턴",
    deadline: new Date("2026-09-30T14:59:59.000Z"),
    jobCategory: "개발",
    source: PostingSource.USER,
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
    criteria: [],
  };
}

function createService(): PostingServiceContract {
  return {
    listPostings: vi.fn(async () => [createPosting()]),
    listPrivatePostings: vi.fn(async () => [createPosting()]),
    savePosting: vi.fn(async () => createPosting("saved")),
  };
}

describe("postings handlers", () => {
  it("returns the requested posting list", async () => {
    const service = createService();
    const handlers = createPostingsHandlers(service);
    const response = await handlers.GET(
      new Request("http://localhost/api/postings?view=private"),
    );

    expect(response.status).toBe(200);
    expect(service.listPrivatePostings).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "posting-1" }],
    });
  });

  it("rejects an unsupported list view", async () => {
    const handlers = createPostingsHandlers(createService());
    const response = await handlers.GET(
      new Request("http://localhost/api/postings?view=unknown"),
    );

    expect(response.status).toBe(400);
  });

  it("returns a stable error response when listing fails", async () => {
    const service = createService();
    vi.mocked(service.listPostings).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const response = await createPostingsHandlers(service).GET(
      new Request("http://localhost/api/postings"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "공고 목록을 불러오지 못했습니다.",
    });
  });

  it("parses and saves a valid posting draft", async () => {
    const service = createService();
    const handlers = createPostingsHandlers(service);
    const response = await handlers.POST(
      new Request("http://localhost/api/postings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enterpriseType: EnterpriseType.PRIVATE,
          company: "테스트 기업",
          jobRole: "개발",
          title: "개발 인턴",
          deadline: "2026-09-30T14:59:59.000Z",
          jobCategory: "개발",
          recruitmentCount: "2명",
          details: "서비스 개발 및 운영",
          originalUrl: "https://example.com/jobs/1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(service.savePosting).toHaveBeenCalledWith(
      expect.objectContaining({
        source: PostingSource.USER,
        deadline: new Date("2026-09-30T14:59:59.000Z"),
        criteria: [],
        recruitmentCount: "2명",
        details: "서비스 개발 및 운영",
        originalUrl: "https://example.com/jobs/1",
      }),
    );
  });

  it("maps malformed input and missing fields to distinct responses", async () => {
    const malformedHandlers = createPostingsHandlers(createService());
    const malformedResponse = await malformedHandlers.POST(
      new Request("http://localhost/api/postings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "공고" }),
      }),
    );

    expect(malformedResponse.status).toBe(400);

    const service = createService();
    vi.mocked(service.savePosting).mockRejectedValueOnce(
      new PostingDraftValidationError(["company"]),
    );
    const handlers = createPostingsHandlers(service);
    const missingResponse = await handlers.POST(
      new Request("http://localhost/api/postings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enterpriseType: EnterpriseType.PRIVATE,
          company: null,
          jobRole: "개발",
          title: "공고",
          deadline: "2026-09-30T14:59:59.000Z",
        }),
      }),
    );

    expect(missingResponse.status).toBe(422);
    await expect(missingResponse.json()).resolves.toMatchObject({
      fields: ["company"],
    });
  });

  it("preserves the HTTP contract when persistence fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = createService();
    vi.mocked(service.savePosting).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const response = await createPostingsHandlers(service).POST(
      new Request("http://localhost/api/postings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enterpriseType: EnterpriseType.PRIVATE,
          company: "테스트 기업",
          jobRole: "개발",
          title: "공고",
          deadline: "2026-09-30T14:59:59.000Z",
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "공고 저장 중 서버 오류가 발생했습니다.",
      detail: "아래 오류 ID를 서버 로그에서 확인해 주세요.",
      code: "POSTING_SAVE_FAILED",
      requestId: expect.any(String),
    });
    expect(log).toHaveBeenCalledWith(
      "[postings.save]",
      expect.objectContaining({ requestId: expect.any(String) }),
    );
    log.mockRestore();
  });

  it.each([
    {
      prismaCode: "P1001",
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      error: "데이터베이스에 연결할 수 없습니다.",
    },
    {
      prismaCode: "P2022",
      status: 500,
      code: "DATABASE_SCHEMA_OUTDATED",
      error: "데이터베이스 구조가 현재 앱과 맞지 않습니다.",
    },
  ])("returns actionable details for $prismaCode", async ({ prismaCode, status, code, error }) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = createService();
    vi.mocked(service.savePosting).mockRejectedValueOnce({ code: prismaCode });
    const response = await createPostingsHandlers(service).POST(
      new Request("http://localhost/api/postings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enterpriseType: EnterpriseType.PRIVATE,
          company: "테스트 기업",
          jobRole: "개발",
          title: "공고",
          deadline: "2026-09-30T14:59:59.000Z",
        }),
      }),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code, error });
    log.mockRestore();
  });

  it("Prisma Client 불일치를 재생성 안내로 반환한다", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = createService();
    vi.mocked(service.savePosting).mockRejectedValueOnce({
      name: "PrismaClientValidationError",
    });
    const response = await createPostingsHandlers(service).POST(
      new Request("http://localhost/api/postings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enterpriseType: EnterpriseType.PRIVATE,
          company: "테스트 기업",
          jobRole: "개발",
          title: "공고",
          deadline: "2026-09-30T14:59:59.000Z",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      code: "PRISMA_CLIENT_OUTDATED",
      detail: expect.stringContaining("npx prisma generate"),
    });
    log.mockRestore();
  });

  it("builds a filtered public evaluation table response", async () => {
    const posting = {
      ...createPosting(),
      enterpriseType: EnterpriseType.PUBLIC,
    };
    const service: TableServiceContract = {
      buildEvaluationTable: vi.fn(async (filter) =>
        buildEvaluationTable([posting], filter ?? null),
      ),
      addToTable: vi.fn(),
    };
    const response = await createPostingTableHandler(service)(
      new Request("http://localhost/api/postings/table?category=개발"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        filter: "개발",
        rows: [{ postingId: "posting-1" }],
      },
    });
  });
});
