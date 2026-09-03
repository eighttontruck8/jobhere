"use client";

import {
  CriterionType,
  EnterpriseType,
  RequiredFlag,
  validatePostingDraftRequiredFields,
  type EvaluationCriterionDraft,
  type RequiredPostingDraftField,
} from "@/domain";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  readReviewDrafts,
  toJobPostingDraft,
  updateReviewDraft,
  writeReviewDrafts,
  type SerializedPostingDraft,
} from "./posting-flow";
import styles from "./posting-flow.module.css";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface PostingReviewProps { fetcher?: Fetcher }
interface SaveResponse { error?: string; fields?: string[] }

const criterionLabels = {
  [CriterionType.LANGUAGE]: "어학",
  [CriterionType.KOREAN_HISTORY]: "한국사",
  [CriterionType.OTHER_CERT]: "기타 자격증",
};
const requiredLabels = {
  [RequiredFlag.REQUIRED]: "필수",
  [RequiredFlag.OPTIONAL]: "우대",
};
const emptyCriterion: EvaluationCriterionDraft = {
  type: CriterionType.LANGUAGE,
  requiredFlag: RequiredFlag.REQUIRED,
  cutoffScore: null,
  acceptableCerts: [],
};

export function PostingReview({ fetcher }: PostingReviewProps) {
  const router = useRouter();
  const request = useMemo<Fetcher>(() => fetcher ?? globalThis.fetch, [fetcher]);
  const [drafts, setDrafts] = useState<SerializedPostingDraft[] | null>(null);
  const [errors, setErrors] = useState<Record<number, string[]>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setDrafts(readReviewDrafts(globalThis.sessionStorage));
    });
    return () => { active = false; };
  }, []);

  function commitDrafts(nextDrafts: SerializedPostingDraft[]) {
    setDrafts(nextDrafts);
    writeReviewDrafts(globalThis.sessionStorage, nextDrafts);
  }

  function updateDraft(index: number, update: Partial<SerializedPostingDraft>) {
    if (!drafts) return;
    commitDrafts(updateReviewDraft(drafts, index, update));
    setErrors((current) => ({ ...current, [index]: [] }));
    setMessage("");
  }

  function updateCriterion(draftIndex: number, criterionIndex: number, update: Partial<EvaluationCriterionDraft>) {
    if (!drafts) return;
    updateDraft(draftIndex, {
      criteria: drafts[draftIndex].criteria.map((criterion, index) =>
        index === criterionIndex ? { ...criterion, ...update } : criterion),
    });
  }

  async function saveDraft(index: number) {
    if (!drafts) return;
    const draft = drafts[index];
    const validation = validatePostingDraftRequiredFields(toJobPostingDraft(draft));
    if (!validation.valid) {
      setErrors((current) => ({ ...current, [index]: validation.fields }));
      setMessage("필수 항목을 확인해 주세요.");
      return;
    }

    setSavingIndex(index);
    setMessage("");
    try {
      const response = await request("/api/postings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json()) as SaveResponse;
      if (!response.ok) {
        setErrors((current) => ({ ...current, [index]: body.fields ?? [] }));
        throw new Error(body.error || "공고를 저장하지 못했습니다.");
      }

      const remaining = drafts.filter((_, itemIndex) => itemIndex !== index);
      commitDrafts(remaining);
      setErrors({});
      if (remaining.length === 0) router.push("/dashboard");
      else setMessage("공고를 저장했습니다. 남은 공고를 확인해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고를 저장하지 못했습니다.");
    } finally {
      setSavingIndex(null);
    }
  }

  function cancelReview() {
    writeReviewDrafts(globalThis.sessionStorage, []);
    router.push("/postings/add");
  }

  if (drafts === null) return <p className={styles.loadingState}>분석 결과를 불러오는 중입니다.</p>;
  if (drafts.length === 0) {
    return (
      <section className={styles.emptyReview}>
        <p className={styles.eyebrow}>REVIEW</p>
        <h1>검토할 공고가 없습니다</h1>
        <p>먼저 링크나 이미지에서 채용 공고를 분석해 주세요.</p>
        <button className={styles.primaryButton} onClick={cancelReview} type="button">공고 분석하러 가기</button>
      </section>
    );
  }

  return (
    <div className={styles.flowPage}>
      <header className={styles.reviewHeader}>
        <div>
          <p className={styles.eyebrow}>REVIEW BEFORE SAVE</p>
          <h1>분석 결과 검토</h1>
          <p>자동 추출된 내용을 확인하고 필요한 부분을 수정해 주세요.</p>
        </div>
        <button className={styles.secondaryButton} onClick={cancelReview} type="button">분석 취소</button>
      </header>

      {message && <p className={message.includes("저장했습니다") ? styles.successBanner : styles.errorBanner} role="status">{message}</p>}
      <div className={styles.reviewList}>
        {drafts.map((draft, draftIndex) => {
          const fieldErrors = errors[draftIndex] ?? [];
          const hasError = (field: RequiredPostingDraftField) => fieldErrors.includes(field);
          return (
            <article className={styles.reviewCard} key={`${draft.title}-${draftIndex}`}>
              <div className={styles.reviewCardHeader}>
                <div><span className={styles.draftNumber}>공고 {draftIndex + 1}</span><h2>{draft.title || "제목 미입력 공고"}</h2></div>
                <span>{draft.source === "CRAWLED" ? "링크 분석" : "직접 분석"}</span>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.stackField}><span>기업 구분</span>
                  <select value={draft.enterpriseType} onChange={(event) => updateDraft(draftIndex, { enterpriseType: event.target.value as EnterpriseType })}>
                    <option value={EnterpriseType.PUBLIC}>공기업</option><option value={EnterpriseType.PRIVATE}>사기업</option>
                  </select>
                </label>
                <RequiredField label="회사명" error={hasError("company")} message="회사명을 입력해 주세요.">
                  <input aria-invalid={hasError("company")} value={draft.company ?? ""} onChange={(event) => updateDraft(draftIndex, { company: event.target.value })} />
                </RequiredField>
                <RequiredField label="직무" error={hasError("jobRole")} message="직무를 입력해 주세요.">
                  <input aria-invalid={hasError("jobRole")} value={draft.jobRole ?? ""} onChange={(event) => updateDraft(draftIndex, { jobRole: event.target.value })} />
                </RequiredField>
                <RequiredField label="마감일" error={hasError("deadline")} message="마감일을 입력해 주세요.">
                  <input aria-invalid={hasError("deadline")} type="date" value={draft.deadline?.slice(0, 10) ?? ""} onChange={(event) => updateDraft(draftIndex, { deadline: event.target.value || null })} />
                </RequiredField>
                <label className={`${styles.stackField} ${styles.wideField}`}><span>공고 제목</span>
                  <input value={draft.title} onChange={(event) => updateDraft(draftIndex, { title: event.target.value })} />
                </label>
                <label className={`${styles.stackField} ${styles.wideField}`}><span>직무 카테고리</span>
                  <input placeholder="예: 개발·데이터" value={draft.jobCategory ?? ""} onChange={(event) => updateDraft(draftIndex, { jobCategory: event.target.value })} />
                </label>
              </div>

              <section className={styles.criteriaSection}>
                <div className={styles.criteriaHeader}>
                  <div><h3>지원 자격</h3><p>점수와 인정 자격증을 공고 기준에 맞게 수정하세요.</p></div>
                  <button className={styles.secondaryButton} type="button" onClick={() => updateDraft(draftIndex, { criteria: [...draft.criteria, { ...emptyCriterion }] })}>자격 추가</button>
                </div>
                {draft.criteria.length === 0 ? <p className={styles.criteriaEmpty}>추출된 지원 자격이 없습니다.</p> : draft.criteria.map((criterion, criterionIndex) => (
                  <div className={styles.criterionRow} key={criterionIndex}>
                    <label className={styles.stackField}><span>항목</span>
                      <select aria-label={`공고 ${draftIndex + 1} 자격 ${criterionIndex + 1} 항목`} value={criterion.type} onChange={(event) => updateCriterion(draftIndex, criterionIndex, { type: event.target.value as CriterionType })}>
                        {Object.values(CriterionType).map((type) => <option key={type} value={type}>{criterionLabels[type]}</option>)}
                      </select>
                    </label>
                    <label className={styles.stackField}><span>조건</span>
                      <select aria-label={`공고 ${draftIndex + 1} 자격 ${criterionIndex + 1} 조건`} value={criterion.requiredFlag} onChange={(event) => updateCriterion(draftIndex, criterionIndex, { requiredFlag: event.target.value as RequiredFlag })}>
                        {Object.values(RequiredFlag).map((flag) => <option key={flag} value={flag}>{requiredLabels[flag]}</option>)}
                      </select>
                    </label>
                    <label className={styles.stackField}><span>최저 점수</span>
                      <input min="0" type="number" value={criterion.cutoffScore ?? ""} onChange={(event) => updateCriterion(draftIndex, criterionIndex, { cutoffScore: event.target.value === "" ? null : Number(event.target.value) })} />
                    </label>
                    <label className={styles.stackField}><span>인정 자격증</span>
                      <input placeholder="쉼표로 구분" value={criterion.acceptableCerts.join(", ")} onChange={(event) => updateCriterion(draftIndex, criterionIndex, { acceptableCerts: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
                    </label>
                    <button aria-label={`공고 ${draftIndex + 1} 자격 ${criterionIndex + 1} 삭제`} className={styles.removeButton} type="button" onClick={() => updateDraft(draftIndex, { criteria: draft.criteria.filter((_, index) => index !== criterionIndex) })}>삭제</button>
                  </div>
                ))}
              </section>
              <div className={styles.cardActions}>
                <button className={styles.primaryButton} disabled={savingIndex !== null} type="button" onClick={() => void saveDraft(draftIndex)}>{savingIndex === draftIndex ? "저장 중..." : "이 공고 저장"}</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function RequiredField({ label, error, message, children }: { label: string; error: boolean; message: string; children: React.ReactNode }) {
  return <label className={styles.stackField}><span>{label} *</span>{children}{error && <small className={styles.fieldError}>{message}</small>}</label>;
}
