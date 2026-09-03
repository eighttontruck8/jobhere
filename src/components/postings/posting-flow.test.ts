import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EnterpriseType, PostingSource } from "@/domain";
import {
  updateReviewDraft,
  type SerializedPostingDraft,
} from "./posting-flow";

function draft(title: string): SerializedPostingDraft {
  return {
    enterpriseType: EnterpriseType.PRIVATE,
    company: "기업",
    jobRole: "개발",
    title,
    deadline: "2026-09-30T00:00:00.000Z",
    jobCategory: "IT",
    source: PostingSource.USER,
    criteria: [],
  };
}

describe("updateReviewDraft", () => {
  it("Property 17: 편집한 필드만 저장 대상 draft에 정확히 반영한다", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 30 }),
        fc.nat(),
        fc.string(),
        (titles, seed, editedTitle) => {
          const drafts = titles.map(draft);
          const index = seed % drafts.length;
          const result = updateReviewDraft(drafts, index, {
            title: editedTitle,
          });

          expect(result[index].title).toBe(editedTitle);
          expect(result[index]).not.toBe(drafts[index]);
          expect(drafts[index].title).toBe(titles[index]);
          result.forEach((item, itemIndex) => {
            if (itemIndex !== index) expect(item).toBe(drafts[itemIndex]);
          });
        },
      ),
    );
  });
});
