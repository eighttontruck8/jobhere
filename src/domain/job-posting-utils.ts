import type { JobPosting } from "./job-posting";

const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatDeadline(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("유효한 마감일이 필요합니다.");
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = KOREAN_WEEKDAYS[date.getDay()];

  return `~${month}/${day}(${weekday})`;
}

export function truncateTitle(title: string, max = 100): string {
  if (!Number.isInteger(max) || max < 0) {
    throw new RangeError("제목 최대 길이는 0 이상의 정수여야 합니다.");
  }

  return title.length <= max ? title : `${title.slice(0, max)}…`;
}

export function sortByNewest(postings: readonly JobPosting[]): JobPosting[] {
  return [...postings].sort((left, right) => {
    const leftTime = left.createdAt.getTime();
    const rightTime = right.createdAt.getTime();

    if (leftTime === rightTime) {
      return 0;
    }

    return rightTime > leftTime ? 1 : -1;
  });
}

export function sortByDeadlineAsc(
  postings: readonly JobPosting[],
): JobPosting[] {
  return [...postings].sort((left, right) => {
    if (left.deadline === null) {
      return right.deadline === null ? 0 : 1;
    }

    if (right.deadline === null) {
      return -1;
    }

    const leftTime = left.deadline.getTime();
    const rightTime = right.deadline.getTime();

    if (leftTime === rightTime) {
      return 0;
    }

    return leftTime < rightTime ? -1 : 1;
  });
}
