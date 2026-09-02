import { describe, expect, it, vi } from "vitest";
import {
  EnterpriseType,
  PostingSource,
  type JobPosting,
} from "@/domain";
import type { PostingRepository } from "@/server/repositories/posting-repository";
import { TableService } from "./table-service";

function createPosting(
  id: string,
  enterpriseType: JobPosting["enterpriseType"],
  jobCategory: string,
): JobPosting {
  return {
    id,
    enterpriseType,
    company: `기업 ${id}`,
    jobRole: `직무 ${id}`,
    title: `공고 ${id}`,
    deadline: null,
    jobCategory,
    source: PostingSource.CRAWLED,
    createdAt: new Date(0),
    criteria: [],
  };
}

describe("TableService", () => {
  it("loads postings and delegates public table filtering", async () => {
    const repository: PostingRepository = {
      findAll: vi.fn(async () => [
        createPosting("public", EnterpriseType.PUBLIC, "개발"),
        createPosting("private", EnterpriseType.PRIVATE, "개발"),
        createPosting("other", EnterpriseType.PUBLIC, "기획"),
      ]),
      create: vi.fn(),
    };

    await expect(
      new TableService(repository).buildEvaluationTable("개발"),
    ).resolves.toMatchObject({
      filter: "개발",
      rows: [{ postingId: "public" }],
    });
  });
});
