import {
  EnterpriseType,
  sortByDeadlineAsc,
  sortByNewest,
  validatePostingDraftRequiredFields,
  type JobPosting,
  type JobPostingDraft,
} from "@/domain";
import type { PostingRepository } from "@/server/repositories/posting-repository";

export type RequiredPostingField = "company" | "jobRole" | "deadline";

export class PostingDraftValidationError extends Error {
  constructor(public readonly fields: RequiredPostingField[]) {
    super("필수 공고 정보가 누락되었습니다.");
    this.name = "PostingDraftValidationError";
  }
}

export interface PostingServiceContract {
  listPostings(): Promise<JobPosting[]>;
  listPrivatePostings(): Promise<JobPosting[]>;
  savePosting(draft: JobPostingDraft): Promise<JobPosting>;
}

export class PostingService implements PostingServiceContract {
  constructor(private readonly repository: PostingRepository) {}

  async listPostings(): Promise<JobPosting[]> {
    return sortByNewest(await this.repository.findAll());
  }

  async listPrivatePostings(): Promise<JobPosting[]> {
    const postings = await this.repository.findAll();

    return sortByDeadlineAsc(
      postings.filter(
        ({ enterpriseType }) => enterpriseType === EnterpriseType.PRIVATE,
      ),
    );
  }

  async savePosting(draft: JobPostingDraft): Promise<JobPosting> {
    const validation = validatePostingDraftRequiredFields(draft);

    if (!validation.valid) {
      throw new PostingDraftValidationError(validation.fields);
    }

    return this.repository.create(draft);
  }
}
