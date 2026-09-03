import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CREDENTIAL_PROFILE_ID, LanguageTestType } from "@/domain";
import { ProfileForm } from "./profile-form";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const savedProfile = {
  id: CREDENTIAL_PROFILE_ID,
  languageCredentials: [{ testType: LanguageTestType.TOEIC, score: 870, level: null }],
  koreanHistoryGrade: 2,
  computerSkillGrade: 1,
  certifications: ["정보처리기사"],
  updatedAt: "2026-09-02T00:00:00.000Z",
};

describe("ProfileForm", () => {
  it("저장된 프로필을 조회해 입력값과 자격증을 표시한다", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ data: savedProfile }));

    render(<ProfileForm fetcher={fetcher} />);

    expect(await screen.findByText("TOEIC 870")).not.toBeNull();
    expect((screen.getByLabelText("한국사 등급") as HTMLSelectElement).value).toBe("2");
    expect(screen.getByText("정보처리기사")).not.toBeNull();
    expect(screen.getByText("프로필 등록됨")).not.toBeNull();
  });

  it("프로필 미등록 응답에서 안내와 빈 폼을 표시한다", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ data: null, message: "저장된 자격 정보가 없습니다." }),
    );

    render(<ProfileForm fetcher={fetcher} />);

    expect(
      await screen.findByText("아직 저장된 자격 정보가 없습니다."),
    ).not.toBeNull();
    expect(screen.getByText("프로필 미등록")).not.toBeNull();
    expect(screen.getByText("등록된 자격증이 없습니다.")).not.toBeNull();
  });

  it("범위를 벗어난 값을 필드 오류로 표시하고 저장 요청하지 않는다", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ data: null }));

    render(<ProfileForm fetcher={fetcher} />);
    await screen.findByText("프로필 미등록");

    fireEvent.change(screen.getByLabelText("TOEIC 점수"), {
      target: { value: "991" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "추가" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "프로필 저장" }));

    expect(
      screen.getByText("시험별 어학 점수 또는 등급을 올바르게 입력해 주세요."),
    ).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("입력한 프로필을 PUT으로 저장하고 성공 상태를 표시한다", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return jsonResponse({ data: savedProfile });
      }

      return jsonResponse({ data: null });
    });

    render(<ProfileForm fetcher={fetcher} />);
    await screen.findByText("프로필 미등록");

    fireEvent.change(screen.getByLabelText("TOEIC 점수"), {
      target: { value: "870" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "추가" })[0]);
    fireEvent.change(screen.getByLabelText("한국사 등급"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("자격증 이름"), {
      target: { value: "정보처리기사" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "추가" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "프로필 저장" }));

    expect(await screen.findByText("자격 프로필을 저장했습니다.")).not.toBeNull();
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/profile",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("저장 실패 메시지를 폼 하단에 표시한다", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "PUT"
        ? jsonResponse({ error: "저장 서버가 응답하지 않습니다." }, 500)
        : jsonResponse({ data: null }),
    );

    render(<ProfileForm fetcher={fetcher} />);
    await screen.findByText("프로필 미등록");
    fireEvent.click(screen.getByRole("button", { name: "프로필 저장" }));

    await waitFor(() => {
      expect(screen.getByText("저장 서버가 응답하지 않습니다.")).not.toBeNull();
    });
  });
});
