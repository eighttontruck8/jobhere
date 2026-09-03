import type { ExtractedPosting, RoleFilterSpec } from "./analysis-types";

export const MAX_EXTRACTED_POSTINGS = 50;

function normalizeRole(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

export function applyRoleFilter(
  postings: readonly ExtractedPosting[],
  filter?: RoleFilterSpec | null,
): ExtractedPosting[] {
  const normalizedFilter = filter ? normalizeRole(filter) : "";
  const filtered = normalizedFilter
    ? postings.filter(
        ({ jobRole }) =>
          jobRole !== null && normalizeRole(jobRole) === normalizedFilter,
      )
    : postings;

  return filtered.slice(0, MAX_EXTRACTED_POSTINGS);
}

export class RoleFilter {
  apply(
    postings: readonly ExtractedPosting[],
    filter?: RoleFilterSpec | null,
  ): ExtractedPosting[] {
    return applyRoleFilter(postings, filter);
  }
}
