import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  CREDENTIAL_PROFILE_ID,
  parseLanguageRequirements,
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
          id: CREDENTIAL_PROFILE_ID,
          languageCredentials: parseLanguageRequirements(profile.languageCredentials),
          koreanHistoryGrade: profile.koreanHistoryGrade,
          computerSkillGrade: profile.computerSkillGrade,
          certifications: [...profile.certifications],
          updatedAt: profile.updatedAt,
        }
      : null;
  }

  async upsert(input: CredentialProfileInput): Promise<CredentialProfile> {
    const data = {
      languageCredentials: input.languageCredentials.map(
        ({ testType, score, level }) => ({ testType, score, level }),
      ) as Prisma.InputJsonValue,
      koreanHistoryGrade: input.koreanHistoryGrade,
      computerSkillGrade: input.computerSkillGrade,
      certifications: [...input.certifications],
    };
    const profile = await this.client.credentialProfile.upsert({
      where: { id: CREDENTIAL_PROFILE_ID },
      create: { id: CREDENTIAL_PROFILE_ID, ...data },
      update: data,
    });

    return {
      id: CREDENTIAL_PROFILE_ID,
      languageCredentials: parseLanguageRequirements(profile.languageCredentials),
      koreanHistoryGrade: profile.koreanHistoryGrade,
      computerSkillGrade: profile.computerSkillGrade,
      certifications: [...profile.certifications],
      updatedAt: profile.updatedAt,
    };
  }
}
