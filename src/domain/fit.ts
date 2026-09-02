import type { CriterionType } from "./constants";

export type CriterionFitStatus = "충족" | "미충족";

export interface CriterionFit {
  type: CriterionType;
  cutoffScore: number | null;
  profileScore: number | null;
  status: CriterionFitStatus;
  missing: boolean;
}

export interface FitResult {
  postingId: string;
  criterionFits: CriterionFit[];
  satisfiedRequiredCount: number;
  totalRequiredCount: number;
  passLikelihoodPercent: number;
  missingCriteria: CriterionType[];
  computable: boolean;
}
