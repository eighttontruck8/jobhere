import type { PrismaClient } from "@/generated/prisma/client";
import {
  CREDENTIAL_PROFILE_ID,
  type CredentialProfile,
  type CredentialProfileInput,
} from "@/domain";
import type { ProfileRepository } from "./profile-repository";

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly client: PrismaClient) {}

  async find(): Promise<CredentialProfile | null> {
    const profile = await this.client.credentialProfile.findUnique({
      where: { id: CREDENTIAL_PROFILE_ID },
    });

    return profile
      ? {
          ...profile,
          id: CREDENTIAL_PROFILE_ID,
          certifications: [...profile.certifications],
        }
      : null;
  }

  async upsert(input: CredentialProfileInput): Promise<CredentialProfile> {
    const data = {
      languageScore: input.languageScore,
      koreanHistoryGrade: input.koreanHistoryGrade,
      certifications: [...input.certifications],
    };
    const profile = await this.client.credentialProfile.upsert({
      where: { id: CREDENTIAL_PROFILE_ID },
      create: { id: CREDENTIAL_PROFILE_ID, ...data },
      update: data,
    });

    return {
      ...profile,
      id: CREDENTIAL_PROFILE_ID,
      certifications: [...profile.certifications],
    };
  }
}
