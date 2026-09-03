import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CriterionType,
  EnterpriseType,
  LANGUAGE_TEST_LABELS,
  RequiredFlag,
  formatDeadline,
  formatLanguageRequirement,
  parsePostingDetails,
  type EvaluationCriterion,
} from "@/domain";
import { postingService } from "@/server/container";
import styles from "./posting-detail.module.css";

export const dynamic = "force-dynamic";

const criterionLabels = {
  [CriterionType.LANGUAGE]: "어학",
  [CriterionType.KOREAN_HISTORY]: "한국사",
  [CriterionType.COMPUTER_SKILL]: "컴퓨터활용능력",
  [CriterionType.OTHER_CERT]: "기타 자격증",
};

function criterionValue(criterion: EvaluationCriterion): string {
  if (criterion.type === CriterionType.LANGUAGE) {
    return criterion.languageRequirements.length > 0
      ? criterion.languageRequirements.map(formatLanguageRequirement).join(" 또는 ")
      : "기준 정보 없음";
  }
  if (
    criterion.type === CriterionType.KOREAN_HISTORY ||
    criterion.type === CriterionType.COMPUTER_SKILL
  ) {
    return criterion.cutoffScore === null ? "기준 정보 없음" : `${criterion.cutoffScore}급 이상`;
  }
  return criterion.acceptableCerts.length > 0
    ? criterion.acceptableCerts.join(", ")
    : "자격증 정보 없음";
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const posting = await postingService.getPosting(id);
  return { title: posting?.title ?? "공고 상세" };
}

export default async function PostingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const posting = await postingService.getPosting(id);
  if (!posting) notFound();
  const detailSections = posting.details ? parsePostingDetails(posting.details) : [];

  return (
    <article className={styles.page}>
      <Link className={styles.backLink} href="/dashboard">← 대시보드로 돌아가기</Link>

      <header className={styles.hero}>
        <div className={styles.badges}>
          <span>{posting.enterpriseType === EnterpriseType.PUBLIC ? "공기업" : "사기업"}</span>
          {posting.jobCategory && <span>{posting.jobCategory}</span>}
        </div>
        <h1>{posting.title}</h1>
        <p>{posting.company || "기업명 정보 없음"}</p>
        {posting.originalUrl && (
          <a className={styles.sourceLink} href={posting.originalUrl} rel="noopener noreferrer" target="_blank">
            원본 공고 확인하기 <span aria-hidden="true">↗</span>
          </a>
        )}
      </header>

      <section className={styles.summaryGrid} aria-label="공고 기본 정보">
        <div><span>직무</span><strong>{posting.jobRole || "정보 없음"}</strong></div>
        <div><span>모집인원</span><strong>{posting.recruitmentCount || "정보 없음"}</strong></div>
        <div><span>마감일</span><strong>{posting.deadline ? formatDeadline(posting.deadline) : "정보 없음"}</strong></div>
      </section>

      <section className={styles.contentSection}>
        <p className={styles.kicker}>DETAILS</p>
        <h2>공고 상세 내용</h2>
        {detailSections.length === 0 ? (
          <p className={styles.empty}>추출된 상세 내용이 없습니다. 원본 공고에서 내용을 확인해 주세요.</p>
        ) : (
          <div className={styles.details}>
            {detailSections.map((section) => (
              <section className={styles.detailSection} key={section.title}>
                <h3>[{section.title}]</h3>
                <ul>
                  {section.items.map((item, index) => (
                    <li className={section.title === "전형순서" ? styles.process : undefined} key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className={styles.contentSection}>
        <p className={styles.kicker}>QUALIFICATIONS</p>
        <h2>지원 자격</h2>
        {posting.criteria.length === 0 ? (
          <p className={styles.empty}>추출된 지원 자격이 없습니다.</p>
        ) : (
          <div className={styles.criteriaList}>
            {posting.criteria.map((criterion) => (
              <div className={styles.criterion} key={criterion.id}>
                <div>
                  <span className={styles.flag}>{criterion.requiredFlag === RequiredFlag.REQUIRED ? "필수" : "우대"}</span>
                  <strong>{criterionLabels[criterion.type]}</strong>
                </div>
                <p>{criterionValue(criterion)}</p>
                {criterion.type === CriterionType.LANGUAGE && criterion.languageRequirements.length > 1 && (
                  <small>
                    {criterion.languageRequirements.map(({ testType }) => LANGUAGE_TEST_LABELS[testType]).join("·")} 중 하나 이상 충족
                  </small>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
