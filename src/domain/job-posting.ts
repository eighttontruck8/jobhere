import type {
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
} from "./constants";
import type { LanguageRequirement } from "./language";

export type JobCategory = string;

export interface EvaluationCriterion {
  id: string;
  postingId: string;
  type: CriterionType;
  requiredFlag: RequiredFlag;
  languageRequirements: LanguageRequirement[];
  cutoffScore: number | null;
  acceptableCerts: string[];
}

export type EvaluationCriterionDraft = Omit<
  EvaluationCriterion,
  "id" | "postingId"
>;

export interface JobPosting {
  id: string;
  enterpriseType: EnterpriseType;
  company: string | null;
  jobRole: string | null;
  title: string;
  deadline: Date | null;
  jobCategory: JobCategory | null;
  recruitmentCount?: string | null;
  details?: string | null;
  originalUrl?: string | null;
  source: PostingSource;
  createdAt: Date;
  criteria: EvaluationCriterion[];
}

export interface JobPostingDraft {
  enterpriseType: EnterpriseType;
  company: string | null;
  jobRole: string | null;
  title: string;
  deadline: Date | null;
  jobCategory: JobCategory | null;
  recruitmentCount?: string | null;
  details?: string | null;
  originalUrl?: string | null;
  source: PostingSource;
  criteria: EvaluationCriterionDraft[];
}

export interface EvaluationTable {
  rows: EvaluationTableRow[];
  filter: JobCategory | null;
}

export interface EvaluationCriterionCell {
  type: CriterionType;
  requiredFlag: RequiredFlag | null;
  languageRequirements: LanguageRequirement[];
  cutoffScore: number | null;
  acceptableCerts: string[];
  displayValue: string;
}

export interface EvaluationTableRow {
  postingId: string;
  company: string | null;
  jobRole: string | null;
  jobCategory: JobCategory | null;
  criteria: Record<CriterionType, EvaluationCriterionCell>;
}

export type AddResult =
  | { ok: true; table: EvaluationTable }
  | { ok: false; reason: "DUPLICATE" | "LIMIT_EXCEEDED" };
