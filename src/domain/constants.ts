export const EnterpriseType = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;

export type EnterpriseType =
  (typeof EnterpriseType)[keyof typeof EnterpriseType];

export const PostingSource = {
  CRAWLED: "CRAWLED",
  USER: "USER",
} as const;

export type PostingSource =
  (typeof PostingSource)[keyof typeof PostingSource];

export const CriterionType = {
  LANGUAGE: "LANGUAGE",
  KOREAN_HISTORY: "KOREAN_HISTORY",
  COMPUTER_SKILL: "COMPUTER_SKILL",
  OTHER_CERT: "OTHER_CERT",
} as const;

export type CriterionType =
  (typeof CriterionType)[keyof typeof CriterionType];

export const LanguageTestType = {
  TOEIC: "TOEIC",
  OPIC: "OPIC",
  TOEIC_SPEAKING: "TOEIC_SPEAKING",
} as const;

export type LanguageTestType =
  (typeof LanguageTestType)[keyof typeof LanguageTestType];

export const OPIC_LEVELS = ["IL", "IM1", "IM2", "IM3", "IH", "AL"] as const;
export const TOEIC_SPEAKING_LEVELS = [
  "IL",
  "IM",
  "IH",
  "AL",
  "AM",
  "AH",
] as const;

export const RequiredFlag = {
  REQUIRED: "REQUIRED",
  OPTIONAL: "OPTIONAL",
} as const;

export type RequiredFlag =
  (typeof RequiredFlag)[keyof typeof RequiredFlag];
