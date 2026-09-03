import { prisma } from "@/server/db/prisma";
import {
  AnalysisEngine,
  ImageParser,
  LinkParser,
  LlmExtractionService,
  OpenAiResponsesGateway,
} from "@/server/analysis";
import { PrismaPostingRepository } from "@/server/repositories/prisma-posting-repository";
import { PrismaProfileRepository } from "@/server/repositories/prisma-profile-repository";
import { FitService } from "@/server/services/fit-service";
import { PostingService } from "@/server/services/posting-service";
import { ProfileService } from "@/server/services/profile-service";
import { TableService } from "@/server/services/table-service";

const postingRepository = new PrismaPostingRepository(prisma);
const profileRepository = new PrismaProfileRepository(prisma);

export const postingService = new PostingService(postingRepository);
export const tableService = new TableService(postingRepository);
export const profileService = new ProfileService(profileRepository);
export const fitService = new FitService(postingRepository, profileRepository);

export function createAnalysisEngine(): AnalysisEngine | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) return null;

  const gateway = new OpenAiResponsesGateway({
    apiKey,
    model,
    baseUrl: process.env.OPENAI_BASE_URL,
  });

  return new AnalysisEngine(
    [new LinkParser(), new ImageParser()],
    new LlmExtractionService(gateway),
  );
}
