import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnterpriseType, PostingSource } from "@/domain";
import { PostingAnalyzer } from "./posting-analyzer";
import { readReviewDrafts } from "./posting-flow";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const analyzedDraft = {
  enterpriseType: EnterpriseType.PRIVATE,
  company: "잡히어",
  jobRole: "백엔드 개발",
  title: "백엔드 개발자 채용",
  deadline: "2026-09-30T00:00:00.000Z",
  jobCategory: "개발",
  recruitmentCount: null,
  details: null,
  originalUrl: null,
  source: PostingSource.CRAWLED,
  criteria: [],
};

describe("PostingAnalyzer", () => {
  beforeEach(() => {
    push.mockReset();
    sessionStorage.clear();
  });

  it("링크 분석 결과를 임시 저장하고 검토 화면으로 이동한다", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return jsonResponse({ data: [analyzedDraft] });
    });
    render(<PostingAnalyzer fetcher={fetcher} />);

    fireEvent.change(screen.getByLabelText("채용 공고 링크"), {
      target: { value: "https://example.com/jobs/1" },
    });
    fireEvent.change(screen.getByLabelText(/관심 직무 필터/), {
      target: { value: "백엔드 개발" },
    });
    fireEvent.click(screen.getByRole("button", { name: "분석 시작" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/postings/review"));
    expect(readReviewDrafts(sessionStorage)).toEqual([analyzedDraft]);
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      kind: "link",
      roleFilter: "백엔드 개발",
    });
  });

  it("분석 실패 시 입력값을 유지하고 오류를 표시한다", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: "원문을 읽을 수 없습니다." }, 400));
    render(<PostingAnalyzer fetcher={fetcher} />);
    const input = screen.getByLabelText("채용 공고 링크") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://example.com/jobs/2" } });
    fireEvent.click(screen.getByRole("button", { name: "분석 시작" }));

    expect((await screen.findByRole("alert")).textContent).toContain("원문을 읽을 수 없습니다.");
    expect(input.value).toBe("https://example.com/jobs/2");
    expect(push).not.toHaveBeenCalled();
  });

  it("지원하지 않는 이미지 형식은 서버 요청 전에 차단한다", () => {
    const fetcher = vi.fn();
    render(<PostingAnalyzer fetcher={fetcher} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지로 분석" }));
    fireEvent.change(screen.getByLabelText("채용 공고 이미지"), {
      target: { files: [new File(["image"], "posting.gif", { type: "image/gif" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "분석 시작" }));

    expect(screen.getByRole("alert").textContent).toContain("JPEG 또는 PNG");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
