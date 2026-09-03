import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  parseLanguageRequirements,
  type JobPosting,
  type JobPostingDraft,
} from "@/domain";
import type { PostingRepository } from "./posting-repository";

type PrismaPostingWithCriteria = Prisma.JobPostingGetPayload<{
  include: { criteria: true };
}>;

function toDomainPosting(posting: PrismaPostingWithCriteria): JobPosting {
  return {
    id: posting.id,
    enterpriseType: posting.enterpriseType,
    company: posting.company,
    jobRole: posting.jobRole,
    title: posting.title,
    deadline: posting.deadline,
    jobCategory: posting.jobCategory,
    source: posting.source,
    createdAt: posting.createdAt,
    criteria: posting.criteria.map((criterion) => ({
      id: criterion.id,
      postingId: criterion.postingId,
      type: criterion.type,
      requiredFlag: criterion.requiredFlag,
      languageRequirements: parseLanguageRequirements(criterion.languageRequirements),
      cutoffScore: criterion.cutoffScore,
      acceptableCerts: [...criterion.acceptableCerts],
    })),
  };
}

function toPrismaLanguageRequirements(
  requirements: JobPostingDraft["criteria"][number]["languageRequirements"],
): Prisma.InputJsonValue {
  return requirements.map(({ testType, score, level }) => ({ testType, score, level }));
}

export class PrismaPostingRepository implements PostingRepository {
  constructor(private readonly client: PrismaClient) {}

  async findAll(): Promise<JobPosting[]> {
    const postings = await this.client.jobPosting.findMany({
      include: { criteria: true },
    });

    return postings.map(toDomainPosting);
  }

  async findById(id: string): Promise<JobPosting | null> {
    const posting = await this.client.jobPosting.findUnique({
      where: { id },
      include: { criteria: true },
    });

    return posting ? toDomainPosting(posting) : null;
  }

  async create(draft: JobPostingDraft): Promise<JobPosting> {
    const posting = await this.client.jobPosting.create({
      data: {
        enterpriseType: draft.enterpriseType,
        company: draft.company,
        jobRole: draft.jobRole,
        title: draft.title,
        deadline: draft.deadline,
        jobCategory: draft.jobCategory,
        source: draft.source,
        criteria: {
          create: draft.criteria.map((criterion) => ({
            type: criterion.type,
            requiredFlag: criterion.requiredFlag,
            languageRequirements: toPrismaLanguageRequirements(criterion.languageRequirements),
            cutoffScore: criterion.cutoffScore,
            acceptableCerts: [...criterion.acceptableCerts],
          })),
        },
      },
      include: { criteria: true },
    });

    return toDomainPosting(posting);
  }
}
