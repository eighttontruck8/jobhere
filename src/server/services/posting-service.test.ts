import { describe, expect, it, vi } from "vitest";
import {
  EnterpriseType,
  PostingSource,
  type JobPosting,
  type JobPostingDraft,
} from "@/domain";
import type { PostingRepository } from "@/server/repositories/posting-repository";
import { PostingService } from "./posting-service";

function createPosting(
  id: string,
  enterpriseType: JobPosting["enterpriseType"],
  createdAt: Date,
  deadline: Date | null,
): JobPosting {
  return {
    id,
    enterpriseType,
    company: `기업 ${id}`,
    jobRole: `직무 ${id}`,
    title: `공고 ${id}`,
    deadline,
    jobCategory: null,
    source: PostingSource.CRAWLED,
    createdAt,
    criteria: [],
  };
}

function createDraft(): JobPostingDraft {
  return {
    enterpriseType: EnterpriseType.PRIVATE,
    company: "테스트 기업",
    jobRole: "개발",
    title: "개발 인턴",
    deadline: new Date("2026-09-30T14:59:59.000Z"),
    jobCategory: "개발",
    source: PostingSource.USER,
    criteria: [],
  };
}

function createRepository(postings: JobPosting[] = []) {
  return {
    findAll: vi.fn(async () => postings),
    create: vi.fn(async (draft: JobPostingDraft) => ({
      ...createPosting(
        "saved",
        draft.enterpriseType,
        new Date("2026-09-02T00:00:00.000Z"),
        draft.deadline,
      ),
      company: draft.company,
      jobRole: draft.jobRole,
      title: draft.title,
      jobCategory: draft.jobCategory,
      source: draft.source,
    })),
  } satisfies PostingRepository;
}

describe("PostingService", () => {
  it("returns an empty list when no postings are stored", async () => {
    await expect(
      new PostingService(createRepository()).listPostings(),
    ).resolves.toEqual([]);
  });

  it("returns all postings in newest-first order", async () => {
    const repository = createRepository([
      createPosting(
        "old",
        EnterpriseType.PUBLIC,
        new Date("2026-01-01"),
        null,
      ),
      createPosting(
        "new",
        EnterpriseType.PRIVATE,
        new Date("2026-02-01"),
        new Date("2026-10-01"),
      ),
    ]);

    await expect(
      new PostingService(repository).listPostings(),
    ).resolves.toMatchObject([{ id: "new" }, { id: "old" }]);
  });

  it("returns only private postings in deadline order with null last", async () => {
    const repository = createRepository([
      createPosting(
        "late",
        EnterpriseType.PRIVATE,
        new Date(0),
        new Date("2026-10-01"),
      ),
      createPosting(
        "public",
        EnterpriseType.PUBLIC,
        new Date(0),
        new Date("2026-01-01"),
      ),
      createPosting(
        "missing",
        EnterpriseType.PRIVATE,
        new Date(0),
        null,
      ),
      createPosting(
        "early",
        EnterpriseType.PRIVATE,
        new Date(0),
        new Date("2026-09-01"),
      ),
    ]);

    await expect(
      new PostingService(repository).listPrivatePostings(),
    ).resolves.toMatchObject([
      { id: "early" },
      { id: "late" },
      { id: "missing" },
    ]);
  });

  it("saves a valid reviewed draft", async () => {
    const repository = createRepository();
    const draft = createDraft();
    const service = new PostingService(repository);

    await expect(service.savePosting(draft)).resolves.toMatchObject({
      id: "saved",
      company: draft.company,
      jobRole: draft.jobRole,
    });
    expect(repository.create).toHaveBeenCalledWith(draft);
  });

  it("rejects missing required fields without calling the repository", async () => {
    const repository = createRepository();
    const draft = {
      ...createDraft(),
      company: " ",
      jobRole: null,
      deadline: null,
    };

    await expect(
      new PostingService(repository).savePosting(draft),
    ).rejects.toMatchObject({
      fields: ["company", "jobRole", "deadline"],
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("preserves the reviewed draft when persistence fails", async () => {
    const repository = createRepository();
    repository.create.mockRejectedValueOnce(new Error("database unavailable"));
    const draft = createDraft();
    const snapshot = structuredClone(draft);

    await expect(
      new PostingService(repository).savePosting(draft),
    ).rejects.toThrow("database unavailable");
    expect(draft).toEqual(snapshot);
  });
});
