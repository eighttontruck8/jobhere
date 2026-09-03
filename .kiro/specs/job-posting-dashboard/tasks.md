# Implementation Plan: 채용 공고 대시보드 (Job Posting Dashboard)

## Overview

Next.js(App Router) + TypeScript, Route Handlers + 서비스 계층, Prisma + PostgreSQL 기반의 단일 사용자용 MVP를 점진적으로 구현한다. greenfield 워크스페이스이므로 프로젝트 스캐폴딩을 먼저 수행한다.

구현 순서 원칙:
1. 프로젝트 스캐폴딩(Next.js + TS + Prisma + PostgreSQL + 테스트 프레임워크).
2. 도메인 타입 및 순수 유틸리티 함수(formatDeadline, truncateTitle, 정렬, validateProfile, computeFit)를 먼저 구현하고 property test로 검증 — 조기에 핵심 로직을 안정화한다.
3. 서비스 계층(PostingService, TableService, ProfileService, FitService) → Analysis_Engine → Route Handlers → UI 페이지 순으로 위로 쌓는다.
4. 입력 소스 범위는 MVP에서 LINK + SCREENSHOT IMAGE만 지원한다. PDF/HWPX parser stub 및 비MVP 향상 작업은 선택(*)으로 표시한다.

property test는 최소 100회 반복하며, 각 property test는 다음 태그 형식으로 design 문서의 property를 참조한다:
`Feature: job-posting-dashboard, Property {number}: {property_text}`

## Tasks

- [x] 1. 프로젝트 스캐폴딩 및 기반 설정
  - [x] 1.1 Next.js(App Router) + TypeScript 프로젝트 초기화
    - `create-next-app`으로 App Router + TypeScript 프로젝트 생성, ESLint/tsconfig 구성
    - `app/` 기본 라우트 구조 생성(`app/dashboard`, `app/profile`, `app/postings/add`, `app/postings/review` 디렉터리 placeholder)
    - _Requirements: 1.1_

  - [x] 1.2 Prisma + PostgreSQL 데이터 계층 설정 및 스키마 정의
    - Prisma 설치·초기화, `DATABASE_URL` 환경변수 구성(`.env`, `.env.example`)
    - `prisma/schema.prisma`에 enum(EnterpriseType, PostingSource, CriterionType, RequiredFlag) 및 모델(JobPosting, EvaluationCriterion, CredentialProfile) 정의
    - CredentialProfile.id 고정 상수(`"singleton"`)로 단일 프로필 보장
    - 초기 마이그레이션 생성 및 Prisma Client 생성
    - _Requirements: 1.2, 2.1, 3.5, 6.1_

  - [x] 1.3 테스트 프레임워크 설정 (Vitest + property test 라이브러리)
    - Vitest 및 fast-check 설치·구성, 테스트 스크립트 추가(단일 실행: `vitest --run`)
    - property test 기본 반복 횟수 100회로 설정하는 공용 헬퍼/구성 작성
    - _Requirements: 1.1_

- [x] 2. 도메인 타입 및 순수 유틸리티 — 표시/정렬 로직
  - [x] 2.1 도메인 타입 및 애플리케이션 타입 정의
    - JobPosting, JobPostingDraft, EvaluationCriterion, JobCategory, CredentialProfile, CredentialProfileInput, CriterionFit, FitResult, ValidationResult, AddResult, SaveResult 등 TypeScript 타입 정의
    - 열거형(EnterpriseType, CriterionType, RequiredFlag, PostingSource)에 대응하는 TS 타입 정의
    - _Requirements: 1.2, 2.2, 6.1, 7.2_

  - [x] 2.2 formatDeadline 및 truncateTitle 순수 함수 구현
    - `formatDeadline(date)`: `~M/D(요일)` 형식, 월/일 앞자리 0 없음, 한글 단문자 요일
    - `truncateTitle(title, max=100)`: 100자 이하 그대로, 초과 시 100자 + 말줄임(`…`)
    - _Requirements: 1.4, 3.2_

  - [x]* 2.3 formatDeadline / truncateTitle property test
    - **Feature: job-posting-dashboard, Property 10: 마감 기한 포맷 — For any 날짜에 대해, `formatDeadline`의 출력은 `~M/D(요일)` 형식을 만족하며, 월·일·요일은 해당 날짜와 정확히 대응해야 한다.**
    - **Validates: Requirements 3.2**
    - **Feature: job-posting-dashboard, Property 3: 제목 말줄임 불변식 — For any 제목 문자열에 대해, 표시되는 제목 본문 길이는 100자를 초과하지 않으며, 원본이 100자를 초과하는 경우에만 말줄임 표시가 붙어야 한다.**
    - **Validates: Requirements 1.4**
    - 최소 100회 반복

  - [x] 2.4 sortByNewest / sortByDeadlineAsc 정렬 함수 구현
    - `sortByNewest`: createdAt 내림차순
    - `sortByDeadlineAsc`: deadline 오름차순, deadline null 항목은 말미 배치
    - _Requirements: 1.1, 3.3_

  - [x]* 2.5 정렬 함수 property test
    - **Feature: job-posting-dashboard, Property 1: 대시보드 최신순 정렬 — For any 저장된 Job_Posting 목록에 대해, 대시보드 표시 순서는 `createdAt` 기준 내림차순(최신 먼저)이어야 한다.**
    - **Validates: Requirements 1.1**
    - **Feature: job-posting-dashboard, Property 11: 사기업 마감 오름차순 정렬 — For any Private_Company_Posting 집합에 대해, 표시 순서는 마감 기한 오름차순이어야 한다(마감 값이 있는 항목 간).**
    - **Validates: Requirements 3.3**
    - 최소 100회 반복

- [x] 3. 순수 유틸리티 — 검증 및 적합도 계산
  - [x] 3.1 validateProfile 순수 함수 구현
    - languageScore 정수 0~990, koreanHistoryGrade 정수 1~6, certifications 항목당 ≤100자·최대 50개
    - 위반 시 위반 필드 식별하는 ValidationResult 반환
    - _Requirements: 6.2_

  - [x]* 3.2 validateProfile property test
    - **Feature: job-posting-dashboard, Property 20: 자격 프로필 검증 — For any Credential_Profile 입력에 대해, 어학 0~990, 한국사 1~6, 자격증 항목당 ≤100자·최대 50개 제약을 모두 만족할 때만 저장이 수락되며, 위반 시 저장이 거부되고 위반 필드가 식별되며 기존 저장 값이 유지되어야 한다.**
    - **Validates: Requirements 6.2**
    - 최소 100회 반복

  - [x] 3.3 computeFit 순수 함수 구현
    - 필수(REQUIRED) criterion만 대상, 필수 없으면 computable=false
    - 대응 점수 없음 → 미충족 + missing, 점수 ≥ cutoff → 충족, 미만 → 미충족(한국사 등급 매핑 포함)
    - passLikelihoodPercent = round(satisfied / total × 100), 0~100
    - _Requirements: 7.2, 7.3, 7.4, 7.6_

  - [x]* 3.4 computeFit property test
    - **Feature: job-posting-dashboard, Property 21: 충족/미충족 판정 — For any cutoff가 정의된 필수 Criterion과 대응 Credential_Profile 점수에 대해, 점수가 cutoff 이상이면 "충족", 미만이면 "미충족"으로 판정되어야 한다.**
    - **Validates: Requirements 7.2**
    - **Feature: job-posting-dashboard, Property 22: 합격 가능성 비율 — For any 산출된 Fit_Result에 대해, 합격 가능성은 `충족한 필수 Criterion 수 / 전체 필수 Criterion 수 × 100`과 같으며 0~100 범위 안에 있어야 한다.**
    - **Validates: Requirements 7.3**
    - **Feature: job-posting-dashboard, Property 23: 누락 점수 미충족 처리 — For any 필수 Criterion에 대응하는 점수가 Credential_Profile에 없는 경우, 해당 Criterion은 "미충족"으로 판정되고 누락 항목 목록에 포함되어야 한다.**
    - **Validates: Requirements 7.4**
    - 최소 100회 반복

- [x] 4. 체크포인트 — 순수 로직 검증
  - 모든 테스트가 통과하는지 확인하고, 의문이 생기면 사용자에게 질문한다.

- [x] 5. 통합 표(Evaluation_Criteria_Table) 순수 로직
  - [x] 5.1 통합 표 구성 순수 함수 구현
    - 공기업(PUBLIC)만 대상, category 필터 적용, 상위 20행 상한 구성
    - 필수: cutoffScore 표시/null 대체 표시, 선택: acceptableCerts 표시/빈 목록 대체 표시
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x]* 5.2 통합 표 구성 property test
    - **Feature: job-posting-dashboard, Property 4: 통합 표 행 수 상한 — For any 공기업 공고 집합에 대해, Evaluation_Criteria_Table의 행 수는 `min(공기업 공고 수, 20)`을 초과하지 않아야 한다.**
    - **Validates: Requirements 2.1**
    - **Feature: job-posting-dashboard, Property 5: Required_Flag 표시 정확성 — For any Criterion에 대해, 표에 표시되는 플래그는 {필수, 선택} 중 정확히 하나이며 해당 Criterion의 `requiredFlag`와 일치해야 한다.**
    - **Validates: Requirements 2.2**
    - **Feature: job-posting-dashboard, Property 6: 직무 카테고리 필터 정확성 — For any 직무 카테고리 필터와 공고 집합에 대해, 필터 적용 결과의 모든 공고는 선택된 카테고리와 일치해야 하며, 일치하는 공고는 하나도 누락되지 않아야 한다.**
    - **Validates: Requirements 2.7**
    - 최소 100회 반복

  - [x] 5.3 addToTable 수동 추가 순수 함수 구현
    - 중복 postingId 거부, 20개 한도 초과 거부, 그 외 추가하고 AddResult 반환
    - _Requirements: 2.9, 2.10_

  - [x]* 5.4 addToTable property test
    - **Feature: job-posting-dashboard, Property 7: 표 수동 추가 멤버십 — For any 표에 없고 한도(20) 미만인 유효한 공고에 대해, 수동 추가 후 그 공고는 표에 포함되고 행 수는 정확히 1 증가해야 한다.**
    - **Validates: Requirements 2.9**
    - **Feature: job-posting-dashboard, Property 8: 표 추가 거부 규칙 — For any 추가 시도에 대해, 그 공고가 이미 표에 포함되어 있거나 추가 시 20개 한도를 초과한다면 추가는 거부되고 표의 행 수는 변하지 않으며 거부 사유가 제공되어야 한다.**
    - **Validates: Requirements 2.10**
    - 최소 100회 반복

- [ ] 6. Analysis_Engine 순수 후처리 로직 (RoleFilter + 개수 캡)
  - [x] 6.1 RoleFilter.apply 및 개수 캡(50) 순수 함수 구현
    - filter 있으면 일치 role만, 없으면 전체, 이후 최대 50개 캡
    - _Requirements: 4.3, 4.4, 4.5_

  - [x]* 6.2 RoleFilter / 개수 캡 property test
    - **Feature: job-posting-dashboard, Property 13: 복수 직무 추출 상한 — For any 복수 직무를 포함한 추출 결과에 대해, Analysis_Engine이 산출하는 Job_Posting 항목 수는 `min(발견된 직무 수, 50)`이어야 한다.**
    - **Validates: Requirements 4.3**
    - **Feature: job-posting-dashboard, Property 14: Role_Filter 적용 정확성 — For any 추출된 직무 집합에 대해, Role_Filter가 설정되면 결과의 모든 직무는 필터와 일치하고 일치하는 직무는 누락되지 않으며, Role_Filter가 없으면 결과는 (50개 상한 내에서) 발견된 모든 직무와 같아야 한다.**
    - **Validates: Requirements 4.4, 4.5**
    - 최소 100회 반복

  - [ ] 6.3 이미지 입력 검증 및 필수 필드 검증 순수 함수 구현
    - 이미지: mimeType ∈ {image/jpeg, image/png} 그리고 sizeBytes ≤ 10MB일 때만 통과, 그 외 UnsupportedImageError
    - draft 필수 필드(기업명·직무명·마감) 검증 함수: 비어 있으면 거부 + 누락 필드 식별
    - _Requirements: 4.8, 5.3_

  - [ ]* 6.4 이미지 검증 / 필수 필드 검증 property test
    - **Feature: job-posting-dashboard, Property 16: 이미지 입력 검증 — For any 제출 이미지에 대해, 형식이 {JPEG, PNG}이고 크기가 10MB 이하일 때만 분석이 수행되며, 그 외에는 조건 미충족 오류로 거부되고 분석이 수행되지 않아야 한다.**
    - **Validates: Requirements 4.8**
    - **Feature: job-posting-dashboard, Property 18: 필수 필드 저장 거부 — For any 검토 draft에 대해, 기업명·직무명·마감 기한 중 하나라도 비어 있으면 저장은 거부되고 누락 필드를 알리는 오류가 제공되어야 한다.**
    - **Validates: Requirements 5.3**
    - 최소 100회 반복

- [ ] 7. 체크포인트 — 표/엔진 순수 로직 검증
  - 모든 테스트가 통과하는지 확인하고, 의문이 생기면 사용자에게 질문한다.

- [x] 8. 서비스 계층 구현 (Prisma 연동)
  - [x] 8.1 PostingService 구현
    - listPostings(최신순), listPrivatePostings(마감 오름차순), savePosting(draft 저장)을 순수 정렬 함수와 Prisma로 조합
    - _Requirements: 1.1, 3.3, 5.4_

  - [x]* 8.2 PostingService 단위 테스트
    - 목록 조회 실패 시 오류 처리(R1.5), 빈 상태(R1.3, R3.4), DB 저장 실패 draft 유지(R5.5) 케이스 (Prisma mock)
    - _Requirements: 1.3, 1.5, 3.4, 5.5_

  - [x] 8.3 TableService 구현
    - buildEvaluationTable(순수 통합 로직 + Prisma 조회), addToTable(순수 함수 위임)
    - _Requirements: 2.1, 2.7, 2.9, 2.10_

  - [x] 8.4 ProfileService 구현
    - getProfile(singleton 조회, 미존재 시 null), saveProfile(validateProfile 후 upsert, 위반 시 기존 값 유지)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 8.5 ProfileService round-trip / 미존재 테스트
    - **Feature: job-posting-dashboard, Property 19: 자격 프로필 왕복(round-trip) — For any 유효 범위 내의 Credential_Profile 입력에 대해, 저장 후 조회하면 저장한 어학 점수·한국사 등급·자격증 항목과 동일한 값을 반환해야 한다.**
    - **Validates: Requirements 6.1**
    - 프로필 미존재 안내(R6.5) 단위 테스트 포함
    - 최소 100회 반복
    - _Requirements: 6.5_

  - [x] 8.6 FitService 구현
    - computeFit 순수 함수 위임, 프로필 미존재 안내(R7.5), 필수 cutoff 미정의 안내(R7.6)
    - _Requirements: 7.1, 7.5, 7.6_

  - [x]* 8.7 FitService 단위 테스트
    - 프로필 미존재 안내(R7.5), cutoff 미정의 안내(R7.6) 케이스
    - _Requirements: 7.5, 7.6_

- [x] 9. Analysis_Engine 오케스트레이션 구현
  - [x] 9.1 SourceParser 인터페이스 및 LinkParser / ImageParser 구현
    - LinkParser: URL fetch → 본문 텍스트, 접근 불가 시 SourceAccessError(R4.7)
    - ImageParser: 형식·크기 검증(6.3 재사용) 후 비전 LLM/OCR 페이로드 준비
    - _Requirements: 4.1, 4.2, 4.7, 4.8_

  - [ ]* 9.2 PdfParser / HwpxParser stub 구현 (선택 — 비MVP)
    - 호출 시 NotImplementedError 반환하는 확장 seam stub
    - stub이 미구현 오류를 반환하는지에 대한 단순 단위 테스트
    - _Requirements: (비목표 확장 seam)_

  - [x] 9.3 LlmExtractionService 및 AnalysisEngine 오케스트레이션 구현
    - parser 선택 → extractRawContent → LLM 추출 → RoleFilter.apply → 50 캡
    - 실패 시 원본 소스 보존한 AnalysisResult 반환(R4.6)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x]* 9.4 원본 소스 보존 property test 및 엔진 통합 테스트
    - **Feature: job-posting-dashboard, Property 15: 추출 실패 시 원본 소스 보존 — For any 추출이 실패하는 입력에 대해, System은 실패를 알리는 결과를 반환하고 사용자가 입력한 원본 소스를 변경 없이 보존해야 한다.**
    - **Validates: Requirements 4.6**
    - 링크 fetch / LLM·비전 API를 mock으로 대체하여 parser 디스패치(link→LinkParser, image→ImageParser) 및 흐름 검증(R4.1, R4.2, R4.7)
    - 최소 100회 반복(property test), 대표 예시 1~3개(통합 테스트)
    - _Requirements: 4.1, 4.2, 4.7_

- [x] 10. 체크포인트 — 서비스/엔진 검증
  - 모든 테스트가 통과하는지 확인하고, 의문이 생기면 사용자에게 질문한다.

- [ ] 11. Route Handlers 구현
  - [x] 11.1 공고 조회/저장 Route Handlers
    - GET `/api/postings`(목록), POST `/api/postings`(검토 완료 저장), GET `/api/postings/table`(통합 표)
    - 입력 검증·서비스 호출·응답 직렬화, 오류 결과 타입 → HTTP 응답 매핑(R1.5, R2.10, R5.3, R5.5)
    - _Requirements: 1.1, 1.5, 2.1, 2.7, 2.9, 2.10, 5.3, 5.4, 5.5_

  - [ ] 11.2 분석 Route Handler
    - POST `/api/analyze`: 입력 검증 후 AnalysisEngine 호출, 실패 시 원본 소스 보존 응답(R4.6, R4.7, R4.8)
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 4.8_

  - [x] 11.3 프로필/적합도 Route Handlers
    - GET/PUT `/api/profile`(조회/저장), GET `/api/postings/:id/fit`(적합도 계산)
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 7.1, 7.5, 7.6_

  - [ ]* 11.4 Route Handler 통합 테스트
    - 서비스 mock으로 각 엔드포인트의 성공/오류 응답 매핑 검증
    - _Requirements: 1.5, 2.10, 4.6, 5.3, 5.5, 6.2, 7.5, 7.6_

- [ ] 12. UI 페이지 구현 및 와이어링
  - [x] 12.1 Dashboard 페이지 (`/dashboard`) 구현
    - 공고 카드 목록(최신순, 라벨, 제목 truncate), 빈 상태(R1.3), 조회 실패 메시지(R1.5)
    - 사기업 인턴십 목록: 기업명 → 직무명 → 마감(~M/D(요일)) 행, 마감 오름차순, 누락 필드 대체 표시, 빈 상태(R3.4)
    - 공기업 통합 표: 20행 상한, 필수/선택 표시, 대체 표시, 직무 카테고리 필터, 수동 추가
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x]* 12.2 Dashboard 표시 컴포넌트 property/단위 테스트
    - **Feature: job-posting-dashboard, Property 2: 공기업/사기업 라벨 정확성 — For any Job_Posting에 대해, 카드에 표시되는 구분 라벨은 {공기업, 사기업} 중 정확히 하나이며 해당 공고의 `enterpriseType`과 일치해야 한다.**
    - **Validates: Requirements 1.2**
    - **Feature: job-posting-dashboard, Property 9: 사기업 행 필드 순서 — For any Private_Company_Posting에 대해, 표시되는 행은 기업명 → 직무명 → 마감 기한 순서의 필드로 구성되어야 한다.**
    - **Validates: Requirements 3.1**
    - **Feature: job-posting-dashboard, Property 12: 누락 필드 대체 표시 — For any 기업명·직무명·마감 중 일부가 누락된 Private_Company_Posting에 대해, 누락된 슬롯에는 대체 표시가 노출되고 존재하는 필드는 정상 표시되어야 한다.**
    - **Validates: Requirements 3.5**
    - 최소 100회 반복
    - 렌더링 에지 케이스: 선택 criterion 자격증 없음(R2.4), 필수 criterion cutoff 없음(R2.6) 대체 표시
    - _Requirements: 2.4, 2.6_

  - [x] 12.3 Profile 페이지 (`/profile`) 구현
    - Credential_Profile 입력/조회 폼, 검증 오류 필드 표시(R6.2), 저장 완료 표시, 미존재 안내(R6.5)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 12.4 공고 추가 및 Review 페이지 (`/postings/add`, `/postings/review`) 구현
    - add: 링크/이미지 제출 → `/api/analyze` 트리거, 오류 시 원본 소스 보존 표시(R4.6, R4.7, R4.8)
    - review: 추출 draft 편집 표시(R5.1), 편집 반영(R5.2), 필수 필드 검증 저장(R5.3), 저장/취소(R5.4, R5.5, R5.6)
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 12.5 Review 편집 반영 property test
    - **Feature: job-posting-dashboard, Property 17: 검토 편집 반영 — For any Review_Screen에서의 필드 편집에 대해, 저장 대상 draft 데이터는 편집된 값을 정확히 반영해야 한다.**
    - **Validates: Requirements 5.2**
    - 최소 100회 반복

  - [ ] 12.6 적합도(Fit) 표시 와이어링
    - 공고별 적합도 요청 → `/api/postings/:id/fit` 호출 → 충족/미충족·합격 가능성% 표시, 누락 항목 안내(R7.4), 프로필 미존재(R7.5)·cutoff 미정의(R7.6) 안내
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 13. 최종 체크포인트 — 전체 통합 및 테스트
  - 모든 테스트가 통과하는지 확인하고, 의문이 생기면 사용자에게 질문한다.

## Notes

- `*`로 표시된 하위 작업은 선택(테스트/비MVP 확장)이며 빠른 MVP를 위해 건너뛸 수 있다. 단, 상위 구현 작업은 반드시 수행한다.
- PDF/HWPX parser stub(9.2)은 명시적 비목표이며 확장 seam 확보용으로만 선택 표시했다.
- 순수 로직(포맷·정렬·검증·통합·적합도·RoleFilter·개수 캡)을 서비스/Route/UI보다 먼저 구현하고 property test로 조기 검증한다.
- 각 property test는 최소 100회 반복하며 design 문서의 property를 태그로 참조한다.
- 각 작업은 특정 요구사항(세부 조항 번호)을 참조하여 추적성을 확보한다.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "3.1", "3.3", "5.1", "5.3", "6.1", "6.3"] },
    { "id": 4, "tasks": ["2.3", "2.5", "3.2", "3.4", "5.2", "5.4", "6.2", "6.4"] },
    { "id": 5, "tasks": ["8.1", "8.3", "8.4", "8.6", "9.1", "9.2"] },
    { "id": 6, "tasks": ["8.2", "8.5", "8.7", "9.3"] },
    { "id": 7, "tasks": ["9.4", "11.1", "11.2", "11.3"] },
    { "id": 8, "tasks": ["11.4", "12.1", "12.3", "12.4", "12.6"] },
    { "id": 9, "tasks": ["12.2", "12.5"] }
  ]
}
```
