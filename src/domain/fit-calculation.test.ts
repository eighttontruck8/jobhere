import { describe, expect, it } from "vitest";
import { CREDENTIAL_PROFILE_ID, CriterionType, LanguageTestType, RequiredFlag, computeFit, type CredentialProfile, type EvaluationCriterion, type LanguageRequirement } from "@/domain";

function profile(languageCredentials: LanguageRequirement[] = []): CredentialProfile {
  return { id: CREDENTIAL_PROFILE_ID, languageCredentials, koreanHistoryGrade: 2, computerSkillGrade: 2, certifications: ["정보처리기사"], updatedAt: new Date(0) };
}

function criterion(type: EvaluationCriterion["type"], update: Partial<EvaluationCriterion> = {}): EvaluationCriterion {
  return { id: type, postingId: "posting-1", type, requiredFlag: RequiredFlag.REQUIRED, languageRequirements: [], cutoffScore: null, acceptableCerts: [], ...update };
}

describe("computeFit", () => {
  it("TOEIC 점수는 숫자 기준으로 판정한다", () => {
    const result = computeFit([criterion(CriterionType.LANGUAGE, { languageRequirements: [{ testType: LanguageTestType.TOEIC, score: 850, level: null }] })], profile([{ testType: LanguageTestType.TOEIC, score: 900, level: null }]));
    expect(result).toMatchObject({ passLikelihoodPercent: 100, computable: true });
  });

  it("OPIc과 TOEIC Speaking의 같은 등급명을 서로 비교하지 않는다", () => {
    const result = computeFit([criterion(CriterionType.LANGUAGE, { languageRequirements: [{ testType: LanguageTestType.OPIC, score: null, level: "IH" }] })], profile([{ testType: LanguageTestType.TOEIC_SPEAKING, score: null, level: "IH" }]));
    expect(result.criterionFits[0]).toMatchObject({ status: "미충족", missing: true });
  });

  it("어학 환산표의 대체 기준 중 하나를 충족하면 통과한다", () => {
    const result = computeFit([criterion(CriterionType.LANGUAGE, { languageRequirements: [
      { testType: LanguageTestType.TOEIC, score: 900, level: null },
      { testType: LanguageTestType.OPIC, score: null, level: "IM3" },
    ] })], profile([{ testType: LanguageTestType.OPIC, score: null, level: "IH" }]));
    expect(result.criterionFits[0].status).toBe("충족");
  });

  it("한국사와 컴활은 숫자가 낮은 등급이 더 높은 수준이다", () => {
    const result = computeFit([criterion(CriterionType.KOREAN_HISTORY, { cutoffScore: 3 }), criterion(CriterionType.COMPUTER_SKILL, { cutoffScore: 1 })], profile());
    expect(result.satisfiedRequiredCount).toBe(1);
    expect(result.passLikelihoodPercent).toBe(50);
  });

  it("보유 자격증 이름이 인정 목록과 일치하면 통과한다", () => {
    const result = computeFit([criterion(CriterionType.OTHER_CERT, { acceptableCerts: ["정보처리기사"] })], profile());
    expect(result.criterionFits[0].status).toBe("충족");
  });

  it("필수 기준값이 없으면 계산 불가로 처리한다", () => {
    expect(computeFit([criterion(CriterionType.LANGUAGE)], profile())).toMatchObject({ computable: false, passLikelihoodPercent: 0 });
  });
});
