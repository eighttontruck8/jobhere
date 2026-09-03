export interface PostingDetailSection {
  title: string;
  items: string[];
}

const SECTION_PATTERN = /^\[([^\]]+)\]$/;
const BULLET_PATTERN = /^[-*]\s*/;
const SECTION_TITLE_ALIASES: Record<string, string> = {
  직무내용: "직무",
  직무설명: "직무",
  담당업무: "직무",
  주요업무: "직무",
  근무장소: "근무지",
  근무지역: "근무지",
  임용일: "임용예정일자",
  임용예정일: "임용예정일자",
  입사일: "임용예정일자",
  입사예정일: "임용예정일자",
  전형절차: "전형순서",
  채용절차: "전형순서",
  채용과정: "전형순서",
  응시자격: "지원자격",
  자격요건: "지원자격",
  우대조건: "우대사항",
  주의사항: "유의사항",
};
const SECTION_ORDER = [
  "직무",
  "근무지",
  "임용예정일자",
  "전형순서",
  "지원자격",
  "우대사항",
  "유의사항",
  "기타",
] as const;

const PROCESS_SEPARATOR_PATTERN = /\s*(?:->|→)\s*/;
const EXCLUDED_PROCESS_PATTERN =
  /이의\s*제기|채용\s*검증|검증\s*위원회|채용\s*심사\s*위원회|합격자?\s*발표|서류\s*제출|응시\s*정보\s*등록|^임용(?:\s|$)/;
const KOREAN_DATE_RANGE_PATTERN =
  /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s*[~～-]\s*(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일)?/g;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatShortDate(year: number, month: number, day: number): string {
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}/${day}(${weekday})`;
}

function normalizeScheduleDate(value: string): string {
  return value.trim().replace(
    KOREAN_DATE_RANGE_PATTERN,
    (_, startYear: string, startMonth: string, startDay: string, endYear?: string, endMonth?: string, endDay?: string) => {
      const start = formatShortDate(Number(startYear), Number(startMonth), Number(startDay));
      if (!endMonth || !endDay) return start;
      const end = formatShortDate(Number(endYear ?? startYear), Number(endMonth), Number(endDay));
      return `${start}-${end}`;
    },
  );
}

function normalizeStageName(value: string): string {
  return value
    .trim()
    .replace(/^(?:\d+\s*[.)]|[1-9]️⃣)\s*/, "")
    .replace(/^서류전형$/, "서류")
    .replace(/^필기전형$/, "필기")
    .replace(/^면접전형$/, "면접");
}

function normalizeLocation(value: string | undefined): string | null {
  if (!value) return null;
  const location = value.trim().replace(/^장소\s*:\s*/, "");
  if (!location) return null;
  if (/비대면|온라인|화상/.test(location)) return "💻비대면";
  return `📍${location}`;
}

function normalizeProcessStage(value: string): string | null {
  const stage = value.trim();
  if (!stage || EXCLUDED_PROCESS_PATTERN.test(stage)) return null;

  const metadata = /^(.*?)\s*\(\s*날짜\s*:\s*(.*?)(?:,\s*장소\s*:\s*(.*?))?\s*\)$/.exec(stage);
  if (metadata) {
    const name = normalizeStageName(metadata[1]);
    const date = normalizeScheduleDate(metadata[2]);
    const location = normalizeLocation(metadata[3]);
    return `${name}${date ? ` ${date}` : ""}${location ? ` / ${location}` : ""}`;
  }

  return normalizeScheduleDate(stage)
    .replace(/\s*\/?\s*장소\s*:\s*([^,]+)/g, (_, location: string) => {
      const normalized = normalizeLocation(location);
      return normalized ? ` / ${normalized}` : "";
    })
    .trim();
}

function normalizeProcessItems(items: string[]): string[] {
  return items
    .flatMap((item) => item.split(PROCESS_SEPARATOR_PATTERN))
    .map(normalizeProcessStage)
    .filter((item): item is string => Boolean(item));
}

function normalizeSections(sections: PostingDetailSection[]): PostingDetailSection[] {
  return sections
    .map((section) => section.title === "전형순서"
      ? { ...section, items: normalizeProcessItems(section.items) }
      : section)
    .filter(({ items }) => items.length > 0);
}

function classifyLegacyItem(item: string): string {
  if (/근무지|근무 지역|근무장소/.test(item)) return "근무지";
  if (/임용|입사 예정|입사일/.test(item)) return "임용예정일자";
  if (/전형|필기|면접|인성검사/.test(item)) return "전형순서";
  if (/유의|블라인드|결격/.test(item)) return "유의사항";
  if (/지원\s*자격|응시\s*자격/.test(item)) return "지원자격";
  if (/우대/.test(item)) return "우대사항";
  if (/직무|업무|담당/.test(item)) return "직무";
  return "기타";
}

function normalizeLegacyProcess(item: string): string {
  const stages = item
    .replace(/^전형은\s*/, "")
    .replace(/\s*순으로 진행됩니다?\.?$/, "")
    .split(/,\s*(?=(?:서류|필기|인성|면접))/)
    .map((stage) => stage.trim())
    .filter(Boolean);

  return stages
    .map((stage) => /날짜\s*:/.test(stage)
      ? stage
      : `${stage} (날짜: 미정, 장소: 추후 공지)`)
    .join(" -> ");
}

function splitLegacyJob(item: string): string[] {
  const match = /^(.*?직무)로\s+(.+)$/.exec(item);
  return match ? [match[1], match[2]] : [item];
}

function normalizeLegacyItem(title: string, item: string): string {
  if (title === "전형순서") return normalizeLegacyProcess(item);
  if (title === "임용예정일자") {
    return /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.exec(item)?.[0] ?? item;
  }
  if (title === "근무지") return item.replace(/^근무지는?\s*/, "");
  return item;
}

export function parsePostingDetails(details: string): PostingDetailSection[] {
  const lines = details
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: PostingDetailSection[] = [];
  let current: PostingDetailSection | null = null;

  for (const line of lines) {
    const heading = SECTION_PATTERN.exec(line);
    if (heading) {
      const rawTitle = heading[1].replace(/\s+/g, "").trim();
      const title = SECTION_TITLE_ALIASES[rawTitle] ?? rawTitle;
      current = sections.find((section) => section.title === title) ?? null;
      if (!current) {
        current = { title, items: [] };
        sections.push(current);
      }
      continue;
    }

    if (!current) {
      current = { title: "상세내용", items: [] };
      sections.push(current);
    }
    current.items.push(line.replace(BULLET_PATTERN, "").trim());
  }

  if (sections.length === 1 && sections[0].title === "상세내용") {
    const legacyItems = sections[0].items
      .flatMap((item) => item.split(/(?<=[.!?])\s+/))
      .flatMap((item) => item.split(/(?:이며|이고|하며),?\s*/))
      .flatMap(splitLegacyJob)
      .map((item) => item.trim())
      .filter(Boolean);
    const grouped = new Map<string, string[]>();

    for (const item of legacyItems) {
      const title = classifyLegacyItem(item);
      const normalized = normalizeLegacyItem(title, item);
      grouped.set(title, [...(grouped.get(title) ?? []), normalized]);
    }

    return normalizeSections(SECTION_ORDER.flatMap((title) => {
      const items = grouped.get(title);
      return items ? [{ title, items }] : [];
    }));
  }

  return normalizeSections(sections);
}
