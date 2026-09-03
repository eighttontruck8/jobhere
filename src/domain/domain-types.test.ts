import { describe, expect, expectTypeOf, it } from "vitest";
import {
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
  type AddResult,
  type CredentialProfile,
  type EnterpriseType as EnterpriseTypeValue,
  type EvaluationTable,
  type FitResult,
  type JobPosting,
  type SaveResult,
  type ValidationResult,
} from "@/domain";

describe("domain types", () => {
  it("keeps application enum values aligned with the database schema", () => {
    expect(Object.values(EnterpriseType)).toEqual(["PUBLIC", "PRIVATE"]);
    expect(Object.values(PostingSource)).toEqual(["CRAWLED", "USER"]);
    expect(Object.values(CriterionType)).toEqual([
      "LANGUAGE",
      "KOREAN_HISTORY",
      "COMPUTER_SKILL",
      "OTHER_CERT",
    ]);
    expect(Object.values(RequiredFlag)).toEqual(["REQUIRED", "OPTIONAL"]);
  });

  it("exposes the required discriminated result types", () => {
    expectTypeOf<JobPosting["enterpriseType"]>().toEqualTypeOf<EnterpriseTypeValue>();
    expectTypeOf<CredentialProfile["id"]>().toEqualTypeOf<"singleton">();
    expectTypeOf<Extract<ValidationResult, { valid: false }>["issues"]>().toBeArray();
    expectTypeOf<Extract<AddResult, { ok: true }>["table"]>().toEqualTypeOf<EvaluationTable>();
    expectTypeOf<Extract<SaveResult<string>, { ok: true }>["value"]>().toEqualTypeOf<string>();
    expectTypeOf<FitResult["passLikelihoodPercent"]>().toBeNumber();
  });
});
