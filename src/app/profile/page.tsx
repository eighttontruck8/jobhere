import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "내 자격" };

export default function ProfilePage() {
  return <ProfileForm />;
}
