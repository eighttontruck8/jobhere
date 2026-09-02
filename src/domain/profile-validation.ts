import type {
  CredentialProfileInput,
  ValidationIssue,
  ValidationResult,
} from "./profile";

export const PROFILE_LIMITS = {
  languageScore: { min: 0, max: 990 },
  koreanHistoryGrade: { min: 1, max: 6 },
  certificationCount: 50,
  certificationLength: 100,
} as const;

function isIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function validateProfile(
  input: CredentialProfileInput,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (
    input.languageScore !== null &&
    !isIntegerInRange(
      input.languageScore,
      PROFILE_LIMITS.languageScore.min,
      PROFILE_LIMITS.languageScore.max,
    )
  ) {
    issues.push({
      field: "languageScore",
      message: "어학 점수는 0~990 범위의 정수여야 합니다.",
    });
  }

  if (
    input.koreanHistoryGrade !== null &&
    !isIntegerInRange(
      input.koreanHistoryGrade,
      PROFILE_LIMITS.koreanHistoryGrade.min,
      PROFILE_LIMITS.koreanHistoryGrade.max,
    )
  ) {
    issues.push({
      field: "koreanHistoryGrade",
      message: "한국사 등급은 1~6 범위의 정수여야 합니다.",
    });
  }

  if (input.certifications.length > PROFILE_LIMITS.certificationCount) {
    issues.push({
      field: "certifications",
      message: "자격증은 최대 50개까지 저장할 수 있습니다.",
    });
  }

  input.certifications.forEach((certification, itemIndex) => {
    if (certification.length > PROFILE_LIMITS.certificationLength) {
      issues.push({
        field: "certifications",
        itemIndex,
        message: "자격증 항목은 100자를 초과할 수 없습니다.",
      });
    }
  });

  return issues.length === 0 ? { valid: true } : { valid: false, issues };
}
