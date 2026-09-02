import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_PROFILE_ID,
  CriterionType,
  RequiredFlag,
  computeFit,
  type CredentialProfile,
  type EvaluationCriterion,
} from "@/domain";

function createProfile(
  languageScore: number | null,
  koreanHistoryGrade: number | null,
): CredentialProfile {
  return {
    id: CREDENTIAL_PROFILE_ID,
    languageScore,
    koreanHistoryGrade,
    certifications: [],
    updatedAt: new Date(0),
  };
}

function createCriterion(
  type: EvaluationCriterion["type"],
  cutoffScore: number | null,
  requiredFlag: EvaluationCriterion["requiredFlag"] = RequiredFlag.REQUIRED,
): EvaluationCriterion {
  return {
    id: `${type}-${cutoffScore}`,
    postingId: "posting-1",
    type,
    requiredFlag,
    cutoffScore,
    acceptableCerts: [],
  };
}

describe("computeFit", () => {
  it("ignores optional criteria and maps Korean history grades in ascending quality order", () => {
    const result = computeFit(
      [
        createCriterion(CriterionType.LANGUAGE, 900, RequiredFlag.OPTIONAL),
        createCriterion(CriterionType.KOREAN_HISTORY, 3),
      ],
      createProfile(100, 2),
    );

    expect(result).toMatchObject({
      postingId: "posting-1",
      satisfiedRequiredCount: 1,
      totalRequiredCount: 1,
      passLikelihoodPercent: 100,
      computable: true,
    });
    expect(result.criterionFits).toEqual([
      {
        type: CriterionType.KOREAN_HISTORY,
        cutoffScore: 3,
        profileScore: 2,
        status: "충족",
        missing: false,
      },
    ]);
  });

  it("marks a result as not computable when required cutoffs are absent", () => {
    expect(computeFit([], createProfile(900, 1))).toMatchObject({
      computable: false,
      totalRequiredCount: 0,
      passLikelihoodPercent: 0,
    });

    expect(
      computeFit(
        [createCriterion(CriterionType.LANGUAGE, null)],
        createProfile(900, 1),
      ),
    ).toMatchObject({
      computable: false,
      totalRequiredCount: 1,
      passLikelihoodPercent: 0,
    });
  });

  it("treats a required certification criterion as missing without a numeric profile score", () => {
    const result = computeFit(
      [createCriterion(CriterionType.OTHER_CERT, 1)],
      createProfile(900, 1),
    );

    expect(result.criterionFits[0]).toMatchObject({
      status: "미충족",
      missing: true,
      profileScore: null,
    });
    expect(result.missingCriteria).toEqual([CriterionType.OTHER_CERT]);
  });

  it("Feature: job-posting-dashboard, Property 21: 충족/미충족 판정", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 990 }),
        fc.integer({ min: 0, max: 990 }),
        (profileScore, cutoffScore) => {
          const result = computeFit(
            [createCriterion(CriterionType.LANGUAGE, cutoffScore)],
            createProfile(profileScore, null),
          );

          expect(result.criterionFits[0].status).toBe(
            profileScore >= cutoffScore ? "충족" : "미충족",
          );
        },
      ),
    );
  });

  it("Feature: job-posting-dashboard, Property 22: 합격 가능성 비율", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 990 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 990 }),
        fc.integer({ min: 1, max: 6 }),
        (languageScore, historyGrade, languageCutoff, historyCutoff) => {
          const result = computeFit(
            [
              createCriterion(CriterionType.LANGUAGE, languageCutoff),
              createCriterion(CriterionType.KOREAN_HISTORY, historyCutoff),
            ],
            createProfile(languageScore, historyGrade),
          );
          const expectedSatisfied =
            Number(languageScore >= languageCutoff) +
            Number(historyGrade <= historyCutoff);

          expect(result.satisfiedRequiredCount).toBe(expectedSatisfied);
          expect(result.passLikelihoodPercent).toBe(
            Math.round((expectedSatisfied / 2) * 100),
          );
          expect(result.passLikelihoodPercent).toBeGreaterThanOrEqual(0);
          expect(result.passLikelihoodPercent).toBeLessThanOrEqual(100);
        },
      ),
    );
  });

  it("Feature: job-posting-dashboard, Property 23: 누락 점수 미충족 처리", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          CriterionType.LANGUAGE,
          CriterionType.KOREAN_HISTORY,
        ),
        fc.integer({ min: 1, max: 6 }),
        (type, cutoffScore) => {
          const result = computeFit(
            [createCriterion(type, cutoffScore)],
            createProfile(null, null),
          );

          expect(result.criterionFits[0]).toMatchObject({
            type,
            status: "미충족",
            missing: true,
          });
          expect(result.missingCriteria).toContain(type);
        },
      ),
    );
  });
});
