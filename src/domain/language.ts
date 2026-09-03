import {
  LanguageTestType,
  OPIC_LEVELS,
  TOEIC_SPEAKING_LEVELS,
  type LanguageTestType as LanguageTestTypeValue,
} from "./constants";

export interface LanguageRequirement {
  testType: LanguageTestTypeValue;
  score: number | null;
  level: string | null;
}

export const LANGUAGE_TEST_LABELS: Record<LanguageTestTypeValue, string> = {
  [LanguageTestType.TOEIC]: "TOEIC",
  [LanguageTestType.OPIC]: "OPIc",
  [LanguageTestType.TOEIC_SPEAKING]: "TOEIC Speaking",
};

export function getLanguageLevels(
  testType: LanguageTestTypeValue,
): readonly string[] {
  if (testType === LanguageTestType.OPIC) return OPIC_LEVELS;
  if (testType === LanguageTestType.TOEIC_SPEAKING) return TOEIC_SPEAKING_LEVELS;
  return [];
}

export function isLanguageRequirement(value: unknown): value is LanguageRequirement {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  if (!Object.values(LanguageTestType).includes(candidate.testType as LanguageTestTypeValue)) {
    return false;
  }

  if (candidate.testType === LanguageTestType.TOEIC) {
    return Number.isInteger(candidate.score) &&
      (candidate.score as number) >= 0 &&
      (candidate.score as number) <= 990 &&
      candidate.level === null;
  }

  return candidate.score === null &&
    typeof candidate.level === "string" &&
    getLanguageLevels(candidate.testType as LanguageTestTypeValue).includes(candidate.level);
}

export function parseLanguageRequirements(value: unknown): LanguageRequirement[] {
  if (!Array.isArray(value) || !value.every(isLanguageRequirement)) return [];
  return value.map((item) => ({ ...item }));
}

export function formatLanguageRequirement(requirement: LanguageRequirement): string {
  const value = requirement.testType === LanguageTestType.TOEIC
    ? `${requirement.score ?? "-"}점`
    : requirement.level ?? "-";
  return `${LANGUAGE_TEST_LABELS[requirement.testType]} ${value}`;
}
