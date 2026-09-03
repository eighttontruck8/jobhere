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

    return SECTION_ORDER.flatMap((title) => {
      const items = grouped.get(title);
      return items ? [{ title, items }] : [];
    });
  }

  return sections.filter(({ items }) => items.length > 0);
}
