import {
  EnterpriseType,
  formatDeadline,
  type EnterpriseType as EnterpriseTypeValue,
} from "@/domain";

export const MISSING_POSTING_VALUE = "정보 없음";

export function getEnterpriseLabel(
  enterpriseType: EnterpriseTypeValue,
): "공기업" | "사기업" {
  return enterpriseType === EnterpriseType.PUBLIC ? "공기업" : "사기업";
}

export interface PrivatePostingDisplaySource {
  company: string | null;
  jobRole: string | null;
  deadline: Date | null;
}

export function toPrivatePostingFields(
  posting: PrivatePostingDisplaySource,
): readonly [company: string, jobRole: string, deadline: string] {
  return [
    posting.company?.trim() || MISSING_POSTING_VALUE,
    posting.jobRole?.trim() || MISSING_POSTING_VALUE,
    posting.deadline
      ? formatDeadline(posting.deadline)
      : MISSING_POSTING_VALUE,
  ];
}
