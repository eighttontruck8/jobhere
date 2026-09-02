import { computeFit, type FitResult } from "@/domain";
import type { PostingRepository } from "@/server/repositories/posting-repository";
import type { ProfileRepository } from "@/server/repositories/profile-repository";

export type FitServiceErrorCode =
  | "PROFILE_NOT_FOUND"
  | "POSTING_NOT_FOUND"
  | "CUTOFF_NOT_DEFINED";

export type FitServiceResult =
  | { ok: true; value: FitResult }
  | { ok: false; code: FitServiceErrorCode; message: string };

export interface FitServiceContract {
  getFit(postingId: string): Promise<FitServiceResult>;
}

export class FitService implements FitServiceContract {
  constructor(
    private readonly postingRepository: PostingRepository,
    private readonly profileRepository: ProfileRepository,
  ) {}

  async getFit(postingId: string): Promise<FitServiceResult> {
    const profile = await this.profileRepository.find();

    if (!profile) {
      return {
        ok: false,
        code: "PROFILE_NOT_FOUND",
        message: "적합도 계산을 위해 자격 프로필을 먼저 입력해 주세요.",
      };
    }

    const posting = await this.postingRepository.findById(postingId);

    if (!posting) {
      return {
        ok: false,
        code: "POSTING_NOT_FOUND",
        message: "요청한 채용 공고를 찾을 수 없습니다.",
      };
    }

    const fit = computeFit(posting.criteria, profile);

    if (!fit.computable) {
      return {
        ok: false,
        code: "CUTOFF_NOT_DEFINED",
        message: "필수 커트라인 정보가 없어 적합도를 계산할 수 없습니다.",
      };
    }

    return { ok: true, value: fit };
  }
}
