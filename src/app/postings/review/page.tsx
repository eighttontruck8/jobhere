import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "공고 검토" };

export default function ReviewPostingPage() {
  return (
    <PlaceholderPage
      eyebrow="Review posting"
      title="분석 결과 검토"
      description="자동 추출된 공고 내용을 저장 전에 확인하고 수정하는 화면이 들어갈 자리입니다."
    />
  );
}
