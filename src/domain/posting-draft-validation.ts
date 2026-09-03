import type { JobPostingDraft } from "./job-posting";

export type RequiredPostingDraftField = "company" | "jobRole" | "deadline";

export type PostingDraftValidationResult =
  | { valid: true }
  | { valid: false; fields: RequiredPostingDraftField[] };

export function validatePostingDraftRequiredFields(
  draft: Pick<JobPostingDraft, RequiredPostingDraftField>,
): PostingDraftValidationResult {
  const fields: RequiredPostingDraftField[] = [];

  if (!draft.company?.trim()) fields.push("company");
  if (!draft.jobRole?.trim()) fields.push("jobRole");
  if (draft.deadline === null || Number.isNaN(draft.deadline.getTime())) {
    fields.push("deadline");
  }

  return fields.length === 0 ? { valid: true } : { valid: false, fields };
}
