# Design Document

## Overview

채용 공고 대시보드(Job Posting Dashboard)는 Next.js(App Router) + TypeScript 기반의 단일 사용자용 MVP 웹 애플리케이션이다. 공기업·사기업 채용 공고를 한 화면에서 조회·비교하고, 단일 자격 프로필(Credential_Profile)을 기준으로 각 공고의 적합도(Fit_Result)와 합격 가능성을 계산한다.

공고 데이터의 기본 소스는 개발자가 사전에 크롤링하여 DB에 적재한 레코드다. 사용자는 예외 경로로서 링크 또는 스크린샷 이미지를 제출하여 LLM 기반 Analysis_Engine을 통해 공고를 추출하고, Review_Screen에서 검토·편집한 뒤 저장한다.

본 설계는 다음 원칙을 따른다.

- **인증 없음**: 단일 사용자 MVP. 공고는 사용자별로 분리되지 않으며 Credential_Profile은 시스템에 하나만 존재한다.
- **입력 소스 범위**: MVP는 LINK + SCREENSHOT IMAGE만 지원한다. PDF/HWPX 파싱은 명시적 비목표이며, `SourceParser` 인터페이스로 확장 seam만 남긴다.
- **데이터 출처 이원화**: 크롤링으로 적재된 공고와 사용자가 추가한 공고를 동일 스키마에 수용한다. `source` 필드로 출처를 구분한다.

### Technology Stack

| 계층 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) |
| 언어 | TypeScript |
| 서버 로직 | Route Handlers (`app/api/**/route.ts`) + 서비스 계층 |
| ORM / 데이터 계층 | Prisma |
| 데이터베이스 | PostgreSQL |
| LLM | OpenAI 호환 API (텍스트 구조화 추출 + 비전/OCR) |

## Architecture

### High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                       Next.js (App Router)                      │
│                                                                 │
│  Pages / Server Components                                      │
│   ├─ /dashboard              공고 카드 + 사기업 목록 + 통합 표     │
│   ├─ /profile               Credential_Profile 입력/조회         │
│   ├─ /postings/add          링크/이미지 제출 → 분석 트리거         │
│   └─ /postings/review       Review_Screen (편집 후 저장)         │
│                                                                 │
│  Route Handlers (app/api/**)                                    │
│   ├─ GET  /api/postings            목록 조회                    │
│   ├─ POST /api/postings            검토 완료 공고 저장            │
│   ├─ GET  /api/postings/table      공기업 통합 표 데이터          │
│   ├─ POST /api/analyze             링크/이미지 분석               │
│   ├─ GET/PUT /api/profile          자격 프로필 조회/저장          │
│   └─ GET  /api/postings/:id/fit    적합도 계산                  │
└───────────────────────────────────────────────────────────────┘
                             │
                 ┌───────────┴────────────┐
                 ▼                         ▼
        ┌─────────────────┐      ┌───────────────────────┐
        │  Service Layer   │      │   Analysis_Engine      │
        │                  │      │                        │
        │ PostingService   │      │ SourceParser (iface)   │
        │ TableService     │◄─────│  ├─ LinkParser         │
        │ ProfileService   │      │  ├─ ImageParser        │
        │ FitService       │      │  ├─ PdfParser (stub)   │
        │                  │      │  └─ HwpxParser (stub)  │
        │ (formatters,     │      │ LlmExtractionService   │
        │  validators,     │      │ RoleFilter             │
        │  calculators)    │      └───────────────────────┘
        └────────┬─────────┘                 │
                 ▼                            ▼
        ┌─────────────────┐         ┌──────────────────┐
        │  Prisma Client   │         │  LLM API (HTTP)  │
        └────────┬─────────┘         └──────────────────┘
                 ▼
         ┌──────────────┐
         │  PostgreSQL   │
         └──────────────┘
```

### Layering Rules

- **Page/Component 계층**: 표시와 사용자 상호작용만 담당. 비즈니스 로직 없음.
- **Route Handler 계층**: 요청 파싱, 입력 검증, 서비스 호출, 응답 직렬화. HTTP 관심사만.
- **Service 계층**: 순수 비즈니스 로직(정렬, 필터, 통합, 포맷, 검증, 적합도 계산). Prisma를 통해 데이터에 접근하되, 순수 계산 함수(formatter/validator/calculator)는 I/O로부터 분리하여 property test 대상으로 삼는다.
- **Analysis_Engine**: 소스 → 구조화된 공고 목록 변환. LLM I/O와 순수 로직(RoleFilter, 개수 캡, 검증)을 분리한다.
- **Data 계층**: Prisma schema + repository 접근.

### Request Flows

**공고 추가 흐름**

```
사용자 → /postings/add (링크 or 이미지)
      → POST /api/analyze
          → 입력 검증 (링크 유효성 / 이미지 형식·크기)
          → SourceParser 선택 (LinkParser | ImageParser)
          → LlmExtractionService: 구조화 JSON(복수 role 가능)
          → RoleFilter 적용 → 최대 50개 캡
      → Review_Screen (편집 가능한 draft)
          → 사용자 편집 → 필수 필드 검증
      → POST /api/postings (저장) → Dashboard 반영
```

**적합도 조회 흐름**

```
사용자 → GET /api/postings/:id/fit
      → ProfileService: Credential_Profile 존재 확인
      → FitService: 각 required cutoff vs profile score 비교
      → Fit_Result (충족/미충족 + 합격 가능성 %)
```

## Components and Interfaces

### Service Layer

```typescript
interface PostingService {
  // 최신순(createdAt desc) 정렬된 목록. R1.1
  listPostings(): Promise<JobPosting[]>;
  // 사기업 목록: deadline 오름차순. R3.3
  listPrivatePostings(): Promise<JobPosting[]>;
  // 검토 완료 공고 저장. R5.4
  savePosting(draft: JobPostingDraft): Promise<JobPosting>;
}

interface TableService {
  // 공기업 통합 표: category 필터, 최대 20행. R2.1, R2.7
  buildEvaluationTable(filter?: JobCategory): Promise<EvaluationTable>;
  // 수동 추가: 중복/한도(20) 검증. R2.9, R2.10
  addToTable(current: EvaluationTable, posting: JobPosting): AddResult;
}

interface ProfileService {
  getProfile(): Promise<CredentialProfile | null>;   // R6.4, R6.5
  saveProfile(input: CredentialProfileInput): SaveResult; // R6.1, R6.2
}

interface FitService {
  computeFit(posting: JobPosting, profile: CredentialProfile): FitResult; // R7.1~7.4
}
```

### Analysis_Engine

`SourceParser`는 소스 종류를 추상화한다. MVP에서는 `LinkParser`, `ImageParser`만 구현하고, `PdfParser`/`HwpxParser`는 미구현 stub으로 명시적 확장 seam을 제공한다.

```typescript
type SourceInput =
  | { kind: "link"; url: string }
  | { kind: "image"; mimeType: string; sizeBytes: number; data: Buffer }
  | { kind: "pdf"; data: Buffer }      // 향후 확장 (미구현)
  | { kind: "hwpx"; data: Buffer };    // 향후 확장 (미구현)

interface SourceParser {
  // 소스에서 LLM 입력에 적합한 원문(텍스트/이미지)을 추출한다.
  supports(input: SourceInput): boolean;
  extractRawContent(input: SourceInput): Promise<RawContent>;
}

class LinkParser implements SourceParser {
  // URL fetch → 페이지 본문 텍스트 추출. R4.1
  // 접근 불가/무효 시 SourceAccessError. R4.7
}

class ImageParser implements SourceParser {
  // 형식(JPEG/PNG)·크기(≤10MB) 검증 후 비전 LLM/OCR용 페이로드 준비. R4.2, R4.8
  // 조건 미충족 시 UnsupportedImageError (분석 미수행). R4.8
}

// 향후 확장 stub — 호출 시 NotImplementedError
class PdfParser implements SourceParser { /* future */ }
class HwpxParser implements SourceParser { /* future */ }

interface LlmExtractionService {
  // RawContent → 구조화된 공고 목록(복수 role 가능). 실패 시 ExtractionError.
  extract(content: RawContent): Promise<ExtractedPosting[]>;
}

interface RoleFilter {
  // filter가 있으면 일치 role만, 없으면 전체. R4.4, R4.5
  apply(postings: ExtractedPosting[], filter?: RoleFilterSpec): ExtractedPosting[];
}

// Engine 오케스트레이션
interface AnalysisEngine {
  analyze(
    input: SourceInput,
    roleFilter?: RoleFilterSpec
  ): Promise<AnalysisResult>;
  // 1) parser 선택 및 검증
  // 2) extractRawContent
  // 3) LlmExtractionService.extract
  // 4) RoleFilter.apply
  // 5) 최대 50개 캡. R4.3
  // 실패 시 원본 소스를 AnalysisResult에 보존. R4.6
}

type AnalysisResult =
  | { ok: true; postings: ExtractedPosting[] }
  | { ok: false; error: AnalysisError; originalSource: SourceInput }; // R4.6
```

### Pure Utility Functions

property test의 주요 대상. I/O와 분리하여 순수 함수로 구현한다.

```typescript
// 마감 기한 포맷: ~M/D(요일). 예: ~9/2(수). R3.2
function formatDeadline(date: Date): string;

// 제목 표시: 최대 100자, 초과 시 100자 + 말줄임. R1.4
function truncateTitle(title: string, max = 100): string;

// 최신순 정렬(createdAt desc). R1.1
function sortByNewest(postings: JobPosting[]): JobPosting[];

// 마감 오름차순 정렬. R3.3
function sortByDeadlineAsc(postings: JobPosting[]): JobPosting[];

// 자격 프로필 검증. R6.2
function validateProfile(input: CredentialProfileInput): ValidationResult;

// 적합도 계산. R7.2~7.4
function computeFit(criteria: EvaluationCriterion[], profile: CredentialProfile): FitResult;
```

## Data Models

### Prisma Schema (개념 정의)

```prisma
enum EnterpriseType {
  PUBLIC   // 공기업
  PRIVATE  // 사기업
}

enum PostingSource {
  CRAWLED  // 개발자 크롤링 적재
  USER     // 사용자 추가 (Analysis_Engine 경유)
}

enum CriterionType {
  LANGUAGE       // 어학
  KOREAN_HISTORY // 한국사
  COMPUTER_SKILL // 컴퓨터활용능력
  OTHER_CERT     // 기타 자격증
}

enum RequiredFlag {
  REQUIRED  // 필수
  OPTIONAL  // 선택
}

model JobPosting {
  id             String          @id @default(cuid())
  enterpriseType EnterpriseType
  company        String?         // 기업명 (누락 가능 R3.5)
  jobRole        String?         // 직무명 (누락 가능 R3.5)
  title          String          // 공고 제목 (표시 100자 캡 R1.4)
  deadline       DateTime?       // 마감 기한 (누락 가능 R3.5)
  jobCategory    String?         // 직무 카테고리 (필터용 R2.7)
  source         PostingSource   @default(CRAWLED)
  createdAt      DateTime        @default(now()) // 최신순 정렬 기준 R1.1
  criteria       EvaluationCriterion[]
}

model EvaluationCriterion {
  id              String        @id @default(cuid())
  postingId       String
  posting         JobPosting    @relation(fields: [postingId], references: [id], onDelete: Cascade)
  type            CriterionType
  requiredFlag    RequiredFlag
  languageRequirements Json       // TOEIC/OPIc/TOEIC Speaking 대체 기준 배열
  cutoffScore     Int?          // 필수일 때 커트라인; null 가능 R2.6
  acceptableCerts String[]      // 선택일 때 인정 자격증; 빈 배열 가능 R2.4
}

model CredentialProfile {
  id                String   @id @default("singleton") // 단일 프로필 강제
  languageCredentials Json     // 시험별 점수 또는 등급
  koreanHistoryGrade Int?    // 1~3 R6.2
  computerSkillGrade Int?    // 1~2 R6.2
  certifications    String[] // 항목당 ≤100자, ≤50개 R6.2
  updatedAt         DateTime @updatedAt
}
```

> **단일 프로필 보장**: `CredentialProfile.id`를 고정 상수(`"singleton"`)로 두어 upsert로 항상 하나의 레코드만 유지한다.

> **크롤링 vs 사용자 추가**: 동일 `JobPosting` 스키마를 공유하며 `source`로만 구분한다. 크롤링 적재는 앱 범위 밖이지만 스키마가 두 경로를 모두 수용한다.

### Application Types

```typescript
// FitResult는 계산 결과이며 반드시 영속화하지 않는다(요청 시 계산).
interface CriterionFit {
  type: CriterionType;
  cutoffScore: number | null;
  profileScore: number | null;
  status: "충족" | "미충족";
  missing: boolean;          // profile에 대응 점수 없음 R7.4
}

interface FitResult {
  postingId: string;
  criterionFits: CriterionFit[];
  satisfiedRequiredCount: number;
  totalRequiredCount: number;
  passLikelihoodPercent: number;   // 0~100 R7.3
  missingCriteria: CriterionType[]; // R7.4
  computable: boolean;              // 필수 cutoff 없으면 false R7.6
}
```

## Detailed Logic Design

### Deadline Formatting (R3.2)

`formatDeadline(date)` → `~{월}/{일}({요일})`.
- 월/일은 앞자리 0 없이(9월 2일 → `9/2`).
- 요일은 한글 단문자(일·월·화·수·목·금·토), 대상 date의 요일에 대응.
- 예: 2025-09-02(화) → `~9/2(화)`.

### Title Truncation (R1.4)

`truncateTitle(title, 100)`:
- `title.length <= 100` → 그대로.
- `> 100` → 앞 100자 + 말줄임 표시(`…`). 표시되는 실제 제목 본문은 100자를 초과하지 않는다.

### Evaluation_Criteria_Table Consolidation (R2)

1. 공기업(`PUBLIC`) 공고만 대상.
2. category 필터가 있으면 `jobCategory` 일치 공고만 선택(R2.7).
3. 상위 20개까지 행으로 구성(R2.1). 초과분은 표시하지 않음.
4. 각 행에 대해 어학/한국사/기타자격증 열 구성.
   - 필수: cutoffScore 표시, null이면 대체 표시(R2.5, R2.6).
   - 선택: acceptableCerts 표시, 빈 목록이면 대체 표시(R2.3, R2.4).
5. 필터 결과 0건이면 안내 문구(R2.8).

**수동 추가(R2.9, R2.10)** — `addToTable(current, posting)`:
- 이미 표에 포함된 postingId이면 거부(사유: 중복).
- 현재 행 수가 20이면 거부(사유: 한도 초과).
- 그 외에는 추가하고 표에 포함. `AddResult = { ok: true, table } | { ok: false, reason }`.

### Private Company Display (R3)

- 각 사기업 공고를 `기업명 > 직무명 > 마감(~M/D(요일))` 순서 한 행으로 표시(R3.1).
- deadline 오름차순 정렬(R3.3). deadline이 null인 항목은 정렬 말미에 배치.
- 필드 누락 시 해당 슬롯만 대체 표시(예: `정보 없음`), 나머지 필드는 정상 표시(R3.5).
- 표시할 사기업 공고 0건이면 안내 문구 + 빈 영역 유지(R3.4).

### Analysis_Engine Flow (R4)

1. **입력 검증**
   - 링크: URL 형식·도달 가능성 확인. 실패 시 `SourceAccessError`(R4.7).
   - 이미지: mimeType ∈ {image/jpeg, image/png} 그리고 sizeBytes ≤ 10MB. 미충족 시 `UnsupportedImageError`, 분석 미수행(R4.8).
2. **원문 추출**: LinkParser는 페이지 본문 텍스트, ImageParser는 비전 LLM/OCR 페이로드.
3. **LLM 구조화 추출**: 하나 이상의 role을 포함한 구조화 JSON 반환.
4. **RoleFilter 적용**: filter 있으면 일치 role만, 없으면 전체(R4.4, R4.5).
5. **개수 캡**: 최대 50개(R4.3).
6. **실패 처리**: 추출 실패 시 오류 메시지 + 원본 소스 보존하여 반환(R4.6).

### Review & Save (R5)

- 추출 결과를 편집 가능한 draft로 표시(R5.1).
- 필드 편집은 draft 상태에 즉시 반영(R5.2).
- 저장 시 필수 필드(기업명, 직무명, 마감) 검증. 비어 있으면 거부 + 누락 필드 안내(R5.3).
- 저장 확정 시 DB 영속화 + 성공 알림(R5.4). 실패 시 오류 + draft 유지(R5.5).
- 취소 시 draft 폐기(R5.6).

### Credential Profile Validation (R6.2)

`validateProfile(input)` 규칙:
- `languageCredentials`: TOEIC 0~990, OPIc IL→AL, TOEIC Speaking IL→AH. 시험 종류가 같은 값끼리만 비교한다.
- `koreanHistoryGrade`: 정수 1~3.
- `computerSkillGrade`: 정수 1~2.
- `certifications`: 항목 수 ≤ 50, 각 항목 길이 ≤ 100자.
- 하나라도 위반 시 저장 거부, 위반 필드 식별 반환, 기존 저장 값 유지.

### Fit Computation (R7)

`computeFit(criteria, profile)`:
- 대상은 필수(REQUIRED) criterion만.
- 필수 criterion이 하나도 없으면 `computable = false`(R7.6).
- 각 필수 criterion에 대해 profile의 대응 점수 조회:
  - 대응 점수 없음 → `미충족` + `missing`(R7.4).
  - 어학은 동일 시험의 고유 등급 순서로 비교하며 환산표의 대체 기준 중 하나 이상을 만족하면 `충족`.
  - 한국사와 컴퓨터활용능력은 작은 급수가 더 높은 등급으로 매핑.
- `passLikelihoodPercent = round(satisfiedRequiredCount / totalRequiredCount * 100)`, 0~100 범위(R7.3).
- profile 미존재 시 계산 전 안내(R7.5).

## Error Handling

| 상황 | 처리 | 관련 요구사항 |
|------|------|--------------|
| 공고 목록 조회 실패 | 오류 메시지 표시, 기존 카드 목록 유지 | R1.5 |
| 필터 결과 없음 | 안내 문구 | R2.8 |
| 표 중복/한도 초과 추가 | 거부 + 사유 메시지 | R2.10 |
| 사기업 공고 없음 | 안내 문구 + 빈 영역 | R3.4 |
| 필드 누락(표시) | 슬롯별 대체 표시 | R3.5 |
| 추출 실패 | 오류 메시지 + 원본 소스 보존 | R4.6 |
| 링크 접근 불가 | 접근 실패 오류 | R4.7 |
| 이미지 형식/크기 위반 | 조건 미충족 오류, 분석 미수행 | R4.8 |
| 필수 필드 비움 저장 | 거부 + 누락 필드 안내 | R5.3 |
| DB 저장 실패 | 오류 + draft 유지 | R5.5 |
| 프로필 범위/형식 위반 | 거부 + 필드 식별 + 기존 값 유지 | R6.2 |
| 프로필 미존재 (적합도) | 프로필 입력 필요 안내 | R7.5 |
| 필수 cutoff 미정의 | 적합도 산출 불가 안내 | R7.6 |

에러 표현 방식: 서비스/엔진은 예외 대신 판별 가능한 결과 타입(`Result`/`AnalysisResult`)을 우선 사용하여 상태 보존(R4.6, R5.5, R6.2)을 명확히 한다. 예상치 못한 I/O 오류만 예외로 처리한다.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 대시보드 최신순 정렬

*For any* 저장된 Job_Posting 목록에 대해, 대시보드 표시 순서는 `createdAt` 기준 내림차순(최신 먼저)이어야 한다.

**Validates: Requirements 1.1**

### Property 2: 공기업/사기업 라벨 정확성

*For any* Job_Posting에 대해, 카드에 표시되는 구분 라벨은 {공기업, 사기업} 중 정확히 하나이며 해당 공고의 `enterpriseType`과 일치해야 한다.

**Validates: Requirements 1.2**

### Property 3: 제목 말줄임 불변식

*For any* 제목 문자열에 대해, 표시되는 제목 본문 길이는 100자를 초과하지 않으며, 원본이 100자를 초과하는 경우에만 말줄임 표시가 붙어야 한다.

**Validates: Requirements 1.4**

### Property 4: 통합 표 행 수 상한

*For any* 공기업 공고 집합에 대해, Evaluation_Criteria_Table의 행 수는 `min(공기업 공고 수, 20)`을 초과하지 않아야 한다.

**Validates: Requirements 2.1**

### Property 5: Required_Flag 표시 정확성

*For any* Criterion에 대해, 표에 표시되는 플래그는 {필수, 선택} 중 정확히 하나이며 해당 Criterion의 `requiredFlag`와 일치해야 한다.

**Validates: Requirements 2.2**

### Property 6: 직무 카테고리 필터 정확성

*For any* 직무 카테고리 필터와 공고 집합에 대해, 필터 적용 결과의 모든 공고는 선택된 카테고리와 일치해야 하며, 일치하는 공고는 하나도 누락되지 않아야 한다.

**Validates: Requirements 2.7**

### Property 7: 표 수동 추가 멤버십

*For any* 표에 없고 한도(20) 미만인 유효한 공고에 대해, 수동 추가 후 그 공고는 표에 포함되고 행 수는 정확히 1 증가해야 한다.

**Validates: Requirements 2.9**

### Property 8: 표 추가 거부 규칙

*For any* 추가 시도에 대해, 그 공고가 이미 표에 포함되어 있거나 추가 시 20개 한도를 초과한다면 추가는 거부되고 표의 행 수는 변하지 않으며 거부 사유가 제공되어야 한다.

**Validates: Requirements 2.10**

### Property 9: 사기업 행 필드 순서

*For any* Private_Company_Posting에 대해, 표시되는 행은 기업명 → 직무명 → 마감 기한 순서의 필드로 구성되어야 한다.

**Validates: Requirements 3.1**

### Property 10: 마감 기한 포맷

*For any* 날짜에 대해, `formatDeadline`의 출력은 `~M/D(요일)` 형식을 만족하며, 월·일·요일은 해당 날짜와 정확히 대응해야 한다.

**Validates: Requirements 3.2**

### Property 11: 사기업 마감 오름차순 정렬

*For any* Private_Company_Posting 집합에 대해, 표시 순서는 마감 기한 오름차순이어야 한다(마감 값이 있는 항목 간).

**Validates: Requirements 3.3**

### Property 12: 누락 필드 대체 표시

*For any* 기업명·직무명·마감 중 일부가 누락된 Private_Company_Posting에 대해, 누락된 슬롯에는 대체 표시가 노출되고 존재하는 필드는 정상 표시되어야 한다.

**Validates: Requirements 3.5**

### Property 13: 복수 직무 추출 상한

*For any* 복수 직무를 포함한 추출 결과에 대해, Analysis_Engine이 산출하는 Job_Posting 항목 수는 `min(발견된 직무 수, 50)`이어야 한다.

**Validates: Requirements 4.3**

### Property 14: Role_Filter 적용 정확성

*For any* 추출된 직무 집합에 대해, Role_Filter가 설정되면 결과의 모든 직무는 필터와 일치하고 일치하는 직무는 누락되지 않으며, Role_Filter가 없으면 결과는 (50개 상한 내에서) 발견된 모든 직무와 같아야 한다.

**Validates: Requirements 4.4, 4.5**

### Property 15: 추출 실패 시 원본 소스 보존

*For any* 추출이 실패하는 입력에 대해, System은 실패를 알리는 결과를 반환하고 사용자가 입력한 원본 소스를 변경 없이 보존해야 한다.

**Validates: Requirements 4.6**

### Property 16: 이미지 입력 검증

*For any* 제출 이미지에 대해, 형식이 {JPEG, PNG}이고 크기가 10MB 이하일 때만 분석이 수행되며, 그 외에는 조건 미충족 오류로 거부되고 분석이 수행되지 않아야 한다.

**Validates: Requirements 4.8**

### Property 17: 검토 편집 반영

*For any* Review_Screen에서의 필드 편집에 대해, 저장 대상 draft 데이터는 편집된 값을 정확히 반영해야 한다.

**Validates: Requirements 5.2**

### Property 18: 필수 필드 저장 거부

*For any* 검토 draft에 대해, 기업명·직무명·마감 기한 중 하나라도 비어 있으면 저장은 거부되고 누락 필드를 알리는 오류가 제공되어야 한다.

**Validates: Requirements 5.3**

### Property 19: 자격 프로필 왕복(round-trip)

*For any* 유효 범위 내의 Credential_Profile 입력에 대해, 저장 후 조회하면 저장한 어학 점수·한국사 등급·자격증 항목과 동일한 값을 반환해야 한다.

**Validates: Requirements 6.1**

### Property 20: 자격 프로필 검증

*For any* Credential_Profile 입력에 대해, 시험별 어학 범위·등급, 한국사 1~3급, 컴퓨터활용능력 1~2급, 자격증 항목당 ≤100자·최대 50개 제약을 모두 만족할 때만 저장이 수락되며, 위반 시 저장이 거부되고 위반 필드가 식별되며 기존 저장 값이 유지되어야 한다.

**Validates: Requirements 6.2**

### Property 21: 충족/미충족 판정

*For any* cutoff가 정의된 필수 Criterion과 대응 Credential_Profile 점수에 대해, 점수가 cutoff 이상이면 "충족", 미만이면 "미충족"으로 판정되어야 한다.

**Validates: Requirements 7.2**

### Property 22: 합격 가능성 비율

*For any* 산출된 Fit_Result에 대해, 합격 가능성은 `충족한 필수 Criterion 수 / 전체 필수 Criterion 수 × 100`과 같으며 0~100 범위 안에 있어야 한다.

**Validates: Requirements 7.3**

### Property 23: 누락 점수 미충족 처리

*For any* 필수 Criterion에 대응하는 점수가 Credential_Profile에 없는 경우, 해당 Criterion은 "미충족"으로 판정되고 누락 항목 목록에 포함되어야 한다.

**Validates: Requirements 7.4**

## Testing Strategy

### Dual Testing Approach

- **Property tests**: 위 Correctness Properties를 랜덤 입력으로 검증. 순수 함수(formatter, validator, calculator, 정렬·필터·통합 로직, RoleFilter, 개수 캡)를 주 대상으로 한다. property test당 최소 100회 반복.
- **Unit / Example tests**: 구체 시나리오와 에지 케이스.
  - 빈 상태(R1.3, R3.4, R6.5), 조회 실패 시 목록 유지(R1.5), DB 저장 실패 draft 유지(R5.5), 저장 취소 폐기(R5.6), 프로필 미존재 안내(R7.5), 필수 cutoff 미정의 안내(R7.6).
  - 선택 criterion 자격증 없음 대체 표시(R2.4), 필수 criterion cutoff 없음 대체 표시(R2.6) — 렌더링 에지 케이스.
- **Integration tests**: Analysis_Engine의 외부 의존(링크 fetch, LLM/비전 API)은 mock으로 대체하여 1~3개 대표 예시로 검증(R4.1, R4.2, R4.7). parser 디스패치(link→LinkParser, image→ImageParser)와 오케스트레이션 흐름 확인.

### Property Test Configuration

- 각 property test는 최소 100회 반복(randomized).
- 각 property test는 대응하는 design 문서의 property를 다음 태그 형식으로 참조한다:
  **Feature: job-posting-dashboard, Property {number}: {property_text}**

### Notes

- LLM/비전 추출 자체의 품질(정확도)은 외부 모델 특성으로, property test 대상이 아니다. 추출 결과에 대한 순수 후처리(RoleFilter, 개수 캡, 실패 시 소스 보존)만 property로 검증한다.
- PDF/HwpxParser stub은 호출 시 미구현 오류를 반환하는지에 대한 단순 unit test만 둔다(MVP 비목표).
