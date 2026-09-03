import { describe, expect, it, vi } from "vitest";
import {
  CREDENTIAL_PROFILE_ID,
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
  LanguageTestType,
  type CredentialProfile,
  type JobPosting,
} from "@/domain";
import type { PostingRepository } from "@/server/repositories/posting-repository";
import type { ProfileRepository } from "@/server/repositories/profile-repository";
import { FitService } from "./fit-service";

function createProfile(): CredentialProfile {
  return {
    id: CREDENTIAL_PROFILE_ID,
    languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 900, level: null }],
    koreanHistoryGrade: 2,
    computerSkillGrade: 2,
    certifications: [],
    updatedAt: new Date(0),
  };
}

function createPosting(cutoffScore: number | null): JobPosting {
  return {
    id: "posting-1",
    enterpriseType: EnterpriseType.PUBLIC,
    company: "공기업",
    jobRole: "개발",
    title: "채용 공고",
    deadline: new Date("2026-10-01"),
    jobCategory: "개발",
    source: PostingSource.CRAWLED,
    createdAt: new Date(0),
    criteria: [
      {
        id: "criterion-1",
        postingId: "posting-1",
        type: CriterionType.LANGUAGE,
        requiredFlag: RequiredFlag.REQUIRED,
        languageRequirements: cutoffScore === null ? [] : [{ testType: LanguageTestType.TOEIC, score: cutoffScore, level: null }],
        cutoffScore,
        acceptableCerts: [],
      },
    ],
  };
}

function createPostingRepository(posting: JobPosting | null): PostingRepository {
  return {
    findAll: vi.fn(async () => (posting ? [posting] : [])),
    findById: vi.fn(async () => posting),
    create: vi.fn(),
  };
}

function createProfileRepository(
  profile: CredentialProfile | null,
): ProfileRepository {
  return {
    find: vi.fn(async () => profile),
    upsert: vi.fn(),
  };
}

describe("FitService", () => {
  it("guides the user when no profile exists", async () => {
    const result = await new FitService(
      createPostingRepository(createPosting(850)),
      createProfileRepository(null),
    ).getFit("posting-1");

    expect(result).toMatchObject({ ok: false, code: "PROFILE_NOT_FOUND" });
  });

  it("reports a missing posting", async () => {
    const result = await new FitService(
      createPostingRepository(null),
      createProfileRepository(createProfile()),
    ).getFit("missing");

    expect(result).toMatchObject({ ok: false, code: "POSTING_NOT_FOUND" });
  });

  it("guides the user when a required cutoff is undefined", async () => {
    const result = await new FitService(
      createPostingRepository(createPosting(null)),
      createProfileRepository(createProfile()),
    ).getFit("posting-1");

    expect(result).toMatchObject({ ok: false, code: "CUTOFF_NOT_DEFINED" });
  });

  it("returns a computed fit result", async () => {
    const result = await new FitService(
      createPostingRepository(createPosting(850)),
      createProfileRepository(createProfile()),
    ).getFit("posting-1");

    expect(result).toMatchObject({
      ok: true,
      value: {
        postingId: "posting-1",
        passLikelihoodPercent: 100,
      },
    });
  });
});
