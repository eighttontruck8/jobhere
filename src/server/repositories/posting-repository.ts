import type { JobPosting, JobPostingDraft } from "@/domain";

export interface PostingRepository {
  findAll(): Promise<JobPosting[]>;
  create(draft: JobPostingDraft): Promise<JobPosting>;
}
