import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CriterionType,
  EVALUATION_TABLE_LIMIT,
  EVALUATION_TABLE_PLACEHOLDERS,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
  addToEvaluationTable,
  buildEvaluationTable,
  type EvaluationCriterion,
  type JobPosting,
} from "@/domain";

const enterpriseTypeArbitrary = fc.constantFrom(
  EnterpriseType.PUBLIC,
  EnterpriseType.PRIVATE,
);
const categoryArbitrary = fc.constantFrom("개발", "기획", "디자인", null);

function createCriterion(
  postingId: string,
  type: EvaluationCriterion["type"],
  requiredFlag: EvaluationCriterion["requiredFlag"],
  cutoffScore: number | null = null,
  acceptableCerts: string[] = [],
): EvaluationCriterion {
  return {
    id: `${postingId}-${type}`,
    postingId,
    type,
    requiredFlag,
    cutoffScore,
    acceptableCerts,
  };
}

function createPosting(
  id: string,
  enterpriseType: JobPosting["enterpriseType"] = EnterpriseType.PUBLIC,
  jobCategory: JobPosting["jobCategory"] = "개발",
  criteria: EvaluationCriterion[] = [],
): JobPosting {
  return {
    id,
    enterpriseType,
    company: `기업 ${id}`,
    jobRole: `직무 ${id}`,
    title: `공고 ${id}`,
    deadline: null,
    jobCategory,
    source: PostingSource.CRAWLED,
    createdAt: new Date(Number(id) || 0),
    criteria,
  };
}

describe("buildEvaluationTable", () => {
  it("creates display values and placeholders for each criterion state", () => {
    const posting = createPosting("1", EnterpriseType.PUBLIC, "개발", [
      createCriterion(
        "1",
        CriterionType.LANGUAGE,
        RequiredFlag.REQUIRED,
        850,
      ),
      createCriterion(
        "1",
        CriterionType.KOREAN_HISTORY,
        RequiredFlag.REQUIRED,
      ),
      createCriterion(
        "1",
        CriterionType.OTHER_CERT,
        RequiredFlag.OPTIONAL,
      ),
    ]);

    const [row] = buildEvaluationTable([posting]).rows;

    expect(row.criteria.LANGUAGE.displayValue).toBe("850");
    expect(row.criteria.KOREAN_HISTORY.displayValue).toBe(
      EVALUATION_TABLE_PLACEHOLDERS.cutoff,
    );
    expect(row.criteria.OTHER_CERT.displayValue).toBe(
      EVALUATION_TABLE_PLACEHOLDERS.certifications,
    );
  });

  it("uses a placeholder when a criterion itself is absent", () => {
    const [row] = buildEvaluationTable([createPosting("1")]).rows;

    expect(row.criteria.LANGUAGE).toMatchObject({
      requiredFlag: null,
      displayValue: EVALUATION_TABLE_PLACEHOLDERS.criterion,
    });
  });

  it("Feature: job-posting-dashboard, Property 4: 통합 표 행 수 상한", () => {
    fc.assert(
      fc.property(
        fc.array(enterpriseTypeArbitrary, { maxLength: 60 }),
        (enterpriseTypes) => {
          const postings = enterpriseTypes.map((enterpriseType, index) =>
            createPosting(String(index), enterpriseType),
          );
          const result = buildEvaluationTable(postings);
          const publicCount = postings.filter(
            ({ enterpriseType }) => enterpriseType === EnterpriseType.PUBLIC,
          ).length;

          expect(result.rows).toHaveLength(
            Math.min(publicCount, EVALUATION_TABLE_LIMIT),
          );
          expect(result.rows.length).toBeLessThanOrEqual(EVALUATION_TABLE_LIMIT);
        },
      ),
    );
  });

  it("Feature: job-posting-dashboard, Property 5: Required_Flag 표시 정확성", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(CriterionType)),
        fc.constantFrom(...Object.values(RequiredFlag)),
        (type, requiredFlag) => {
          const posting = createPosting("1", EnterpriseType.PUBLIC, "개발", [
            createCriterion("1", type, requiredFlag, 1, ["자격증"]),
          ]);
          const [row] = buildEvaluationTable([posting]).rows;

          expect(row.criteria[type].requiredFlag).toBe(requiredFlag);
        },
      ),
    );
  });

  it("Feature: job-posting-dashboard, Property 6: 직무 카테고리 필터 정확성", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            enterpriseType: enterpriseTypeArbitrary,
            jobCategory: categoryArbitrary,
          }),
          { maxLength: 60 },
        ),
        fc.constantFrom("개발", "기획", "디자인"),
        (values, filter) => {
          const postings = values.map((value, index) =>
            createPosting(
              String(index),
              value.enterpriseType,
              value.jobCategory,
            ),
          );
          const result = buildEvaluationTable(postings, filter);
          const expectedIds = postings
            .filter(
              ({ enterpriseType, jobCategory }) =>
                enterpriseType === EnterpriseType.PUBLIC &&
                jobCategory === filter,
            )
            .slice(0, EVALUATION_TABLE_LIMIT)
            .map(({ id }) => id);

          expect(result.filter).toBe(filter);
          expect(result.rows.map(({ postingId }) => postingId)).toEqual(
            expectedIds,
          );
          expect(result.rows.every(({ jobCategory }) => jobCategory === filter)).toBe(
            true,
          );
        },
      ),
    );
  });
});

describe("addToEvaluationTable", () => {
  it("Feature: job-posting-dashboard, Property 7: 표 수동 추가 멤버십", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: EVALUATION_TABLE_LIMIT - 1 }),
        (currentCount) => {
          const current = buildEvaluationTable(
            Array.from({ length: currentCount }, (_, index) =>
              createPosting(String(index)),
            ),
          );
          const originalIds = current.rows.map(({ postingId }) => postingId);
          const posting = createPosting("new-posting");
          const result = addToEvaluationTable(current, posting);

          expect(result.ok).toBe(true);
          expect(current.rows.map(({ postingId }) => postingId)).toEqual(
            originalIds,
          );

          if (result.ok) {
            expect(result.table.rows).toHaveLength(currentCount + 1);
            expect(result.table.rows.at(-1)?.postingId).toBe(posting.id);
          }
        },
      ),
    );
  });

  it("Feature: job-posting-dashboard, Property 8: 표 추가 거부 규칙", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: EVALUATION_TABLE_LIMIT }),
        (currentCount) => {
          const postings = Array.from({ length: currentCount }, (_, index) =>
            createPosting(String(index)),
          );
          const current = buildEvaluationTable(postings);
          const duplicateResult = addToEvaluationTable(current, postings[0]);

          expect(duplicateResult).toEqual({
            ok: false,
            reason: "DUPLICATE",
          });
          expect(current.rows).toHaveLength(currentCount);
        },
      ),
    );

    const fullTable = buildEvaluationTable(
      Array.from({ length: EVALUATION_TABLE_LIMIT }, (_, index) =>
        createPosting(String(index)),
      ),
    );

    expect(addToEvaluationTable(fullTable, createPosting("new-posting"))).toEqual({
      ok: false,
      reason: "LIMIT_EXCEEDED",
    });
    expect(fullTable.rows).toHaveLength(EVALUATION_TABLE_LIMIT);
  });
});
