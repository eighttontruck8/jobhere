import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  EnterpriseType,
  PostingSource,
  type JobPostingDraft,
} from "@/domain";
import { applyRoleFilter, MAX_EXTRACTED_POSTINGS } from "./role-filter";

function posting(jobRole: string, index: number): JobPostingDraft {
  return {
    enterpriseType: EnterpriseType.PRIVATE,
    company: `기업 ${index}`,
    jobRole,
    title: `공고 ${index}`,
    deadline: null,
    jobCategory: null,
    source: PostingSource.USER,
    criteria: [],
  };
}

describe("applyRoleFilter", () => {
  it("Property 13: 결과 개수는 발견 수와 50 중 작은 값이다", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 120 }), (roles) => {
        const postings = roles.map(posting);
        const result = applyRoleFilter(postings);

        expect(result).toEqual(postings.slice(0, MAX_EXTRACTED_POSTINGS));
        expect(result).toHaveLength(
          Math.min(postings.length, MAX_EXTRACTED_POSTINGS),
        );
      }),
    );
  });

  it("Property 14: 필터가 있으면 일치 직무만 순서대로 남기고 50개로 제한한다", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { maxLength: 120 }),
        fc.string({ minLength: 1 }),
        (roles, filter) => {
          const postings = roles.map(posting);
          const normalized = filter.trim().toLocaleLowerCase("ko-KR");
          const expected = normalized
            ? postings
                .filter(
                  ({ jobRole }) =>
                    jobRole?.trim().toLocaleLowerCase("ko-KR") === normalized,
                )
                .slice(0, MAX_EXTRACTED_POSTINGS)
            : postings.slice(0, MAX_EXTRACTED_POSTINGS);

          expect(applyRoleFilter(postings, filter)).toEqual(expected);
        },
      ),
    );
  });

  it("대소문자와 앞뒤 공백을 무시한다", () => {
    const postings = [posting("Backend", 0), posting("Frontend", 1)];

    expect(applyRoleFilter(postings, " backend ")).toEqual([postings[0]]);
  });
});
