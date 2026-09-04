import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CriterionType,
  EnterpriseType,
  LanguageTestType,
  PostingSource,
  RequiredFlag,
  type JobPosting,
} from "@/domain";

const { getPosting } = vi.hoisted(() => ({ getPosting: vi.fn() }));
vi.mock("@/server/container", () => ({ postingService: { getPosting } }));

import PostingDetailPage from "./page";

const posting: JobPosting = {
  id: "posting-1",
  enterpriseType: EnterpriseType.PUBLIC,
  company: "한국전력공사",
  jobRole: "전산",
  title: "신입사원 채용",
  deadline: new Date("2026-09-30T00:00:00.000Z"),
  jobCategory: "IT",
  recruitmentCount: "3명",
  details: `[직무]
- 전산 시스템 개발 및 운영
[근무지]
- 대구
[전형순서]
- 서류전형 (날짜: 2026년 9월 1일~9월 15일, 장소: 비대면) -> 온라인 이의제기/검증 (날짜: 2026년 10월 2일, 장소: 비대면) -> 1차면접 (날짜: 2026년 10월 20일, 장소: 대구)`,
  originalUrl: "https://example.com/jobs/1",
  source: PostingSource.USER,
  createdAt: new Date(0),
  criteria: [{
    id: "criterion-1",
    postingId: "posting-1",
    type: CriterionType.LANGUAGE,
    requiredFlag: RequiredFlag.REQUIRED,
    languageRequirements: [
      { testType: LanguageTestType.TOEIC, score: 850, level: null },
      { testType: LanguageTestType.OPIC, score: null, level: "IH" },
    ],
    cutoffScore: null,
    acceptableCerts: [],
  }],
};

describe("PostingDetailPage", () => {
  beforeEach(() => getPosting.mockResolvedValue(posting));

  it("정리된 공고 정보와 원본 링크를 표시한다", async () => {
    render(await PostingDetailPage({ params: Promise.resolve({ id: "posting-1" }) }));

    expect(screen.getByRole("heading", { name: "신입사원 채용" })).not.toBeNull();
    expect(screen.getByText("3명")).not.toBeNull();
    expect(screen.getByText(/전산 시스템 개발 및 운영/)).not.toBeNull();
    expect(screen.getByRole("heading", { name: "[직무]" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "[근무지]" })).not.toBeNull();
    expect(screen.getByText("서류 9/1(화)-9/15(화)|💻비대면")).not.toBeNull();
    expect(screen.getByText("1차면접 10/20(화)|📍대구")).not.toBeNull();
    expect(screen.queryByText(/이의제기|검증/)).toBeNull();
    expect(screen.getByText("1️⃣")).not.toBeNull();
    expect(screen.getByText("2️⃣")).not.toBeNull();
    expect(screen.getByText("TOEIC 850점 또는 OPIc IH")).not.toBeNull();
    expect(screen.getByRole("link", { name: /원본 공고 확인하기/ }).getAttribute("href"))
      .toBe("https://example.com/jobs/1");
  });
});
