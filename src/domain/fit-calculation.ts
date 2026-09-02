import { CriterionType, RequiredFlag } from "./constants";
import type { CriterionFit, FitResult } from "./fit";
import type { EvaluationCriterion } from "./job-posting";
import type { CredentialProfile } from "./profile";

function getProfileScore(
  type: EvaluationCriterion["type"],
  profile: CredentialProfile,
): number | null {
  switch (type) {
    case CriterionType.LANGUAGE:
      return profile.languageScore;
    case CriterionType.KOREAN_HISTORY:
      return profile.koreanHistoryGrade;
    case CriterionType.OTHER_CERT:
      return null;
  }
}

function satisfiesCutoff(
  type: EvaluationCriterion["type"],
  profileScore: number,
  cutoffScore: number,
): boolean {
  if (type === CriterionType.KOREAN_HISTORY) {
    return profileScore <= cutoffScore;
  }

  return profileScore >= cutoffScore;
}

export function computeFit(
  criteria: readonly EvaluationCriterion[],
  profile: CredentialProfile,
): FitResult {
  const requiredCriteria = criteria.filter(
    ({ requiredFlag }) => requiredFlag === RequiredFlag.REQUIRED,
  );
  const missingCriteria = new Set<EvaluationCriterion["type"]>();

  const criterionFits: CriterionFit[] = requiredCriteria.map((criterion) => {
    const profileScore = getProfileScore(criterion.type, profile);
    const missing = profileScore === null;

    if (missing) {
      missingCriteria.add(criterion.type);
    }

    const satisfied =
      profileScore !== null &&
      criterion.cutoffScore !== null &&
      satisfiesCutoff(criterion.type, profileScore, criterion.cutoffScore);

    return {
      type: criterion.type,
      cutoffScore: criterion.cutoffScore,
      profileScore,
      status: satisfied ? "충족" : "미충족",
      missing,
    };
  });

  const totalRequiredCount = requiredCriteria.length;
  const satisfiedRequiredCount = criterionFits.filter(
    ({ status }) => status === "충족",
  ).length;
  const computable =
    totalRequiredCount > 0 &&
    requiredCriteria.every(({ cutoffScore }) => cutoffScore !== null);
  const passLikelihoodPercent = computable
    ? Math.round((satisfiedRequiredCount / totalRequiredCount) * 100)
    : 0;

  return {
    postingId: criteria[0]?.postingId ?? "",
    criterionFits,
    satisfiedRequiredCount,
    totalRequiredCount,
    passLikelihoodPercent,
    missingCriteria: [...missingCriteria],
    computable,
  };
}
