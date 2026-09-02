import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  validateProfile,
  type CredentialProfileInput,
  type ProfileValidationField,
} from "@/domain";

describe("validateProfile", () => {
  it("accepts missing scores and all valid boundary values", () => {
    expect(
      validateProfile({
        languageScore: null,
        koreanHistoryGrade: null,
        certifications: [],
      }),
    ).toEqual({ valid: true });

    expect(
      validateProfile({
        languageScore: 990,
        koreanHistoryGrade: 6,
        certifications: Array.from({ length: 50 }, () => "가".repeat(100)),
      }),
    ).toEqual({ valid: true });
  });

  it("identifies invalid score fields", () => {
    const result = validateProfile({
      languageScore: 990.5,
      koreanHistoryGrade: 0,
      certifications: [],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map(({ field }) => field)).toEqual([
        "languageScore",
        "koreanHistoryGrade",
      ]);
    }
  });

  it("identifies excessive certification count and the long item index", () => {
    const certifications = Array.from({ length: 51 }, () => "자격증");
    certifications[7] = "가".repeat(101);

    const result = validateProfile({
      languageScore: 0,
      koreanHistoryGrade: 1,
      certifications,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toEqual([
        {
          field: "certifications",
          message: "자격증은 최대 50개까지 저장할 수 있습니다.",
        },
        {
          field: "certifications",
          itemIndex: 7,
          message: "자격증 항목은 100자를 초과할 수 없습니다.",
        },
      ]);
    }
  });

  it("Feature: job-posting-dashboard, Property 20: 자격 프로필 검증", () => {
    const optionalScore = (minimum: number, maximum: number) =>
      fc.option(
        fc.oneof(
          fc.integer({ min: minimum, max: maximum }),
          fc.double({
            min: minimum,
            max: maximum,
            noNaN: true,
            noDefaultInfinity: true,
          }),
        ),
        { nil: null },
      );
    const certification = fc
      .integer({ min: 0, max: 110 })
      .map((length) => "가".repeat(length));

    fc.assert(
      fc.property(
        optionalScore(-100, 1_100),
        optionalScore(-10, 20),
        fc.array(certification, { maxLength: 55 }),
        (languageScore, koreanHistoryGrade, certifications) => {
          const input: CredentialProfileInput = {
            languageScore,
            koreanHistoryGrade,
            certifications,
          };
          const snapshot = {
            ...input,
            certifications: [...input.certifications],
          };
          const result = validateProfile(input);

          const invalidFields = new Set<ProfileValidationField>();

          if (
            languageScore !== null &&
            (!Number.isInteger(languageScore) ||
              languageScore < 0 ||
              languageScore > 990)
          ) {
            invalidFields.add("languageScore");
          }

          if (
            koreanHistoryGrade !== null &&
            (!Number.isInteger(koreanHistoryGrade) ||
              koreanHistoryGrade < 1 ||
              koreanHistoryGrade > 6)
          ) {
            invalidFields.add("koreanHistoryGrade");
          }

          if (
            certifications.length > 50 ||
            certifications.some((item) => item.length > 100)
          ) {
            invalidFields.add("certifications");
          }

          expect(result.valid).toBe(invalidFields.size === 0);
          expect(input).toEqual(snapshot);

          if (!result.valid) {
            expect(new Set(result.issues.map(({ field }) => field))).toEqual(
              invalidFields,
            );
          }
        },
      ),
    );
  });
});
