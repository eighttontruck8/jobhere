import type { JobPostingDraft } from "@/domain";
import type { SourceInput } from "./source-parser";

export type ExtractedPosting = JobPostingDraft;
export type RoleFilterSpec = string;

export type AnalysisErrorCode =
  | "UNSUPPORTED_SOURCE"
  | "SOURCE_ACCESS_FAILED"
  | "UNSUPPORTED_IMAGE"
  | "EXTRACTION_FAILED"
  | "ANALYSIS_FAILED";

export interface AnalysisError {
  code: AnalysisErrorCode;
  message: string;
}

export type AnalysisResult =
  | { ok: true; postings: ExtractedPosting[] }
  | {
      ok: false;
      error: AnalysisError;
      originalSource: SourceInput;
    };
