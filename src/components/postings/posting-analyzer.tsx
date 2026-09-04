"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { writeReviewDrafts, type SerializedPostingDraft } from "./posting-flow";
import styles from "./posting-flow.module.css";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface PostingAnalyzerProps { fetcher?: Fetcher }
interface AnalysisResponse { data?: SerializedPostingDraft[]; error?: string }

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_COUNT = 10;
const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png"];

function validateImage(image: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(image.type) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return "JPEG 또는 PNG 형식의 10MB 이하 이미지를 선택해 주세요.";
  }
  return null;
}

function nameClipboardImage(image: File, index: number): File {
  const extension = image.type === "image/jpeg" ? "jpg" : "png";
  return new File([image], `클립보드-이미지-${index}.${extension}`, {
    type: image.type,
    lastModified: Date.now(),
  });
}

function validateImageCollection(images: readonly File[]): string | null {
  if (images.length > MAX_IMAGE_COUNT) return `이미지는 최대 ${MAX_IMAGE_COUNT}장까지 첨부할 수 있습니다.`;
  for (const image of images) {
    const message = validateImage(image);
    if (message) return message;
  }
  const totalSize = images.reduce((sum, image) => sum + image.size, 0);
  return totalSize > MAX_TOTAL_IMAGE_BYTES
    ? "이미지 전체 용량은 30MB 이하만 첨부할 수 있습니다."
    : null;
}

export function PostingAnalyzer({ fetcher }: PostingAnalyzerProps) {
  const router = useRouter();
  const request = useMemo<Fetcher>(() => fetcher ?? globalThis.fetch, [fetcher]);
  const [mode, setMode] = useState<"link" | "image">("link");
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");
  const [message, setMessage] = useState("");

  const addImages = useCallback((newImages: File[], fromClipboard = false) => {
    const preparedImages = fromClipboard
      ? newImages.map((image, index) => nameClipboardImage(image, images.length + index + 1))
      : newImages;
    const nextImages = [...images, ...preparedImages];
    const validationMessage = validateImageCollection(nextImages);
    setMode("image");
    if (validationMessage) {
      setStatus("error");
      setMessage(validationMessage);
      return;
    }

    setImages(nextImages);
    setStatus("idle");
    setMessage("");
  }, [images]);

  useEffect(() => {
    function handleClipboardPaste(event: ClipboardEvent) {
      const imageItems = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      event.preventDefault();
      const pastedImages = imageItems
        .map((item) => item.getAsFile())
        .filter((image): image is File => image !== null);
      if (pastedImages.length === 0) {
        setMode("image");
        setStatus("error");
        setMessage("클립보드에서 이미지를 불러오지 못했습니다. 다시 복사해 주세요.");
        return;
      }
      addImages(pastedImages, true);
    }

    globalThis.addEventListener("paste", handleClipboardPaste);
    return () => globalThis.removeEventListener("paste", handleClipboardPaste);
  }, [addImages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "link" && !url.trim()) {
      setStatus("error");
      setMessage("분석할 채용 공고 링크를 입력해 주세요.");
      return;
    }
    if (mode === "image" && images.length === 0) {
      setStatus("error");
      setMessage("분석할 채용 공고 이미지를 한 장 이상 선택해 주세요.");
      return;
    }
    if (mode === "image") {
      const validationMessage = validateImageCollection(images);
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
        images.forEach((image) => form.append("images", image));
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
            <div className={styles.imageInput}>
              <label className={styles.uploadBox}>
                <span className={styles.uploadIcon} aria-hidden="true">＋</span>
                <strong aria-live="polite">{images.length > 0 ? `${images.length}장의 스크린샷 첨부됨` : "파일을 선택하거나 스크린샷 붙여넣기"}</strong>
                <small>여러 번 Ctrl+V 가능 · PNG/JPEG · 장당 10MB · 최대 10장</small>
                <input accept="image/jpeg,image/png" aria-label="채용 공고 이미지" multiple type="file"
                  onChange={(event) => {
                    addImages(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }} />
              </label>
              {images.length > 0 && (
                <ul className={styles.imageQueue} aria-label="첨부한 채용 공고 이미지">
                  {images.map((image, index) => (
                    <li key={`${image.name}-${image.lastModified}-${index}`}>
                      <span><strong>{index + 1}. {image.name}</strong><small>{(image.size / 1024 / 1024).toFixed(2)}MB</small></span>
                      <button aria-label={`${image.name} 삭제`} onClick={() => {
                        setImages(images.filter((_, itemIndex) => itemIndex !== index));
                        setStatus("idle");
                        setMessage("");
                      }} type="button">삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
