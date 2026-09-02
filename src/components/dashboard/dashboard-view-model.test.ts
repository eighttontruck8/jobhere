import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EnterpriseType, formatDeadline } from "@/domain";
import {
  getEnterpriseLabel,
  MISSING_POSTING_VALUE,
  toPrivatePostingFields,
} from "./dashboard-view-model";

describe("dashboard view model", () => {
  it("Property 2: 기업 유형과 표시 라벨이 정확히 대응한다", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(EnterpriseType.PUBLIC, EnterpriseType.PRIVATE),
        (type) => {
          expect(getEnterpriseLabel(type)).toBe(
            type === EnterpriseType.PUBLIC ? "공기업" : "사기업",
          );
        },
      ),
    );
  });

  it("Property 9: 사기업 행을 기업명, 직무명, 마감 순서로 만든다", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.date({
          min: new Date(2020, 0, 1),
          max: new Date(2035, 11, 31),
          noInvalidDate: true,
        }),
        (company, jobRole, deadline) => {
          expect(
            toPrivatePostingFields({ company, jobRole, deadline }),
          ).toEqual([
            company.trim() || MISSING_POSTING_VALUE,
            jobRole.trim() || MISSING_POSTING_VALUE,
            formatDeadline(deadline),
          ]);
        },
      ),
    );
  });

  it("Property 12: 누락된 사기업 필드는 대체 문구로 표시한다", () => {
    const missingText = fc.constantFrom<string | null>(null, "", "   ");

    fc.assert(
      fc.property(
        missingText,
        missingText,
        fc.option(fc.date({ noInvalidDate: true }), { nil: null }),
        (company, jobRole, deadline) => {
          const fields = toPrivatePostingFields({ company, jobRole, deadline });

          expect(fields[0]).toBe(MISSING_POSTING_VALUE);
          expect(fields[1]).toBe(MISSING_POSTING_VALUE);
          expect(fields[2]).toBe(
            deadline ? formatDeadline(deadline) : MISSING_POSTING_VALUE,
          );
        },
      ),
    );
  });
});
