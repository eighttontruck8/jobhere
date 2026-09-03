"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addToEvaluationTable,
  CriterionType,
  EnterpriseType,
  formatDeadline,
  RequiredFlag,
  truncateTitle,
  type EvaluationTable,
  type JobPosting,
} from "@/domain";
import {
  getEnterpriseLabel,
  MISSING_POSTING_VALUE,
  toPrivatePostingFields,
} from "./dashboard-view-model";
import styles from "./dashboard.module.css";

interface SerializedPosting extends Omit<JobPosting, "deadline" | "createdAt"> {
  deadline: string | null;
  createdAt: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface DashboardProps {
  fetcher?: Fetcher;
}

const criterionColumns = [
  { type: CriterionType.LANGUAGE, label: "어학" },
  { type: CriterionType.KOREAN_HISTORY, label: "한국사" },
  { type: CriterionType.COMPUTER_SKILL, label: "컴활" },
  { type: CriterionType.OTHER_CERT, label: "기타 자격증" },
] as const;

function deserializePosting(posting: SerializedPosting): JobPosting {
  return {
    ...posting,
    deadline: posting.deadline ? new Date(posting.deadline) : null,
    createdAt: new Date(posting.createdAt),
  };
}

async function requestData<T>(fetcher: Fetcher, url: string): Promise<T> {
  const response = await fetcher(url);
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || body.data === undefined) {
    throw new Error(body.error || "데이터를 불러오지 못했습니다.");
  }

  return body.data;
}

function SectionState({ children }: { children: string }) {
  return <div className={styles.sectionState}>{children}</div>;
}

export function Dashboard({ fetcher }: DashboardProps) {
  const request = useMemo<Fetcher>(
    () => fetcher ?? globalThis.fetch,
    [fetcher],
  );
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [privatePostings, setPrivatePostings] = useState<JobPosting[]>([]);
  const [table, setTable] = useState<EvaluationTable>({
    rows: [],
    filter: null,
  });
  const [postingsStatus, setPostingsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [privateStatus, setPrivateStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [tableStatus, setTableStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [category, setCategory] = useState("");
  const [manualPostingId, setManualPostingId] = useState("");
  const [tableNotice, setTableNotice] = useState("");

  const loadTable = useCallback(
    async (selectedCategory = "") => {
      setTableStatus("loading");
      setTableNotice("");

      try {
        const query = selectedCategory
          ? `?category=${encodeURIComponent(selectedCategory)}`
          : "";
        const nextTable = await requestData<EvaluationTable>(
          request,
          `/api/postings/table${query}`,
        );
        setTable(nextTable);
        setTableStatus("ready");
      } catch {
        setTableStatus("error");
      }
    },
    [request],
  );

  useEffect(() => {
    let active = true;

    void requestData<SerializedPosting[]>(request, "/api/postings")
      .then((data) => {
        if (!active) return;
        setPostings(data.map(deserializePosting));
        setPostingsStatus("ready");
      })
      .catch(() => {
        if (active) setPostingsStatus("error");
      });

    void requestData<SerializedPosting[]>(
      request,
      "/api/postings?view=private",
    )
      .then((data) => {
        if (!active) return;
        setPrivatePostings(data.map(deserializePosting));
        setPrivateStatus("ready");
      })
      .catch(() => {
        if (active) setPrivateStatus("error");
      });

    void requestData<EvaluationTable>(request, "/api/postings/table")
      .then((data) => {
        if (!active) return;
        setTable(data);
        setTableStatus("ready");
      })
      .catch(() => {
        if (active) setTableStatus("error");
      });

    return () => {
      active = false;
    };
  }, [request]);

  const publicPostings = postings.filter(
    ({ enterpriseType }) => enterpriseType === EnterpriseType.PUBLIC,
  );
  const categories = Array.from(
    new Set(
      publicPostings
        .map(({ jobCategory }) => jobCategory)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right, "ko"));

  function handleManualAdd() {
    const posting = publicPostings.find(({ id }) => id === manualPostingId);

    if (!posting) {
      setTableNotice("추가할 공기업 공고를 선택해 주세요.");
      return;
    }

    const result = addToEvaluationTable(table, posting);
    if (!result.ok) {
      setTableNotice(
        result.reason === "DUPLICATE"
          ? "이미 비교표에 포함된 공고입니다."
          : "비교표에는 최대 20개까지만 추가할 수 있습니다.",
      );
      return;
    }

    setTable(result.table);
    setManualPostingId("");
    setTableNotice("선택한 공고를 비교표에 추가했습니다.");
  }

  return (
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>JOB OVERVIEW</p>
          <h1>
            기회를 한눈에,
            <br />
            지원 준비는 선명하게
          </h1>
          <p className={styles.heroDescription}>
            최신 채용 공고와 공기업 자격 기준을 비교하고, 다음 지원을 빠르게
            결정하세요.
          </p>
        </div>
        <Link className={styles.primaryAction} href="/postings/add">
          공고 추가하기 <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section aria-labelledby="latest-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>LATEST</p>
            <h2 id="latest-title">최신 채용 공고</h2>
          </div>
          <span className={styles.count}>{postings.length}개</span>
        </div>

        {postingsStatus === "loading" && (
          <SectionState>최신 공고를 불러오는 중입니다.</SectionState>
        )}
        {postingsStatus === "error" && (
          <SectionState>
            공고 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </SectionState>
        )}
        {postingsStatus === "ready" && postings.length === 0 && (
          <SectionState>아직 등록된 채용 공고가 없습니다.</SectionState>
        )}
        {postingsStatus === "ready" && postings.length > 0 && (
          <div className={styles.cardGrid}>
            {postings.map((posting) => (
              <article className={styles.postingCard} key={posting.id}>
                <div className={styles.cardMeta}>
                  <span
                    className={`${styles.badge} ${
                      posting.enterpriseType === EnterpriseType.PUBLIC
                        ? styles.publicBadge
                        : styles.privateBadge
                    }`}
                  >
                    {getEnterpriseLabel(posting.enterpriseType)}
                  </span>
                  <span>{posting.jobCategory || MISSING_POSTING_VALUE}</span>
                </div>
                <h3>{truncateTitle(posting.title, 56)}</h3>
                <p className={styles.company}>
                  {posting.company?.trim() || MISSING_POSTING_VALUE}
                </p>
                <div className={styles.cardFooter}>
                  <span>
                    {posting.jobRole?.trim() || MISSING_POSTING_VALUE}
                  </span>
                  <strong>
                    {posting.deadline
                      ? formatDeadline(posting.deadline)
                      : MISSING_POSTING_VALUE}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="private-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>DEADLINE</p>
            <h2 id="private-title">사기업 마감 일정</h2>
          </div>
          <span className={styles.headingNote}>마감 임박순</span>
        </div>

        {privateStatus === "loading" && (
          <SectionState>마감 일정을 불러오는 중입니다.</SectionState>
        )}
        {privateStatus === "error" && (
          <SectionState>사기업 공고를 불러오지 못했습니다.</SectionState>
        )}
        {privateStatus === "ready" && privatePostings.length === 0 && (
          <SectionState>확인할 사기업 공고가 없습니다.</SectionState>
        )}
        {privateStatus === "ready" && privatePostings.length > 0 && (
          <div className={styles.privateList} role="list">
            {privatePostings.map((posting) => {
              const [company, role, deadline] =
                toPrivatePostingFields(posting);

              return (
                <div
                  className={styles.privateRow}
                  key={posting.id}
                  role="listitem"
                >
                  <strong>{company}</strong>
                  <span>{role}</span>
                  <time dateTime={posting.deadline?.toISOString()}>
                    {deadline}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="table-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>PUBLIC COMPANY</p>
            <h2 id="table-title">공기업 평가 기준 비교</h2>
          </div>
          <span className={styles.count}>{table.rows.length}/20</span>
        </div>

        <div className={styles.toolbar}>
          <label>
            <span>직무 카테고리</span>
            <select
              aria-label="직무 카테고리"
              value={category}
              onChange={(event) => {
                const value = event.target.value;
                setCategory(value);
                void loadTable(value);
              }}
            >
              <option value="">전체 직무</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.manualAdd}>
            <select
              aria-label="비교표에 추가할 공고"
              value={manualPostingId}
              onChange={(event) => setManualPostingId(event.target.value)}
            >
              <option value="">공기업 공고 선택</option>
              {publicPostings.map((posting) => (
                <option key={posting.id} value={posting.id}>
                  {posting.company || posting.title}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleManualAdd}>
              비교표에 추가
            </button>
          </div>
        </div>
        {tableNotice && (
          <p className={styles.notice} role="status">
            {tableNotice}
          </p>
        )}

        {tableStatus === "loading" && (
          <SectionState>평가 기준표를 불러오는 중입니다.</SectionState>
        )}
        {tableStatus === "error" && (
          <SectionState>평가 기준표를 불러오지 못했습니다.</SectionState>
        )}
        {tableStatus === "ready" && table.rows.length === 0 && (
          <SectionState>조건에 맞는 공기업 공고가 없습니다.</SectionState>
        )}
        {tableStatus === "ready" && table.rows.length > 0 && (
          <div className={styles.tableScroll}>
            <table className={styles.evaluationTable}>
              <thead>
                <tr>
                  <th>기업 · 직무</th>
                  {criterionColumns.map(({ type, label }) => (
                    <th key={type}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.postingId}>
                    <th scope="row">
                      <strong>{row.company || MISSING_POSTING_VALUE}</strong>
                      <span>{row.jobRole || MISSING_POSTING_VALUE}</span>
                    </th>
                    {criterionColumns.map(({ type }) => {
                      const cell = row.criteria[type];

                      return (
                        <td key={type}>
                          <span
                            className={styles.flag}
                            data-required={
                              cell.requiredFlag === RequiredFlag.REQUIRED
                            }
                          >
                            {cell.requiredFlag === RequiredFlag.REQUIRED
                              ? "필수"
                              : cell.requiredFlag === RequiredFlag.OPTIONAL
                                ? "선택"
                                : "미정"}
                          </span>
                          <span>{cell.displayValue}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
