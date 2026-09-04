"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { writeReviewDrafts, type SerializedPostingDraft } from "./posting-flow";
import styles from "./posting-flow.module.css";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface PostingAnalyzerProps { fetcher?: Fetcher }
interface AnalysisResponse { data?: SerializedPostingDraft[]; error?: string }

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png"];

function validateImage(image: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return "JPEG 또는 PNG 형식의 10MB 이하 이미지를 선택해 주세요.";
  }
  return null;
}

function nameClipboardImage(image: File): File {
  const extension = image.type === "image/jpeg" ? "jpg" : "png";
  return new File([image], `클립보드-이미지.${extension}`, {
    type: image.type,
    lastModified: Date.now(),
  });
}

export function PostingAnalyzer({ fetcher }: PostingAnalyzerProps) {
  const router = useRouter();
  const request = useMemo<Fetcher>(() => fetcher ?? globalThis.fetch, [fetcher]);
  const [mode, setMode] = useState<"link" | "image">("link");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function handleClipboardPaste(event: ClipboardEvent) {
      const imageItem = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (!imageItem) return;

      event.preventDefault();
      setMode("image");
      const pastedImage = imageItem.getAsFile();
      if (!pastedImage) {
        setStatus("error");
        setMessage("클립보드에서 이미지를 불러오지 못했습니다. 다시 복사해 주세요.");
        return;
      }

      const validationMessage = validateImage(pastedImage);
      if (validationMessage) {
        setImage(null);
        setStatus("error");
        setMessage(validationMessage);
        return;
      }

      setImage(nameClipboardImage(pastedImage));
      setStatus("idle");
      setMessage("");
    }

    globalThis.addEventListener("paste", handleClipboardPaste);
    return () => globalThis.removeEventListener("paste", handleClipboardPaste);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "link" && !url.trim()) {
      setStatus("error");
      setMessage("분석할 채용 공고 링크를 입력해 주세요.");
      return;
    }
    if (mode === "image" && !image) {
      setStatus("error");
      setMessage("분석할 채용 공고 이미지를 선택해 주세요.");
      return;
    }
    if (mode === "image" && image) {
      const validationMessage = validateImage(image);
      if (validationMessage) {
        setStatus("error");
        setMessage(validationMessage);
        return;
      }
    }

    setStatus("analyzing");
    setMessage("");
    try {
      let response: Response;
      if (mode === "link") {
        response = await request("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "link", url: url.trim(), roleFilter: roleFilter.trim() || null }),
        });
      } else {
        const form = new FormData();
        form.set("image", image as File);
        if (roleFilter.trim()) form.set("roleFilter", roleFilter.trim());
        response = await request("/api/analyze", { method: "POST", body: form });
      }
      const body = (await response.json()) as AnalysisResponse;
      if (!response.ok || !body.data?.length) throw new Error(body.error || "공고 정보를 추출하지 못했습니다.");
      writeReviewDrafts(globalThis.sessionStorage, body.data);
      router.push("/postings/review");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "공고 분석 요청을 처리하지 못했습니다.");
    }
  }

  function changeMode(nextMode: "link" | "image") {
    setMode(nextMode);
    setStatus("idle");
    setMessage("");
  }

  return (
    <div className={styles.flowPage}>
      <header className={styles.flowHeader}>
        <p className={styles.eyebrow}>SMART IMPORT</p>
        <h1>채용 공고 분석</h1>
        <p>채용 페이지 링크나 공고 스크린샷을 올리면 검색 가능한 항목으로 정리합니다.</p>
      </header>
      <form className={styles.analyzerCard} onSubmit={handleSubmit}>
        <div className={styles.modeTabs} aria-label="공고 입력 방식" role="tablist">
          <button aria-selected={mode === "link"} role="tab" type="button" onClick={() => changeMode("link")}>링크로 분석</button>
          <button aria-selected={mode === "image"} role="tab" type="button" onClick={() => changeMode("image")}>이미지로 분석</button>
        </div>
        <div className={styles.analyzerBody}>
          {mode === "link" ? (
            <label className={styles.stackField}>
              <span>채용 공고 링크</span>
              <input aria-label="채용 공고 링크" aria-invalid={status === "error" && !url.trim()} placeholder="https://careers.example.com/jobs/123" type="url" value={url}
                onChange={(event) => { setUrl(event.target.value); setStatus("idle"); }} />
              <small>공식 채용 페이지와 공개 카페 게시물 링크를 지원합니다.</small>
            </label>
          ) : (
            <label className={styles.uploadBox}>
              <span className={styles.uploadIcon} aria-hidden="true">＋</span>
              <strong aria-live="polite">{image ? image.name : "파일을 선택하거나 스크린샷 붙여넣기"}</strong>
              <small>{image ? `${(image.size / 1024 / 1024).toFixed(2)}MB` : "Ctrl+V로 붙여넣기 · JPEG 또는 PNG · 최대 10MB"}</small>
              <input accept="image/jpeg,image/png" aria-label="채용 공고 이미지" type="file"
                onChange={(event) => { setImage(event.target.files?.[0] ?? null); setStatus("idle"); }} />
            </label>
          )}
          <label className={styles.stackField}>
            <span>관심 직무 필터 <em>선택</em></span>
            <input aria-label="관심 직무 필터" placeholder="예: 백엔드 개발" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} />
            <small>입력하면 정확히 일치하는 직무만 추출합니다.</small>
          </label>
          {message && <p className={styles.errorBanner} role="alert">{message}</p>}
          <button className={styles.primaryButton} disabled={status === "analyzing"} type="submit">
            {status === "analyzing" ? "공고 분석 중..." : "분석 시작"}
          </button>
        </div>
      </form>
      <div className={styles.flowNotes}>
        <span><strong>01</strong> 원문 읽기</span>
        <span><strong>02</strong> 직무별 정보 추출</span>
        <span><strong>03</strong> 검토 후 저장</span>
      </div>
    </div>
  );
}
