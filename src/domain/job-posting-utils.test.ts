import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  EnterpriseType,
  PostingSource,
  formatDeadline,
  sortByDeadlineAsc,
  sortByNewest,
  truncateTitle,
  type JobPosting,
} from "@/domain";

const timestampArbitrary = fc.integer({
  min: new Date(2000, 0, 1).getTime(),
  max: new Date(2100, 11, 31, 23, 59, 59).getTime(),
});

function createPosting(
  id: string,
  createdAt: Date,
  deadline: Date | null,
): JobPosting {
  return {
    id,
    enterpriseType: EnterpriseType.PRIVATE,
    company: "테스트 기업",
    jobRole: "테스트 직무",
    title: `공고 ${id}`,
    deadline,
    jobCategory: null,
    source: PostingSource.CRAWLED,
    createdAt,
    criteria: [],
  };
}

describe("formatDeadline", () => {
  it("formats a deadline without leading zeroes and with a Korean weekday", () => {
    expect(formatDeadline(new Date(2025, 8, 2))).toBe("~9/2(화)");
  });

  it("rejects an invalid date", () => {
    expect(() => formatDeadline(new Date(Number.NaN))).toThrow(RangeError);
  });

  it("Feature: job-posting-dashboard, Property 10: 마감 기한 포맷", () => {
    fc.assert(
      fc.property(timestampArbitrary, (timestamp) => {
        const date = new Date(timestamp);
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

        expect(formatDeadline(date)).toBe(
          `~${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`,
        );
      }),
    );
  });
});

describe("truncateTitle", () => {
  it("adds an ellipsis only after the configured maximum length", () => {
    expect(truncateTitle("가".repeat(100))).toBe("가".repeat(100));
    expect(truncateTitle("가".repeat(101))).toBe(`${"가".repeat(100)}…`);
  });

  it("rejects an invalid maximum length", () => {
    expect(() => truncateTitle("공고", -1)).toThrow(RangeError);
    expect(() => truncateTitle("공고", 1.5)).toThrow(RangeError);
  });

  it("Feature: job-posting-dashboard, Property 3: 제목 말줄임 불변식", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (title) => {
        const result = truncateTitle(title);
        const isTruncated = title.length > 100;
        const body = isTruncated ? result.slice(0, -1) : result;

        expect(body.length).toBeLessThanOrEqual(100);
        expect(result.endsWith("…")).toBe(isTruncated);
        expect(body).toBe(title.slice(0, 100));
      }),
    );
  });
});

describe("posting sort functions", () => {
  it("Feature: job-posting-dashboard, Property 1: 대시보드 최신순 정렬", () => {
    fc.assert(
      fc.property(fc.array(timestampArbitrary, { maxLength: 100 }), (timestamps) => {
        const postings = timestamps.map((timestamp, index) =>
          createPosting(String(index), new Date(timestamp), null),
        );
        const originalIds = postings.map(({ id }) => id);
        const result = sortByNewest(postings);

        expect(postings.map(({ id }) => id)).toEqual(originalIds);
        expect(result).toHaveLength(postings.length);

        for (let index = 1; index < result.length; index += 1) {
          expect(result[index - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
            result[index].createdAt.getTime(),
          );
        }
      }),
    );
  });

  it("Feature: job-posting-dashboard, Property 11: 사기업 마감 오름차순 정렬", () => {
    const deadlineArbitrary = fc.option(timestampArbitrary, { nil: null });

    fc.assert(
      fc.property(fc.array(deadlineArbitrary, { maxLength: 100 }), (deadlines) => {
        const postings = deadlines.map((deadline, index) =>
          createPosting(
            String(index),
            new Date(index),
            deadline === null ? null : new Date(deadline),
          ),
        );
        const originalIds = postings.map(({ id }) => id);
        const result = sortByDeadlineAsc(postings);

        expect(postings.map(({ id }) => id)).toEqual(originalIds);
        expect(result).toHaveLength(postings.length);

        for (let index = 1; index < result.length; index += 1) {
          const previous = result[index - 1].deadline;
          const current = result[index].deadline;

          if (previous === null) {
            expect(current).toBeNull();
          } else if (current !== null) {
            expect(previous.getTime()).toBeLessThanOrEqual(current.getTime());
          }
        }
      }),
    );
  });
});
