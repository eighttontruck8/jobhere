import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CriterionType,
  EnterpriseType,
  PostingSource,
  RequiredFlag,
  type EvaluationTable,
} from "@/domain";
import { Dashboard } from "./dashboard";

const publicPosting = {
  id: "public-1",
  enterpriseType: EnterpriseType.PUBLIC,
  company: "한국전력공사",
  jobRole: "전산",
  title: "2026년 하반기 신입사원 채용",
  deadline: "2026-09-10T00:00:00.000Z",
  jobCategory: "IT",
  recruitmentCount: "2명",
  details: "전산 시스템 개발 및 운영",
  originalUrl: "https://example.com/jobs/public-1",
  source: PostingSource.USER,
  createdAt: "2026-09-02T00:00:00.000Z",
  criteria: [],
};

const privatePosting = {
  ...publicPosting,
  id: "private-1",
  enterpriseType: EnterpriseType.PRIVATE,
  company: "잡핏테크",
  jobRole: "프론트엔드 개발",
  title: "프론트엔드 개발자 채용",
};

const table: EvaluationTable = {
  filter: null,
  rows: [
    {
      postingId: "public-1",
      company: "한국전력공사",
      jobRole: "전산",
      jobCategory: "IT",
      criteria: {
        [CriterionType.LANGUAGE]: {
          type: CriterionType.LANGUAGE,
          requiredFlag: RequiredFlag.REQUIRED,
          languageRequirements: [],
          cutoffScore: 800,
          acceptableCerts: [],
          displayValue: "800",
        },
        [CriterionType.KOREAN_HISTORY]: {
          type: CriterionType.KOREAN_HISTORY,
          requiredFlag: RequiredFlag.OPTIONAL,
          languageRequirements: [],
          cutoffScore: null,
          acceptableCerts: ["한국사 2급"],
          displayValue: "한국사 2급",
        },
        [CriterionType.COMPUTER_SKILL]: {
          type: CriterionType.COMPUTER_SKILL,
          requiredFlag: null,
          languageRequirements: [],
          cutoffScore: null,
          acceptableCerts: [],
          displayValue: "기준 정보 없음",
        },
        [CriterionType.OTHER_CERT]: {
          type: CriterionType.OTHER_CERT,
          requiredFlag: null,
          languageRequirements: [],
          cutoffScore: null,
          acceptableCerts: [],
          displayValue: "기준 정보 없음",
        },
      },
    },
  ],
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Dashboard", () => {
  it("정상 응답에서 최신 공고, 사기업 일정, 평가 기준표를 표시한다", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/postings?view=private") {
        return jsonResponse({ data: [privatePosting] });
      }

      if (url === "/api/postings/table") {
        return jsonResponse({ data: table });
      }

      return jsonResponse({ data: [publicPosting, privatePosting] });
    });

    render(<Dashboard fetcher={fetcher} />);

    expect(
      await screen.findByText("2026년 하반기 신입사원 채용"),
    ).not.toBeNull();
    expect(screen.getAllByText("프론트엔드 개발")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /2026년 하반기 신입사원 채용/ }).getAttribute("href")).toBe("/postings/public-1");
    expect(screen.getAllByText("모집 2명").length).toBeGreaterThan(0);
    expect(screen.getByText("800")).not.toBeNull();
    expect(screen.getAllByText("기준 정보 없음")).toHaveLength(2);
  });

  it("각 API의 빈 응답을 섹션별 빈 상태로 표시한다", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/table")
        ? jsonResponse({ data: { rows: [], filter: null } })
        : jsonResponse({ data: [] }),
    );

    render(<Dashboard fetcher={fetcher} />);

    expect(
      await screen.findByText("아직 등록된 채용 공고가 없습니다."),
    ).not.toBeNull();
    expect(screen.getByText("확인할 사기업 공고가 없습니다.")).not.toBeNull();
    expect(
      screen.getByText("조건에 맞는 공기업 공고가 없습니다."),
    ).not.toBeNull();
  });

  it("API 실패를 기존 데이터 대신 오류 상태로 표시한다", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: "서버 오류" }, 500),
    );

    render(<Dashboard fetcher={fetcher} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "공고 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      ).not.toBeNull();
      expect(
        screen.getByText("사기업 공고를 불러오지 못했습니다."),
      ).not.toBeNull();
      expect(
        screen.getByText("평가 기준표를 불러오지 못했습니다."),
      ).not.toBeNull();
    });
  });
});
