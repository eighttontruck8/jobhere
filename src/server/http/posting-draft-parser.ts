import {
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
  type EvaluationCriterionDraft,
  type JobPostingDraft,
} from "@/domain";

export class RequestBodyValidationError extends Error {
  constructor(public readonly fields: string[]) {
    super("요청 본문 형식이 올바르지 않습니다.");
    this.name = "RequestBodyValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function parseNullableString(value: unknown, field: string): string | null {
  if (value === null || typeof value === "string") {
    return value;
  }

  throw new RequestBodyValidationError([field]);
}

function parseCriteria(value: unknown): EvaluationCriterionDraft[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new RequestBodyValidationError(["criteria"]);
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new RequestBodyValidationError([`criteria.${index}`]);
    }

    if (
      !isEnumValue(Object.values(CriterionType), item.type) ||
      !isEnumValue(Object.values(RequiredFlag), item.requiredFlag)
    ) {
      throw new RequestBodyValidationError([`criteria.${index}`]);
    }

    const cutoffScore = item.cutoffScore ?? null;
    const acceptableCerts = item.acceptableCerts ?? [];

    if (
      (cutoffScore !== null && !Number.isInteger(cutoffScore)) ||
      !Array.isArray(acceptableCerts) ||
      !acceptableCerts.every((certification) => typeof certification === "string")
    ) {
      throw new RequestBodyValidationError([`criteria.${index}`]);
    }

    return {
      type: item.type,
      requiredFlag: item.requiredFlag,
      cutoffScore: cutoffScore as number | null,
      acceptableCerts,
    };
  });
}

export function parseJobPostingDraft(value: unknown): JobPostingDraft {
  if (!isRecord(value)) {
    throw new RequestBodyValidationError(["body"]);
  }

  if (!isEnumValue(Object.values(EnterpriseType), value.enterpriseType)) {
    throw new RequestBodyValidationError(["enterpriseType"]);
  }

  if (typeof value.title !== "string") {
    throw new RequestBodyValidationError(["title"]);
  }

  const source = value.source ?? PostingSource.USER;
  if (!isEnumValue(Object.values(PostingSource), source)) {
    throw new RequestBodyValidationError(["source"]);
  }

  let deadline: Date | null = null;
  if (value.deadline !== null && value.deadline !== undefined) {
    if (typeof value.deadline !== "string") {
      throw new RequestBodyValidationError(["deadline"]);
    }

    deadline = new Date(value.deadline);
    if (Number.isNaN(deadline.getTime())) {
      throw new RequestBodyValidationError(["deadline"]);
    }
  }

  return {
    enterpriseType: value.enterpriseType,
    company: parseNullableString(value.company ?? null, "company"),
    jobRole: parseNullableString(value.jobRole ?? null, "jobRole"),
    title: value.title,
    deadline,
    jobCategory: parseNullableString(value.jobCategory ?? null, "jobCategory"),
    source,
    criteria: parseCriteria(value.criteria),
  };
}
