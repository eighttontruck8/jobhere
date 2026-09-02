import type {
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
} from "./constants";

export type JobCategory = string;

export interface EvaluationCriterion {
  id: string;
  postingId: string;
  type: CriterionType;
  requiredFlag: RequiredFlag;
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
  source: PostingSource;
  criteria: EvaluationCriterionDraft[];
}

export interface EvaluationTable {
  rows: JobPosting[];
  filter: JobCategory | null;
}

export type AddResult =
  | { ok: true; table: EvaluationTable }
  | { ok: false; reason: "DUPLICATE" | "LIMIT_EXCEEDED" };
