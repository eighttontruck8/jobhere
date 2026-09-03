import {
  CriterionType,
  EnterpriseType,
} from "./constants";
import { formatLanguageRequirement } from "./language";
import type {
  AddResult,
  EvaluationCriterion,
  EvaluationCriterionCell,
  EvaluationTable,
  EvaluationTableRow,
  JobCategory,
  JobPosting,
} from "./job-posting";

export const EVALUATION_TABLE_LIMIT = 20;

export const EVALUATION_TABLE_PLACEHOLDERS = {
  criterion: "기준 정보 없음",
  cutoff: "커트라인 정보 없음",
  certifications: "자격증 정보 없음",
} as const;

function createCriterionCell(
  type: EvaluationCriterion["type"],
  criterion?: EvaluationCriterion,
): EvaluationCriterionCell {
  if (!criterion) {
    return {
      type,
      requiredFlag: null,
      languageRequirements: [],
      cutoffScore: null,
      acceptableCerts: [],
      displayValue: EVALUATION_TABLE_PLACEHOLDERS.criterion,
    };
  }

  if (criterion.type === CriterionType.LANGUAGE) {
    return {
      type,
      requiredFlag: criterion.requiredFlag,
      languageRequirements: criterion.languageRequirements.map((item) => ({ ...item })),
      cutoffScore: criterion.cutoffScore,
      acceptableCerts: [...criterion.acceptableCerts],
      displayValue: criterion.languageRequirements.length === 0
        ? EVALUATION_TABLE_PLACEHOLDERS.cutoff
        : criterion.languageRequirements.map(formatLanguageRequirement).join(" / "),
    };
  }

  if (
    criterion.type === CriterionType.KOREAN_HISTORY ||
    criterion.type === CriterionType.COMPUTER_SKILL
  ) {
    return {
      type,
      requiredFlag: criterion.requiredFlag,
      languageRequirements: [],
      cutoffScore: criterion.cutoffScore,
      acceptableCerts: [...criterion.acceptableCerts],
      displayValue: criterion.cutoffScore === null
        ? EVALUATION_TABLE_PLACEHOLDERS.cutoff
        : `${criterion.cutoffScore}급`,
    };
  }

  return {
    type,
    requiredFlag: criterion.requiredFlag,
    languageRequirements: [],
    cutoffScore: criterion.cutoffScore,
    acceptableCerts: [...criterion.acceptableCerts],
    displayValue:
      criterion.acceptableCerts.length === 0
        ? EVALUATION_TABLE_PLACEHOLDERS.certifications
        : criterion.acceptableCerts.join(", "),
  };
}

export function toEvaluationTableRow(
  posting: JobPosting,
): EvaluationTableRow {
  const criteriaByType = new Map(
    posting.criteria.map((criterion) => [criterion.type, criterion]),
  );

  return {
    postingId: posting.id,
    company: posting.company,
    jobRole: posting.jobRole,
    jobCategory: posting.jobCategory,
    criteria: {
      [CriterionType.LANGUAGE]: createCriterionCell(
        CriterionType.LANGUAGE,
        criteriaByType.get(CriterionType.LANGUAGE),
      ),
      [CriterionType.KOREAN_HISTORY]: createCriterionCell(
        CriterionType.KOREAN_HISTORY,
        criteriaByType.get(CriterionType.KOREAN_HISTORY),
      ),
      [CriterionType.COMPUTER_SKILL]: createCriterionCell(
        CriterionType.COMPUTER_SKILL,
        criteriaByType.get(CriterionType.COMPUTER_SKILL),
      ),
      [CriterionType.OTHER_CERT]: createCriterionCell(
        CriterionType.OTHER_CERT,
        criteriaByType.get(CriterionType.OTHER_CERT),
      ),
    },
  };
}

export function buildEvaluationTable(
  postings: readonly JobPosting[],
  filter: JobCategory | null = null,
): EvaluationTable {
  const rows = postings
    .filter(
      (posting) =>
        posting.enterpriseType === EnterpriseType.PUBLIC &&
        (filter === null || posting.jobCategory === filter),
    )
    .slice(0, EVALUATION_TABLE_LIMIT)
    .map(toEvaluationTableRow);

  return { rows, filter };
}

export function addToEvaluationTable(
  current: EvaluationTable,
  posting: JobPosting,
): AddResult {
  if (current.rows.some(({ postingId }) => postingId === posting.id)) {
    return { ok: false, reason: "DUPLICATE" };
  }

  if (current.rows.length >= EVALUATION_TABLE_LIMIT) {
    return { ok: false, reason: "LIMIT_EXCEEDED" };
  }

  return {
    ok: true,
    table: {
      ...current,
      rows: [...current.rows, toEvaluationTableRow(posting)],
    },
  };
}
