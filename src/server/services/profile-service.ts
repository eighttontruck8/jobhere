import {
  validateProfile,
  type CredentialProfile,
  type CredentialProfileInput,
  type SaveResult,
} from "@/domain";
import type { ProfileRepository } from "@/server/repositories/profile-repository";

export interface ProfileServiceContract {
  getProfile(): Promise<CredentialProfile | null>;
  saveProfile(
    input: CredentialProfileInput,
  ): Promise<SaveResult<CredentialProfile>>;
}

export class ProfileService implements ProfileServiceContract {
  constructor(private readonly repository: ProfileRepository) {}

  getProfile(): Promise<CredentialProfile | null> {
    return this.repository.find();
  }

  async saveProfile(
    input: CredentialProfileInput,
  ): Promise<SaveResult<CredentialProfile>> {
    const validation = validateProfile(input);

    if (!validation.valid) {
      return {
        ok: false,
        message: "자격 프로필 입력값을 확인해 주세요.",
        issues: validation.issues,
      };
    }

    try {
      return { ok: true, value: await this.repository.upsert(input) };
    } catch {
      return {
        ok: false,
        message: "자격 프로필을 저장하지 못했습니다.",
      };
    }
  }
}
