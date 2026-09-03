import type { LanguageRequirement } from "./language";

export const CREDENTIAL_PROFILE_ID = "singleton" as const;

export interface CredentialProfileInput {
  languageCredentials: LanguageRequirement[];
  koreanHistoryGrade: number | null;
  computerSkillGrade: number | null;
  certifications: string[];
}

export interface CredentialProfile extends CredentialProfileInput {
  id: typeof CREDENTIAL_PROFILE_ID;
  updatedAt: Date;
}

export type ProfileValidationField =
  | "languageCredentials"
  | "koreanHistoryGrade"
  | "computerSkillGrade"
  | "certifications";

export interface ValidationIssue {
  field: ProfileValidationField;
  message: string;
  itemIndex?: number;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; issues: ValidationIssue[] };

export type SaveResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; message: string; issues?: ValidationIssue[] };
