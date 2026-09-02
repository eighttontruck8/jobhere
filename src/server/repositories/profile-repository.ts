import type {
  CredentialProfile,
  CredentialProfileInput,
} from "@/domain";

export interface ProfileRepository {
  find(): Promise<CredentialProfile | null>;
  upsert(input: CredentialProfileInput): Promise<CredentialProfile>;
}
