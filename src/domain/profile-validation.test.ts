import { describe, expect, it } from "vitest";
import { LanguageTestType, validateProfile, type CredentialProfileInput } from "@/domain";

function validProfile(update: Partial<CredentialProfileInput> = {}): CredentialProfileInput {
  return { languageCredentials: [], koreanHistoryGrade: null, computerSkillGrade: null, certifications: [], ...update };
}

describe("validateProfile", () => {
  it("시험별 어학 점수와 허용 등급을 검증한다", () => {
    expect(validateProfile(validProfile({ languageCredentials: [
      { testType: LanguageTestType.TOEIC, score: 990, level: null },
      { testType: LanguageTestType.OPIC, score: null, level: "AL" },
      { testType: LanguageTestType.TOEIC_SPEAKING, score: null, level: "AH" },
    ] }))).toEqual({ valid: true });
    expect(validateProfile(validProfile({ languageCredentials: [
      { testType: LanguageTestType.OPIC, score: null, level: "AM" },
    ] })).valid).toBe(false);
  });

  it("동일 시험 중복과 TOEIC 범위 오류를 거부한다", () => {
    expect(validateProfile(validProfile({ languageCredentials: [
      { testType: LanguageTestType.TOEIC, score: 800, level: null },
      { testType: LanguageTestType.TOEIC, score: 991, level: null },
    ] })).valid).toBe(false);
  });

  it("한국사 1~3급과 컴활 1~2급만 허용한다", () => {
    expect(validateProfile(validProfile({ koreanHistoryGrade: 3, computerSkillGrade: 2 }))).toEqual({ valid: true });
    const result = validateProfile(validProfile({ koreanHistoryGrade: 4, computerSkillGrade: 3 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map(({ field }) => field)).toEqual(["koreanHistoryGrade", "computerSkillGrade"]);
  });

  it("자격증 개수와 글자 수 제한을 검증한다", () => {
    const certifications = Array.from({ length: 51 }, () => "자격증");
    certifications[7] = "가".repeat(101);
    const result = validateProfile(validProfile({ certifications }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map(({ field }) => field)).toEqual(["certifications", "certifications"]);
  });
});
