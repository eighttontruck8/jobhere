import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "내 자격" };

export default function ProfilePage() {
  return (
    <PlaceholderPage
      eyebrow="Credential profile"
      title="내 자격 프로필"
      description="어학 점수, 한국사 등급과 보유 자격증을 저장하고 수정하는 화면이 들어갈 자리입니다."
    />
  );
}
