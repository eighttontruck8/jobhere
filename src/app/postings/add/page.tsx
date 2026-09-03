import type { Metadata } from "next";
import { PostingAnalyzer } from "@/components/postings/posting-analyzer";

export const metadata: Metadata = { title: "공고 추가" };

export default function AddPostingPage() {
  return <PostingAnalyzer />;
}
