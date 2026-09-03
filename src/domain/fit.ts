import type { CriterionType } from "./constants";
import type { LanguageRequirement } from "./language";

export type CriterionFitStatus = "충족" | "미충족";

export interface CriterionFit {
  type: CriterionType;
  languageRequirements: LanguageRequirement[];
  profileLanguageCredentials: LanguageRequirement[];
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
