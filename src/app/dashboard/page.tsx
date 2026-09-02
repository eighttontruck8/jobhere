import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "대시보드" };

export default function DashboardPage() {
  return <Dashboard />;
}
