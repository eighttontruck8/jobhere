import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CriterionType,
  EnterpriseType,
  LanguageTestType,
  PostingSource,
  RequiredFlag,
} from "@/domain";
import { PostingReview } from "./posting-review";
import { readReviewDrafts, writeReviewDrafts, type SerializedPostingDraft } from "./posting-flow";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function draft(update: Partial<SerializedPostingDraft> = {}): SerializedPostingDraft {
  return {
    enterpriseType: EnterpriseType.PRIVATE,
    company: "기존 회사",
    jobRole: "개발",
    title: "개발자 채용",
    deadline: "2026-09-30T00:00:00.000Z",
    jobCategory: "IT",
    source: PostingSource.USER,
    criteria: [],
    ...update,
  };
}

describe("PostingReview", () => {
  beforeEach(() => {
    push.mockReset();
    sessionStorage.clear();
  });

  it("수정한 공고를 저장하고 마지막 항목이면 대시보드로 이동한다", async () => {
    writeReviewDrafts(sessionStorage, [draft()]);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return jsonResponse({ data: { id: "posting-1" } }, 201);
    });
    render(<PostingReview fetcher={fetcher} />);

    const company = await screen.findByLabelText(/회사명/);
    fireEvent.change(company, { target: { value: "수정 회사" } });
    fireEvent.click(screen.getByRole("button", { name: "이 공고 저장" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(String(init?.body)).company).toBe("수정 회사");
    expect(readReviewDrafts(sessionStorage)).toEqual([]);
  });

  it("필수값이 없으면 항목별 오류를 보여주고 저장을 요청하지 않는다", async () => {
    writeReviewDrafts(sessionStorage, [draft({ company: "", jobRole: null, deadline: null })]);
    const fetcher = vi.fn();
    render(<PostingReview fetcher={fetcher} />);
    await screen.findByText("개발자 채용");
    fireEvent.click(screen.getByRole("button", { name: "이 공고 저장" }));

    expect(screen.getByText("회사명을 입력해 주세요.")).not.toBeNull();
    expect(screen.getByText("직무를 입력해 주세요.")).not.toBeNull();
    expect(screen.getByText("마감일을 입력해 주세요.")).not.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("저장 실패 시 수정 내용과 임시 공고를 유지한다", async () => {
    writeReviewDrafts(sessionStorage, [draft()]);
    const fetcher = vi.fn(async () => jsonResponse({ error: "저장 서버 오류" }, 500));
    render(<PostingReview fetcher={fetcher} />);
    const company = await screen.findByLabelText(/회사명/);
    fireEvent.change(company, { target: { value: "보존 회사" } });
    fireEvent.click(screen.getByRole("button", { name: "이 공고 저장" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("저장에 실패했습니다");
    expect(alert.textContent).toContain("저장 서버 오류");
    expect((company as HTMLInputElement).value).toBe("보존 회사");
    expect(readReviewDrafts(sessionStorage)[0].company).toBe("보존 회사");
  });

  it("네트워크 또는 비정상 응답 실패도 고정 알림으로 안내한다", async () => {
    writeReviewDrafts(sessionStorage, [draft()]);
    const fetcher = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<PostingReview fetcher={fetcher} />);
    await screen.findByText("개발자 채용");
    fireEvent.click(screen.getByRole("button", { name: "이 공고 저장" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("저장에 실패했습니다");
    expect(alert.textContent).toContain("서버와 통신하지 못했습니다");
    expect(readReviewDrafts(sessionStorage)).toHaveLength(1);
  });

  it("분석 취소 시 임시 공고를 지우고 입력 화면으로 돌아간다", async () => {
    writeReviewDrafts(sessionStorage, [draft()]);
    render(<PostingReview fetcher={vi.fn()} />);
    await screen.findByText("개발자 채용");
    fireEvent.click(screen.getByRole("button", { name: "분석 취소" }));

    expect(readReviewDrafts(sessionStorage)).toEqual([]);
    expect(push).toHaveBeenCalledWith("/postings/add");
  });

  it("시험별 어학 기준을 독립적으로 수정해 임시 공고에 보존한다", async () => {
    writeReviewDrafts(sessionStorage, [draft({
      criteria: [{
        type: CriterionType.LANGUAGE,
        requiredFlag: RequiredFlag.REQUIRED,
        languageRequirements: [{
          testType: LanguageTestType.OPIC,
          score: null,
          level: "IH",
        }],
        cutoffScore: null,
        acceptableCerts: [],
      }],
    })]);
    render(<PostingReview fetcher={vi.fn()} />);

    const opic = await screen.findByLabelText("OPIc 최저 등급");
    expect((opic as HTMLSelectElement).value).toBe("IH");
    fireEvent.change(screen.getByLabelText("TOEIC Speaking 최저 등급"), {
      target: { value: "AL" },
    });

    expect(readReviewDrafts(sessionStorage)[0].criteria[0].languageRequirements).toEqual([
      { testType: LanguageTestType.OPIC, score: null, level: "IH" },
      { testType: LanguageTestType.TOEIC_SPEAKING, score: null, level: "AL" },
    ]);
  });
});
