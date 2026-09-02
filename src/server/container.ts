import { prisma } from "@/server/db/prisma";
import { PrismaPostingRepository } from "@/server/repositories/prisma-posting-repository";
import { PostingService } from "@/server/services/posting-service";
import { TableService } from "@/server/services/table-service";

const postingRepository = new PrismaPostingRepository(prisma);

export const postingService = new PostingService(postingRepository);
export const tableService = new TableService(postingRepository);
