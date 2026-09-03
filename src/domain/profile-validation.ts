import type {
  CredentialProfileInput,
  ValidationIssue,
  ValidationResult,
} from "./profile";
import { isLanguageRequirement } from "./language";

export const PROFILE_LIMITS = {
  languageCredentialCount: 3,
  koreanHistoryGrade: { min: 1, max: 3 },
  computerSkillGrade: { min: 1, max: 2 },
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
    input.languageCredentials.length > PROFILE_LIMITS.languageCredentialCount ||
    !input.languageCredentials.every(isLanguageRequirement) ||
    new Set(input.languageCredentials.map(({ testType }) => testType)).size !==
      input.languageCredentials.length
  ) {
    issues.push({
      field: "languageCredentials",
      message: "시험별 어학 점수 또는 등급을 올바르게 입력해 주세요.",
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
      message: "한국사 등급은 1~3급 중에서 선택해 주세요.",
    });
  }

  if (
    input.computerSkillGrade !== null &&
    !isIntegerInRange(
      input.computerSkillGrade,
      PROFILE_LIMITS.computerSkillGrade.min,
      PROFILE_LIMITS.computerSkillGrade.max,
    )
  ) {
    issues.push({
      field: "computerSkillGrade",
      message: "컴퓨터활용능력 등급은 1~2급 중에서 선택해 주세요.",
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
