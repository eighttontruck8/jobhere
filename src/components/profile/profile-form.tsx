"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PROFILE_LIMITS,
  LANGUAGE_TEST_LABELS,
  LanguageTestType,
  getLanguageLevels,
  validateProfile,
  type CredentialProfile,
  type CredentialProfileInput,
  type ProfileValidationField,
  type ValidationIssue,
  type LanguageRequirement,
  type LanguageTestType as LanguageTestTypeValue,
} from "@/domain";
import styles from "./profile-form.module.css";

interface SerializedProfile
  extends Omit<CredentialProfile, "updatedAt"> {
  updatedAt: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  issues?: ValidationIssue[];
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface ProfileFormProps {
  fetcher?: Fetcher;
}

type LoadStatus = "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "success" | "error";

function parseOptionalInteger(value: string): number | null {
  return value === "" ? null : Number(value);
}

function groupIssues(
  issues: readonly ValidationIssue[],
): Partial<Record<ProfileValidationField, string[]>> {
  return issues.reduce<Partial<Record<ProfileValidationField, string[]>>>(
    (grouped, issue) => {
      grouped[issue.field] = [...(grouped[issue.field] ?? []), issue.message];
      return grouped;
    },
    {},
  );
}

export function ProfileForm({ fetcher }: ProfileFormProps) {
  const request = useMemo<Fetcher>(
    () => fetcher ?? globalThis.fetch,
    [fetcher],
  );
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [languageCredentials, setLanguageCredentials] = useState<LanguageRequirement[]>([]);
  const [languageTestType, setLanguageTestType] = useState<LanguageTestTypeValue>(LanguageTestType.TOEIC);
  const [languageValue, setLanguageValue] = useState("");
  const [koreanHistoryGrade, setKoreanHistoryGrade] = useState("");
  const [computerSkillGrade, setComputerSkillGrade] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certificationDraft, setCertificationDraft] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void request("/api/profile")
      .then(async (response) => {
        const body = (await response.json()) as ApiResponse<SerializedProfile | null>;

        if (!response.ok || body.data === undefined) {
          throw new Error(body.error || "자격 프로필을 불러오지 못했습니다.");
        }

        if (!active) return;

        if (body.data === null) {
          setIsNewProfile(true);
          setStatusMessage(body.message || "저장된 자격 정보가 없습니다.");
        } else {
          setLanguageCredentials(body.data.languageCredentials);
          setKoreanHistoryGrade(
            body.data.koreanHistoryGrade?.toString() ?? "",
          );
          setComputerSkillGrade(body.data.computerSkillGrade?.toString() ?? "");
          setCertifications(body.data.certifications);
          setUpdatedAt(body.data.updatedAt);
        }

        setLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setLoadStatus("error");
        setStatusMessage(
          "자격 프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      });

    return () => {
      active = false;
    };
  }, [request]);

  const groupedIssues = groupIssues(issues);

  function appendLanguageCredential() {
    if (!languageValue) return;
    const credential: LanguageRequirement = languageTestType === LanguageTestType.TOEIC
      ? { testType: languageTestType, score: Number(languageValue), level: null }
      : { testType: languageTestType, score: null, level: languageValue };

    setLanguageCredentials((current) => [
      ...current.filter(({ testType }) => testType !== languageTestType),
      credential,
    ]);
    setLanguageValue("");
    setIssues((current) => current.filter(({ field }) => field !== "languageCredentials"));
    setSaveStatus("idle");
  }

  function appendCertification() {
    const value = certificationDraft.trim();
    if (!value) return;

    if (certifications.length >= PROFILE_LIMITS.certificationCount) {
      setIssues([
        {
          field: "certifications",
          message: "자격증은 최대 50개까지 저장할 수 있습니다.",
        },
      ]);
      return;
    }

    setCertifications((current) => [...current, value]);
    setCertificationDraft("");
    setIssues((current) =>
      current.filter(({ field }) => field !== "certifications"),
    );
    setSaveStatus("idle");
  }

  function handleCertificationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    appendCertification();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const pendingCertification = certificationDraft.trim();
    const input: CredentialProfileInput = {
      languageCredentials,
      koreanHistoryGrade: parseOptionalInteger(koreanHistoryGrade),
      computerSkillGrade: parseOptionalInteger(computerSkillGrade),
      certifications: pendingCertification
        ? [...certifications, pendingCertification]
        : certifications,
    };
    const validation = validateProfile(input);

    if (!validation.valid) {
      setIssues(validation.issues);
      setSaveStatus("error");
      setStatusMessage("입력값을 확인해 주세요.");
      return;
    }

    setIssues([]);
    setSaveStatus("saving");
    setStatusMessage("");

    try {
      const response = await request("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as ApiResponse<SerializedProfile>;

      if (!response.ok || body.data === undefined) {
        setIssues(body.issues ?? []);
        throw new Error(body.error || "자격 프로필을 저장하지 못했습니다.");
      }

      setCertifications(body.data.certifications);
      setCertificationDraft("");
      setUpdatedAt(body.data.updatedAt);
      setIsNewProfile(false);
      setSaveStatus("success");
      setStatusMessage("자격 프로필을 저장했습니다.");
    } catch (error) {
      setSaveStatus("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "자격 프로필을 저장하지 못했습니다.",
      );
    }
  }

  if (loadStatus === "loading") {
    return <div className={styles.pageState}>자격 프로필을 불러오는 중입니다.</div>;
  }

  if (loadStatus === "error") {
    return (
      <div className={`${styles.pageState} ${styles.errorState}`} role="alert">
        <strong>프로필을 열 수 없습니다.</strong>
        <span>{statusMessage}</span>
      </div>
    );
  }

  return (
    <div className={styles.profilePage}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>MY CREDENTIALS</p>
          <h1>내 자격 프로필</h1>
          <p>
            보유 자격을 한 번 저장하면 공고별 필수 조건과 적합도를 빠르게
            비교할 수 있습니다.
          </p>
        </div>
        <div className={styles.profileStatus}>
          <span>{isNewProfile ? "프로필 미등록" : "프로필 등록됨"}</span>
          {updatedAt && (
            <time dateTime={updatedAt}>
              최근 저장 {new Date(updatedAt).toLocaleDateString("ko-KR")}
            </time>
          )}
        </div>
      </header>

      {isNewProfile && statusMessage && saveStatus === "idle" && (
        <div className={styles.guide} role="status">
          <strong>아직 저장된 자격 정보가 없습니다.</strong>
          <span>알고 있는 항목만 입력해도 괜찮습니다.</span>
        </div>
      )}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <section className={styles.formSection} aria-labelledby="score-title">
          <div className={styles.sectionHeading}>
            <span>01</span>
            <div>
              <h2 id="score-title">점수 및 등급</h2>
              <p>비어 있는 항목은 미보유 정보로 저장됩니다.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="language-test">어학 시험</label>
              <select
                id="language-test"
                value={languageTestType}
                onChange={(event) => {
                  setLanguageTestType(event.target.value as LanguageTestTypeValue);
                  setLanguageValue("");
                }}
              >
                {Object.values(LanguageTestType).map((type) => (
                  <option key={type} value={type}>{LANGUAGE_TEST_LABELS[type]}</option>
                ))}
              </select>
              <div className={styles.certificationInput}>
                {languageTestType === LanguageTestType.TOEIC ? (
                  <input
                    aria-label="TOEIC 점수"
                    inputMode="numeric"
                    max="990"
                    min="0"
                    placeholder="0~990"
                    type="number"
                    value={languageValue}
                    onChange={(event) => setLanguageValue(event.target.value)}
                  />
                ) : (
                  <select
                    aria-label={`${LANGUAGE_TEST_LABELS[languageTestType]} 등급`}
                    value={languageValue}
                    onChange={(event) => setLanguageValue(event.target.value)}
                  >
                    <option value="">등급 선택</option>
                    {getLanguageLevels(languageTestType).map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                )}
                <button type="button" onClick={appendLanguageCredential}>추가</button>
              </div>
              <small>같은 시험을 다시 추가하면 기존 값이 변경됩니다.</small>
              {groupedIssues.languageCredentials?.map((message) => (
                <small className={styles.fieldError} key={message}>{message}</small>
              ))}
              {languageCredentials.length > 0 && (
                <ul className={styles.certificationList}>
                  {languageCredentials.map((credential) => (
                    <li key={credential.testType}>
                      <span>{LANGUAGE_TEST_LABELS[credential.testType]} {credential.score ?? credential.level}</span>
                      <button type="button" aria-label={`${LANGUAGE_TEST_LABELS[credential.testType]} 삭제`} onClick={() => setLanguageCredentials((current) => current.filter(({ testType }) => testType !== credential.testType))}>삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="history-grade">한국사 등급</label>
              <div className={styles.inputWithUnit}>
                <select
                  id="history-grade"
                  aria-describedby="history-help history-error"
                  aria-invalid={Boolean(groupedIssues.koreanHistoryGrade)}
                  name="koreanHistoryGrade"
                  value={koreanHistoryGrade}
                  onChange={(event) => {
                    setKoreanHistoryGrade(event.target.value);
                    setSaveStatus("idle");
                  }}
                >
                  <option value="">미보유</option>
                  <option value="3">3급</option>
                  <option value="2">2급</option>
                  <option value="1">1급</option>
                </select>
              </div>
              <small id="history-help">3급, 2급, 1급</small>
              {groupedIssues.koreanHistoryGrade?.map((message) => (
                <small className={styles.fieldError} id="history-error" key={message}>
                  {message}
                </small>
              ))}
            </div>

            <div className={styles.field}>
              <label htmlFor="computer-skill-grade">컴퓨터활용능력</label>
              <div className={styles.inputWithUnit}>
                <select
                  id="computer-skill-grade"
                  aria-invalid={Boolean(groupedIssues.computerSkillGrade)}
                  value={computerSkillGrade}
                  onChange={(event) => {
                    setComputerSkillGrade(event.target.value);
                    setSaveStatus("idle");
                  }}
                >
                  <option value="">미보유</option>
                  <option value="2">2급</option>
                  <option value="1">1급</option>
                </select>
              </div>
              <small>2급, 1급</small>
              {groupedIssues.computerSkillGrade?.map((message) => (
                <small className={styles.fieldError} key={message}>{message}</small>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby="cert-title">
          <div className={styles.sectionHeading}>
            <span>02</span>
            <div>
              <h2 id="cert-title">보유 자격증</h2>
              <p>자격증 이름을 입력하고 Enter 또는 추가 버튼을 누르세요.</p>
            </div>
          </div>

          <div className={styles.certificationInput}>
            <input
              aria-label="자격증 이름"
              maxLength={PROFILE_LIMITS.certificationLength + 1}
              placeholder="예: 정보처리기사"
              type="text"
              value={certificationDraft}
              onChange={(event) => {
                setCertificationDraft(event.target.value);
                setSaveStatus("idle");
              }}
              onKeyDown={handleCertificationKeyDown}
            />
            <button type="button" onClick={appendCertification}>
              추가
            </button>
          </div>

          <div className={styles.certificationSummary}>
            <span>등록된 자격증</span>
            <strong>{certifications.length}/{PROFILE_LIMITS.certificationCount}</strong>
          </div>
          {certifications.length === 0 ? (
            <div className={styles.emptyCertifications}>등록된 자격증이 없습니다.</div>
          ) : (
            <ul className={styles.certificationList}>
              {certifications.map((certification, index) => (
                <li key={`${certification}-${index}`}>
                  <span>{certification}</span>
                  <button
                    aria-label={`${certification} 삭제`}
                    type="button"
                    onClick={() => {
                      setCertifications((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      );
                      setSaveStatus("idle");
                    }}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          {groupedIssues.certifications?.map((message) => (
            <p className={styles.fieldError} key={message}>{message}</p>
          ))}
        </section>

        <footer className={styles.formFooter}>
          <div aria-live="polite">
            {statusMessage && saveStatus !== "idle" && (
              <p className={saveStatus === "success" ? styles.successMessage : styles.errorMessage}>
                {statusMessage}
              </p>
            )}
          </div>
          <button disabled={saveStatus === "saving"} type="submit">
            {saveStatus === "saving" ? "저장 중..." : "프로필 저장"}
          </button>
        </footer>
      </form>
    </div>
  );
}
