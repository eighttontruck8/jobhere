import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import {
  CREDENTIAL_PROFILE_ID,
  LanguageTestType,
  type CredentialProfile,
  type CredentialProfileInput,
} from "@/domain";
import type { ProfileRepository } from "@/server/repositories/profile-repository";
import { ProfileService } from "./profile-service";

function createMemoryRepository(initial: CredentialProfile | null = null) {
  let stored = initial;

  const repository: ProfileRepository = {
    find: vi.fn(async () => stored),
    upsert: vi.fn(async (input: CredentialProfileInput) => {
      stored = {
        id: CREDENTIAL_PROFILE_ID,
        ...input,
        certifications: [...input.certifications],
        updatedAt: new Date("2026-09-02T00:00:00.000Z"),
      };
      return stored;
    }),
  };

  return repository;
}

describe("ProfileService", () => {
  it("returns null when the singleton profile does not exist", async () => {
    await expect(
      new ProfileService(createMemoryRepository()).getProfile(),
    ).resolves.toBeNull();
  });

  it("rejects invalid input and preserves the stored profile", async () => {
    const existing: CredentialProfile = {
      id: CREDENTIAL_PROFILE_ID,
      languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 800, level: null }],
      koreanHistoryGrade: 2,
      computerSkillGrade: 2,
      certifications: ["정보처리기사"],
      updatedAt: new Date("2026-01-01"),
    };
    const repository = createMemoryRepository(existing);
    const service = new ProfileService(repository);
    const result = await service.saveProfile({
      languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 991, level: null }],
      koreanHistoryGrade: 2,
      computerSkillGrade: 2,
      certifications: [],
    });

    expect(result).toMatchObject({ ok: false });
    expect(repository.upsert).not.toHaveBeenCalled();
    await expect(service.getProfile()).resolves.toEqual(existing);
  });

  it("returns a failure result when persistence fails", async () => {
    const repository = createMemoryRepository();
    vi.mocked(repository.upsert).mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(
      new ProfileService(repository).saveProfile({
        languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 900, level: null }],
        koreanHistoryGrade: 1,
        computerSkillGrade: 1,
        certifications: [],
      }),
    ).resolves.toEqual({
      ok: false,
      message: "자격 프로필을 저장하지 못했습니다.",
    });
  });

  it("Feature: job-posting-dashboard, Property 19: 자격 프로필 왕복", async () => {
    const optionalLanguage = fc.array(fc.constant({ testType: LanguageTestType.TOEIC, score: 900, level: null }), { maxLength: 1 });
    const optionalHistory = fc.option(fc.integer({ min: 1, max: 3 }), {
      nil: null,
    });
    const certification = fc
      .integer({ min: 0, max: 100 })
      .map((length) => "가".repeat(length));

    await fc.assert(
      fc.asyncProperty(
        optionalLanguage,
        optionalHistory,
        fc.array(certification, { maxLength: 50 }),
        async (languageCredentials, koreanHistoryGrade, certifications) => {
          const input = {
            languageCredentials,
            koreanHistoryGrade,
            computerSkillGrade: null,
            certifications,
          };
          const service = new ProfileService(createMemoryRepository());
          const saveResult = await service.saveProfile(input);
          const loaded = await service.getProfile();

          expect(saveResult.ok).toBe(true);
          expect(loaded).toMatchObject(input);
          expect(loaded?.certifications).toEqual(certifications);
        },
      ),
    );
  });
});
