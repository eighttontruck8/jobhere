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
  OTHER_CERT: "OTHER_CERT",
} as const;

export type CriterionType =
  (typeof CriterionType)[keyof typeof CriterionType];

export const RequiredFlag = {
  REQUIRED: "REQUIRED",
  OPTIONAL: "OPTIONAL",
} as const;

export type RequiredFlag =
  (typeof RequiredFlag)[keyof typeof RequiredFlag];
