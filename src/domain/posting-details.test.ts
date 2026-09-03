import { describe, expect, it } from "vitest";
import { parsePostingDetails } from "@/domain";

describe("parsePostingDetails", () => {
  it("대괄호 제목과 개조식 항목을 섹션으로 변환한다", () => {
    expect(parsePostingDetails(`
[직무]
- 5급 일반행정
- 경영·사무 및 재무·회계

[전형순서]
- 서류전형 (날짜: 미정, 장소: 비대면) -> 면접전형 (날짜: 추후 공지, 장소: 대구)
    `)).toEqual([
      { title: "직무", items: ["5급 일반행정", "경영·사무 및 재무·회계"] },
      { title: "전형순서", items: ["서류전형 (날짜: 미정, 장소: 비대면) -> 면접전형 (날짜: 추후 공지, 장소: 대구)"] },
    ]);
  });

  it("기존 문단형 상세 내용도 항목별 섹션과 전형 흐름으로 변환한다", () => {
    const result = parsePostingDetails(
      "한국장학재단 5급 일반행정 직무로 경영·사무 업무를 담당합니다. 근무지는 대구이며, 2026년 12월 14일 임용 예정입니다. 전형은 서류전형, 필기전형, 면접전형 순으로 진행됩니다. 입사지원서는 블라인드 채용 기준에 따라 작성해야 합니다.",
    );

    expect(result.map(({ title }) => title)).toEqual([
      "직무",
      "근무지",
      "임용예정일자",
      "전형순서",
      "유의사항",
    ]);
    expect(result.find(({ title }) => title === "직무")?.items).toEqual([
      "한국장학재단 5급 일반행정 직무",
      "경영·사무 업무를 담당합니다.",
    ]);
    expect(result.find(({ title }) => title === "임용예정일자")?.items).toEqual([
      "2026년 12월 14일",
    ]);
    expect(result.find(({ title }) => title === "전형순서")?.items[0]).toBe(
      "서류전형 (날짜: 미정, 장소: 추후 공지) -> 필기전형 (날짜: 미정, 장소: 추후 공지) -> 면접전형 (날짜: 미정, 장소: 추후 공지)",
    );
  });

  it("동일 의미의 섹션 제목은 표준 용어로 합치고 고유 항목은 보존한다", () => {
    expect(parsePostingDetails(`
[직무내용]
- 시스템 운영
[담당 업무]
- 서비스 개선
[복리후생]
- 선택적 복지 제도
    `)).toEqual([
      { title: "직무", items: ["시스템 운영", "서비스 개선"] },
      { title: "복리후생", items: ["선택적 복지 제도"] },
    ]);
  });
});
