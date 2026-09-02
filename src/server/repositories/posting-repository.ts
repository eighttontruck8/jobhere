import type { JobPosting, JobPostingDraft } from "@/domain";

export interface PostingRepository {
  findAll(): Promise<JobPosting[]>;
  findById(id: string): Promise<JobPosting | null>;
  create(draft: JobPostingDraft): Promise<JobPosting>;
}
