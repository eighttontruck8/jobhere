import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "대시보드" };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      eyebrow="Dashboard"
      title="채용 공고 대시보드"
      description="공기업과 사기업 채용 공고, 공기업 평가 기준표와 내 자격 적합도를 한 화면에서 확인하게 됩니다."
    />
  );
}
