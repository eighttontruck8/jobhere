import {
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
  isLanguageRequirement,
  type EvaluationCriterionDraft,
} from "@/domain";
import type { ExtractedPosting } from "./analysis-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function parseNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new TypeError("문자열 필드 형식 오류");
  return value;
}

function parseDeadline(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  const date = value instanceof Date
    ? new Date(value.getTime())
    : typeof value === "string"
      ? new Date(value)
      : null;

  if (date === null || Number.isNaN(date.getTime())) {
    throw new TypeError("마감 기한 형식 오류");
  }

  return date;
}

function parseCriteria(value: unknown): EvaluationCriterionDraft[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError("평가 기준 목록 형식 오류");

  return value.map((criterion) => {
    if (
      !isRecord(criterion) ||
      !isEnumValue(Object.values(CriterionType), criterion.type) ||
      !isEnumValue(Object.values(RequiredFlag), criterion.requiredFlag)
    ) {
      throw new TypeError("평가 기준 형식 오류");
    }

    const cutoffScore = criterion.cutoffScore ?? null;
    const acceptableCerts = criterion.acceptableCerts ?? [];
    const languageRequirements = criterion.languageRequirements ?? [];

    if (
      (cutoffScore !== null && !Number.isInteger(cutoffScore)) ||
      !Array.isArray(languageRequirements) ||
      !languageRequirements.every(isLanguageRequirement) ||
      !Array.isArray(acceptableCerts) ||
      !acceptableCerts.every((item) => typeof item === "string")
    ) {
      throw new TypeError("평가 기준 값 형식 오류");
    }

    return {
      type: criterion.type,
      requiredFlag: criterion.requiredFlag,
      languageRequirements,
      cutoffScore: cutoffScore as number | null,
      acceptableCerts,
    };
  });
}

function parsePosting(value: unknown): ExtractedPosting {
  if (
    !isRecord(value) ||
    !isEnumValue(Object.values(EnterpriseType), value.enterpriseType) ||
    typeof value.title !== "string"
  ) {
    throw new TypeError("공고 형식 오류");
  }

  return {
    enterpriseType: value.enterpriseType,
    company: parseNullableString(value.company),
    jobRole: parseNullableString(value.jobRole),
    title: value.title,
    deadline: parseDeadline(value.deadline),
    jobCategory: parseNullableString(value.jobCategory),
    source: PostingSource.USER,
    criteria: parseCriteria(value.criteria),
  };
}

export function parseExtractedPostings(value: unknown): ExtractedPosting[] {
  const candidates = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.postings)
      ? value.postings
      : null;

  if (candidates === null || candidates.length === 0) {
    throw new TypeError("추출된 공고가 없습니다.");
  }

  return candidates.map(parsePosting);
}
