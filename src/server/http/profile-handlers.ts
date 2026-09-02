import type { ProfileServiceContract } from "@/server/services/profile-service";
import { RequestBodyValidationError } from "./posting-draft-parser";
import { parseCredentialProfileInput } from "./profile-input-parser";

export function createProfileHandlers(service: ProfileServiceContract) {
  return {
    async GET(): Promise<Response> {
      try {
        const profile = await service.getProfile();

        return Response.json(
          profile
            ? { data: profile }
            : { data: null, message: "저장된 자격 정보가 없습니다." },
        );
      } catch {
        return Response.json(
          { error: "자격 프로필을 불러오지 못했습니다." },
          { status: 500 },
        );
      }
    },

    async PUT(request: Request): Promise<Response> {
      try {
        const body: unknown = await request.json();
        const input = parseCredentialProfileInput(body);
        const result = await service.saveProfile(input);

        if (result.ok) {
          return Response.json({ data: result.value });
        }

        return Response.json(
          { error: result.message, issues: result.issues },
          { status: result.issues ? 422 : 500 },
        );
      } catch (error) {
        if (error instanceof RequestBodyValidationError) {
          return Response.json(
            { error: error.message, fields: error.fields },
            { status: 400 },
          );
        }

        if (error instanceof SyntaxError) {
          return Response.json(
            { error: "요청 본문이 올바른 JSON이 아닙니다." },
            { status: 400 },
          );
        }

        return Response.json(
          { error: "자격 프로필을 저장하지 못했습니다." },
          { status: 500 },
        );
      }
    },
  };
}
