import {
  addToEvaluationTable,
  buildEvaluationTable,
  type AddResult,
  type EvaluationTable,
  type JobCategory,
  type JobPosting,
} from "@/domain";
import type { PostingRepository } from "@/server/repositories/posting-repository";

export interface TableServiceContract {
  buildEvaluationTable(filter?: JobCategory | null): Promise<EvaluationTable>;
  addToTable(current: EvaluationTable, posting: JobPosting): AddResult;
}

export class TableService implements TableServiceContract {
  constructor(private readonly repository: PostingRepository) {}

  async buildEvaluationTable(
    filter: JobCategory | null = null,
  ): Promise<EvaluationTable> {
    return buildEvaluationTable(await this.repository.findAll(), filter);
  }

  addToTable(current: EvaluationTable, posting: JobPosting): AddResult {
    return addToEvaluationTable(current, posting);
  }
}
