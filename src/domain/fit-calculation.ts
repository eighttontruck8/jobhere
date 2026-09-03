import {
  CriterionType,
  LanguageTestType,
  RequiredFlag,
} from "./constants";
import { getLanguageLevels, type LanguageRequirement } from "./language";
import type { CriterionFit, FitResult } from "./fit";
import type { EvaluationCriterion } from "./job-posting";
import type { CredentialProfile } from "./profile";

function getProfileScore(
  type: EvaluationCriterion["type"],
  profile: CredentialProfile,
): number | null {
  switch (type) {
    case CriterionType.LANGUAGE:
      return null;
    case CriterionType.KOREAN_HISTORY:
      return profile.koreanHistoryGrade;
    case CriterionType.COMPUTER_SKILL:
      return profile.computerSkillGrade;
    case CriterionType.OTHER_CERT:
      return null;
  }
}

function satisfiesCutoff(
  type: EvaluationCriterion["type"],
  profileScore: number,
  cutoffScore: number,
): boolean {
  if (
    type === CriterionType.KOREAN_HISTORY ||
    type === CriterionType.COMPUTER_SKILL
  ) {
    return profileScore <= cutoffScore;
  }

  return profileScore >= cutoffScore;
}

function satisfiesLanguageRequirement(
  profileValue: LanguageRequirement,
  requirement: LanguageRequirement,
): boolean {
  if (profileValue.testType !== requirement.testType) return false;
  if (requirement.testType === LanguageTestType.TOEIC) {
    return profileValue.score !== null && requirement.score !== null &&
      profileValue.score >= requirement.score;
  }

  if (profileValue.level === null || requirement.level === null) return false;
  const levels = getLanguageLevels(requirement.testType);
  return levels.indexOf(profileValue.level) >= levels.indexOf(requirement.level);
}

function isCriterionComputable(criterion: EvaluationCriterion): boolean {
  if (criterion.type === CriterionType.LANGUAGE) {
    return criterion.languageRequirements.length > 0;
  }
  if (criterion.type === CriterionType.OTHER_CERT) {
    return criterion.acceptableCerts.length > 0;
  }
  return criterion.cutoffScore !== null;
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
    const matchingLanguageCredentials = criterion.type === CriterionType.LANGUAGE
      ? profile.languageCredentials.filter((credential) =>
          criterion.languageRequirements.some(
            ({ testType }) => testType === credential.testType,
          ))
      : [];
    const missing = criterion.type === CriterionType.LANGUAGE
      ? matchingLanguageCredentials.length === 0
      : criterion.type === CriterionType.OTHER_CERT
        ? profile.certifications.length === 0
        : profileScore === null;

    if (missing) {
      missingCriteria.add(criterion.type);
    }

    const satisfied = criterion.type === CriterionType.LANGUAGE
      ? criterion.languageRequirements.some((requirement) =>
          matchingLanguageCredentials.some((credential) =>
            satisfiesLanguageRequirement(credential, requirement),
          ))
      : criterion.type === CriterionType.OTHER_CERT
        ? criterion.acceptableCerts.some((certification) =>
            profile.certifications.includes(certification),
          )
        : profileScore !== null && criterion.cutoffScore !== null &&
          satisfiesCutoff(criterion.type, profileScore, criterion.cutoffScore);

    return {
      type: criterion.type,
      languageRequirements: criterion.languageRequirements.map((item) => ({ ...item })),
      profileLanguageCredentials: matchingLanguageCredentials.map((item) => ({ ...item })),
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
    requiredCriteria.every(isCriterionComputable);
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
