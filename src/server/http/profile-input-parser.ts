import {
  isLanguageRequirement,
  type CredentialProfileInput,
  type LanguageRequirement,
} from "@/domain";
import { RequestBodyValidationError } from "./posting-draft-parser";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCredentialProfileInput(
  value: unknown,
): CredentialProfileInput {
  if (!isRecord(value)) {
    throw new RequestBodyValidationError(["body"]);
  }

  const {
    languageCredentials,
    koreanHistoryGrade,
    computerSkillGrade,
    certifications,
  } = value;
  const invalidFields: string[] = [];

  if (
    !Array.isArray(languageCredentials) ||
    !languageCredentials.every(isLanguageRequirement)
  ) {
    invalidFields.push("languageCredentials");
  }

  if (computerSkillGrade !== null && typeof computerSkillGrade !== "number") {
    invalidFields.push("computerSkillGrade");
  }

  if (
    koreanHistoryGrade !== null &&
    typeof koreanHistoryGrade !== "number"
  ) {
    invalidFields.push("koreanHistoryGrade");
  }

  if (
    !Array.isArray(certifications) ||
    !certifications.every((certification) => typeof certification === "string")
  ) {
    invalidFields.push("certifications");
  }

  if (invalidFields.length > 0) {
    throw new RequestBodyValidationError(invalidFields);
  }

  return {
    languageCredentials: languageCredentials as LanguageRequirement[],
    koreanHistoryGrade: koreanHistoryGrade as number | null,
    computerSkillGrade: computerSkillGrade as number | null,
    certifications: certifications as string[],
  };
}
