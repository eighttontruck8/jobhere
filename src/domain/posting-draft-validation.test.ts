import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validatePostingDraftRequiredFields } from "./posting-draft-validation";

describe("validatePostingDraftRequiredFields", () => {
  it("Property 18: 기업명·직무명·마감 중 비어 있는 모든 필드를 식별한다", () => {
    const presentText = fc.string({ minLength: 1 }).filter((value) => Boolean(value.trim()));
    const missingText = fc.constantFrom<string | null>(null, "", " ", "\t");

    fc.assert(
      fc.property(
        fc.oneof(presentText, missingText),
        fc.oneof(presentText, missingText),
        fc.option(fc.date({ noInvalidDate: true }), { nil: null }),
        (company, jobRole, deadline) => {
          const result = validatePostingDraftRequiredFields({
            company,
            jobRole,
            deadline,
          });
          const expected = [
            ...(!company?.trim() ? ["company"] : []),
            ...(!jobRole?.trim() ? ["jobRole"] : []),
            ...(deadline === null ? ["deadline"] : []),
          ];

          if (expected.length === 0) {
            expect(result).toEqual({ valid: true });
          } else {
            expect(result).toEqual({ valid: false, fields: expected });
          }
        },
      ),
    );
  });

  it("유효하지 않은 Date를 마감 누락으로 처리한다", () => {
    expect(
      validatePostingDraftRequiredFields({
        company: "기업",
        jobRole: "개발",
        deadline: new Date(Number.NaN),
      }),
    ).toEqual({ valid: false, fields: ["deadline"] });
  });
});
