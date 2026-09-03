import {
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
  isLanguageRequirement,
  type EvaluationCriterionDraft,
  type JobPostingDraft,
} from "@/domain";

export const REVIEW_DRAFTS_STORAGE_KEY = "jobhere.review-drafts";

export interface SerializedPostingDraft
  extends Omit<JobPostingDraft, "deadline"> {
  deadline: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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

function parseNullableString(value: unknown): string | null {
  return value === null || typeof value === "string" ? value : null;
}

function parseCriteria(value: unknown): EvaluationCriterionDraft[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((criterion) => {
    if (
      !isRecord(criterion) ||
      !isEnumValue(Object.values(CriterionType), criterion.type) ||
      !isEnumValue(Object.values(RequiredFlag), criterion.requiredFlag)
    ) {
      return [];
    }

    const cutoffScore = criterion.cutoffScore;
    const acceptableCerts = criterion.acceptableCerts;
    const languageRequirements = criterion.languageRequirements;

    return [
      {
        type: criterion.type,
        requiredFlag: criterion.requiredFlag,
        languageRequirements: Array.isArray(languageRequirements)
          ? languageRequirements.filter(isLanguageRequirement)
          : [],
        cutoffScore: Number.isInteger(cutoffScore)
          ? (cutoffScore as number)
          : null,
        acceptableCerts: Array.isArray(acceptableCerts)
          ? acceptableCerts.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      },
    ];
  });
}

export function parseSerializedDrafts(value: unknown): SerializedPostingDraft[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((draft) => {
    if (
      !isRecord(draft) ||
      !isEnumValue(Object.values(EnterpriseType), draft.enterpriseType) ||
      typeof draft.title !== "string"
    ) {
      return [];
    }

    return [
      {
        enterpriseType: draft.enterpriseType,
        company: parseNullableString(draft.company),
        jobRole: parseNullableString(draft.jobRole),
        title: draft.title,
        deadline: parseNullableString(draft.deadline),
        jobCategory: parseNullableString(draft.jobCategory),
        source: isEnumValue(Object.values(PostingSource), draft.source)
          ? draft.source
          : PostingSource.USER,
        criteria: parseCriteria(draft.criteria),
      },
    ];
  });
}

export function readReviewDrafts(storage: StorageLike): SerializedPostingDraft[] {
  const stored = storage.getItem(REVIEW_DRAFTS_STORAGE_KEY);
  if (!stored) return [];

  try {
    return parseSerializedDrafts(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
}

export function writeReviewDrafts(
  storage: StorageLike,
  drafts: readonly SerializedPostingDraft[],
): void {
  if (drafts.length === 0) {
    storage.removeItem(REVIEW_DRAFTS_STORAGE_KEY);
    return;
  }

  storage.setItem(REVIEW_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
}

export function updateReviewDraft(
  drafts: readonly SerializedPostingDraft[],
  index: number,
  update: Partial<SerializedPostingDraft>,
): SerializedPostingDraft[] {
  return drafts.map((draft, itemIndex) =>
    itemIndex === index ? { ...draft, ...update } : draft,
  );
}

export function toJobPostingDraft(
  draft: SerializedPostingDraft,
): JobPostingDraft {
  return {
    ...draft,
    deadline: draft.deadline ? new Date(draft.deadline) : null,
  };
}
