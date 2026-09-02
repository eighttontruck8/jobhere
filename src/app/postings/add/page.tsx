import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "공고 추가" };

export default function AddPostingPage() {
  return (
    <PlaceholderPage
      eyebrow="Add posting"
      title="새 공고 분석"
      description="채용 공고 링크 또는 스크린샷을 제출해 구조화된 공고 정보를 추출하는 화면이 들어갈 자리입니다."
    />
  );
}
