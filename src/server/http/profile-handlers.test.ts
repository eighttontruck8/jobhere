import { describe, expect, it, vi } from "vitest";
import {
  CREDENTIAL_PROFILE_ID,
  LanguageTestType,
  type CredentialProfile,
} from "@/domain";
import type { ProfileServiceContract } from "@/server/services/profile-service";
import { createProfileHandlers } from "./profile-handlers";

function createProfile(): CredentialProfile {
  return {
    id: CREDENTIAL_PROFILE_ID,
    languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 900, level: null }],
    koreanHistoryGrade: 2,
    computerSkillGrade: 1,
    certifications: ["정보처리기사"],
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  };
}

function createService(profile: CredentialProfile | null): ProfileServiceContract {
  return {
    getProfile: vi.fn(async () => profile),
    saveProfile: vi.fn(async () => ({
      ok: true as const,
      value: createProfile(),
    })),
  };
}

describe("profile handlers", () => {
  it("returns an explicit empty profile state", async () => {
    const response = await createProfileHandlers(createService(null)).GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: null,
      message: "저장된 자격 정보가 없습니다.",
    });
  });

  it("parses and saves a valid profile", async () => {
    const service = createService(null);
    const response = await createProfileHandlers(service).PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 900, level: null }],
          koreanHistoryGrade: 2,
          computerSkillGrade: 1,
          certifications: ["정보처리기사"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(service.saveProfile).toHaveBeenCalledWith({
      languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 900, level: null }],
      koreanHistoryGrade: 2,
      computerSkillGrade: 1,
      certifications: ["정보처리기사"],
    });
  });

  it("distinguishes malformed input from domain validation errors", async () => {
    const malformedResponse = await createProfileHandlers(
      createService(null),
    ).PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCredentials: "900",
          koreanHistoryGrade: 2,
          computerSkillGrade: 1,
          certifications: [],
        }),
      }),
    );

    expect(malformedResponse.status).toBe(400);

    const service = createService(null);
    vi.mocked(service.saveProfile).mockResolvedValueOnce({
      ok: false,
      message: "자격 프로필 입력값을 확인해 주세요.",
      issues: [
        {
          field: "languageCredentials",
          message: "시험별 어학 점수 또는 등급을 올바르게 입력해 주세요.",
        },
      ],
    });
    const invalidResponse = await createProfileHandlers(service).PUT(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCredentials: [
            { testType: LanguageTestType.TOEIC, score: 900, level: null },
            { testType: LanguageTestType.TOEIC, score: 800, level: null },
          ],
          koreanHistoryGrade: 2,
          computerSkillGrade: 1,
          certifications: [],
        }),
      }),
    );

    expect(invalidResponse.status).toBe(422);
  });
});
