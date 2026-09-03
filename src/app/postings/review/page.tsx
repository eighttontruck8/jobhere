import type { Metadata } from "next";
import { PostingReview } from "@/components/postings/posting-review";

export const metadata: Metadata = { title: "공고 검토" };

export default function ReviewPostingPage() {
  return <PostingReview />;
}
