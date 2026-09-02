import type { CredentialProfileInput } from "@/domain";
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

  const { languageScore, koreanHistoryGrade, certifications } = value;
  const invalidFields: string[] = [];

  if (languageScore !== null && typeof languageScore !== "number") {
    invalidFields.push("languageScore");
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
    languageScore: languageScore as number | null,
    koreanHistoryGrade: koreanHistoryGrade as number | null,
    certifications: certifications as string[],
  };
}
