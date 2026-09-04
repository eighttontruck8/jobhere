# Requirements Document

## Introduction

채용 공고 대시보드(Job Posting Dashboard)는 공기업과 사기업 채용 공고를 한 화면에서 조회·비교하고, 사용자가 저장한 스펙 프로필(어학/한국사/자격증)을 기준으로 각 공고의 적합도(fit)와 합격 가능성(pass-likelihood)을 계산해 주는 단일 사용자용 MVP 웹 애플리케이션이다.

공고 데이터는 개발자가 사전에 크롤링하여 데이터베이스에 미리 적재하는 것을 기본 소스로 하며, 사용자는 예외 경로로서 링크(웹/카페) 또는 스크린샷 이미지를 직접 추가하여 LLM 기반 자동 분석을 통해 공고를 등록할 수 있다. 자동 분석 결과는 저장 전에 사용자가 검토·편집한다.

본 MVP는 단일 사용자 전제이며 인증 기능을 포함하지 않는다. 공고는 사용자별로 분리되지 않고 단일 자격 프로필(credential profile) 하나만 존재한다.

### Non-Goals (Out of MVP Scope)

- 사용자 인증 및 다중 사용자 지원 (단일 사용자 MVP)
- 사용자가 직접 트리거하는 크롤링 (크롤링은 개발자가 사전 수행)
- PDF 및 HWPX 문서 파싱 기반 공고 추출 (향후 확장 대상)

## Glossary

- **Dashboard**: `/dashboard` 경로에서 저장된 공고를 카드 형태로 표시하는 메인 화면 구성 요소.
- **Job_Posting**: 하나의 채용 공고 레코드. 공기업/사기업 구분, 기업명, 직무, 마감 기한, 평가 기준 등을 포함한다.
- **Public_Enterprise_Posting**: 공기업(공공기관) 채용 공고. 평가 기준 표(어학/한국사/기타 자격증)를 갖는다.
- **Private_Company_Posting**: 사기업 채용 공고. 대기업 인턴십을 기업명 > 직무명 > 제출 마감 기한 형태로 표시한다.
- **Evaluation_Criteria_Table**: 공기업 공고들의 평가 기준(어학, 한국사, 컴퓨터활용능력, 기타 자격증)을 통합하여 보여주는 표.
- **Criterion**: 개별 평가 항목. 어학, 한국사, 컴퓨터활용능력, 기타 자격증 중 하나.
- **Required_Flag**: 각 Criterion이 필수(required) 또는 선택(optional)인지 나타내는 표시.
- **Cutoff_Score**: 필수 Criterion에 대한 커트라인 점수.
- **Analysis_Engine**: 링크 또는 스크린샷 이미지로부터 구조화된 공고 정보를 추출하는 LLM 기반 서브시스템. 이미지의 경우 비전 지원 LLM/OCR을 사용한다.
- **Role_Filter**: 사용자가 설정한 관심 직무 필터.
- **Review_Screen**: 자동 분석 결과를 저장 전에 사용자가 검토·편집하는 화면.
- **Credential_Profile**: 사용자의 시험별 어학/한국사/컴퓨터활용능력/자격증 정보를 저장하는 단일 프로필.
- **Fit_Result**: Credential_Profile을 Job_Posting의 필수 커트라인과 비교하여 산출한 적합도 및 합격 가능성 결과.
- **System**: 본 채용 공고 대시보드 애플리케이션 전체.

## Requirements

### Requirement 1: 대시보드 공고 조회

**User Story:** 취업 준비생으로서, 저장된 채용 공고를 대시보드에서 카드 형태로 한눈에 보고 싶다, 그래야 관심 공고를 빠르게 파악할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 `/dashboard` 경로에 접근하면, THE Dashboard SHALL 저장된 Job_Posting 목록을 저장 시각 기준 최신순으로 카드 형태로 3초 이내에 표시한다.
2. THE Dashboard SHALL 각 Job_Posting 카드에 공기업 또는 사기업 중 하나의 구분 값을 텍스트 라벨로 표시한다.
3. IF 저장된 Job_Posting이 0개이면, THEN THE Dashboard SHALL 공고가 없음을 나타내는 빈 상태 메시지를 표시하고 카드 영역을 표시하지 않는다.
4. THE Dashboard SHALL 각 Job_Posting 카드에 최대 100자까지의 공고 제목을 표시하고, 100자를 초과하는 제목은 100자까지만 표시하고 말줄임 표시로 축약한다.
5. IF 저장된 Job_Posting 목록을 조회하는 데 실패하면, THEN THE Dashboard SHALL 조회 실패를 나타내는 오류 메시지를 표시하고 기존에 표시된 카드 목록을 변경하지 않는다.
6. WHEN 사용자가 Job_Posting 카드를 선택하면, THE System SHALL 해당 공고의 기본 정보·모집인원·상세 내용·지원 자격을 정리한 상세 페이지로 이동한다.
7. WHERE Job_Posting에 원본 URL이 저장되어 있으면, THE 상세 페이지 SHALL 새 창에서 원본 공고를 열 수 있는 하이퍼링크를 표시한다.

### Requirement 2: 공기업 평가 기준 통합 표

**User Story:** 취업 준비생으로서, 여러 공기업 공고의 평가 기준을 통합된 표로 비교하고 싶다, 그래야 어떤 자격이 필요한지 한 번에 비교할 수 있다.

#### Acceptance Criteria

1. THE Evaluation_Criteria_Table SHALL 최대 20개의 Public_Enterprise_Posting을 행으로, 어학·한국사·컴퓨터활용능력·기타 자격증 Criterion을 열로 통합하여 표시한다.
2. THE Evaluation_Criteria_Table SHALL 각 Criterion에 대해 "필수" 또는 "선택" 중 하나의 Required_Flag를 표시한다.
3. WHERE Criterion이 "선택"으로 표시된 경우, THE Evaluation_Criteria_Table SHALL 인정 가능한 자격증 목록을 표시한다.
4. IF "선택" Criterion의 인정 가능한 자격증 목록 데이터가 없으면, THEN THE Evaluation_Criteria_Table SHALL 해당 항목에 자격증 정보가 없음을 나타내는 대체 표시를 노출한다.
5. WHERE Criterion이 "필수"로 표시된 경우, THE Evaluation_Criteria_Table SHALL 해당 Criterion의 Cutoff_Score를 표시한다.
6. IF "필수" Criterion의 Cutoff_Score 데이터가 없으면, THEN THE Evaluation_Criteria_Table SHALL 해당 항목에 커트라인 정보가 없음을 나타내는 대체 표시를 노출한다.
7. WHEN 사용자가 직무 카테고리 필터를 선택하면, THE Evaluation_Criteria_Table SHALL 선택된 직무 카테고리에 해당하는 공고만 3초 이내에 표시한다.
8. IF 선택된 직무 카테고리 필터에 해당하는 공고가 없으면, THEN THE Evaluation_Criteria_Table SHALL 해당 조건에 맞는 공고가 없음을 알리는 안내 문구를 표시한다.
9. WHEN 사용자가 선택한 공고를 수동으로 추가하면, THE Evaluation_Criteria_Table SHALL 추가된 공고를 표에 포함한다.
10. IF 사용자가 이미 표에 포함된 공고를 추가하거나 표시 한도(20개)를 초과하여 추가하면, THEN THE Evaluation_Criteria_Table SHALL 추가를 거부하고 그 사유를 알리는 메시지를 표시한다.

### Requirement 3: 사기업 인턴십 공고 표시

**User Story:** 취업 준비생으로서, 대기업 인턴십 공고를 기업명·직무·마감 기한 형태로 보고 싶다, 그래야 지원 마감일을 놓치지 않을 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 Dashboard에 접근하면, THE Dashboard SHALL 각 Private_Company_Posting을 기업명, 직무명, 제출 마감 기한 순서로 한 행에 표시한다.
2. THE Dashboard SHALL 각 Private_Company_Posting의 제출 마감 기한을 `~9/2(수)` 형식(`~월/일(요일)`)으로 표시한다.
3. WHEN 둘 이상의 Private_Company_Posting을 표시할 때, THE Dashboard SHALL 제출 마감 기한이 빠른 순서(오름차순)로 공고를 정렬하여 표시한다.
4. IF 표시할 Private_Company_Posting이 하나도 없으면, THEN THE Dashboard SHALL 표시할 공고가 없음을 알리는 안내 문구를 표시하고 공고 목록 영역을 빈 상태로 유지한다.
5. IF 특정 Private_Company_Posting의 기업명, 직무명 또는 제출 마감 기한 값이 누락되었으면, THEN THE Dashboard SHALL 해당 항목 위치에 값이 없음을 나타내는 대체 표시를 노출하고 나머지 필드는 정상적으로 표시한다.

### Requirement 4: 링크 및 스크린샷 자동 분석

**User Story:** 취업 준비생으로서, 공고 링크나 스크린샷을 붙여넣어 자동으로 공고 정보가 추출되기를 원한다, 그래야 수동 입력 없이 공고를 등록할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 웹 또는 카페 링크를 입력하고 분석을 요청하면, THE Analysis_Engine SHALL 60초 이내에 해당 소스로부터 구조화된 Job_Posting 정보를 추출한다.
2. WHEN 사용자가 지원 형식(JPEG, PNG)이며 크기가 10MB 이하인 스크린샷 이미지를 제출하고 분석을 요청하면, THE Analysis_Engine SHALL 60초 이내에 비전 지원 LLM 또는 OCR을 사용하여 구조화된 Job_Posting 정보를 추출한다.
2-1. WHEN 사용자가 클립보드에 복사된 지원 형식의 스크린샷 이미지를 한 번 이상 붙여넣으면, THE System SHALL 사용자가 이미지 파일을 별도로 저장하지 않아도 최대 10장·전체 30MB까지 하나의 분석 입력으로 순서대로 첨부한다.
3. WHERE 소스에 복수의 직무가 포함된 경우, THE Analysis_Engine SHALL 발견된 각 직무를 개별 Job_Posting 항목으로 최대 50개까지 추출한다.
4. WHERE Role_Filter가 설정된 경우, THE Analysis_Engine SHALL Role_Filter에 일치하는 직무만 추출한다.
5. WHERE Role_Filter가 설정되지 않은 경우, THE Analysis_Engine SHALL 소스에서 발견된 모든 직무를 추출한다.
6. IF Analysis_Engine이 소스에서 공고 정보를 추출하지 못하면, THEN THE System SHALL 추출 실패를 알리는 오류 메시지를 사용자에게 표시하고 사용자가 입력한 원본 소스를 보존한다.
7. IF 입력된 링크에 접근할 수 없거나 유효하지 않으면, THEN THE System SHALL 소스 접근 실패를 알리는 오류 메시지를 사용자에게 표시한다.
8. IF 제출된 이미지가 지원 형식(JPEG, PNG)이 아니거나 크기가 10MB를 초과하면, THEN THE System SHALL 이미지가 처리 조건을 충족하지 않음을 알리는 오류 메시지를 사용자에게 표시하고 분석을 수행하지 않는다.
9. WHEN 링크 분석이 성공하면, THE Analysis_Engine SHALL 모집인원과 핵심 상세 내용을 추출하고 실제 접근한 최종 원본 URL을 Job_Posting draft에 보존한다.
9-1. IF 링크의 HTML에서 실질적인 채용 공고 텍스트를 찾지 못하면, THEN THE Analysis_Engine SHALL 페이지의 지원 이미지 또는 지원되는 클라이언트 렌더링 공고 이미지를 수집하여 비전 분석을 시도한다.
10. THE Analysis_Engine SHALL 파악 가능한 상세 내용만 표준 용어의 섹션별 개조식 문장으로 구성하고, 분류되지 않는 유용한 정보는 기타로 보존한다. 같은 의미의 섹션 제목은 하나의 표준 용어로 통일한다.
11. THE Analysis_Engine SHALL 전형순서를 단계별 한 줄로 구성하고 날짜를 `M/D(요일)` 형식으로, 일정과 장소 사이를 `|`로 구분하며 실제 장소를 `📍지명`, 온라인·화상 전형을 `💻비대면`으로 표시한다. 온라인 이의제기·채용 검증·합격 발표·서류 등록 등 행정 절차는 제외한다.

### Requirement 5: 검토·편집 후 저장

**User Story:** 취업 준비생으로서, 자동 분석된 결과를 저장 전에 검토하고 수정하고 싶다, 그래야 잘못 추출된 정보를 바로잡을 수 있다.

#### Acceptance Criteria

1. WHEN Analysis_Engine이 추출을 완료하면, THE Review_Screen SHALL 추출된 Job_Posting 정보를 편집 가능한 형태로 표시한다.
2. WHEN 사용자가 Review_Screen에서 필드 값을 수정하면, THE System SHALL 수정된 값을 저장 대상 데이터에 반영한다.
3. IF 사용자가 필수 필드(기업명, 직무명, 마감 기한)를 비운 채로 저장을 시도하면, THEN THE System SHALL 저장을 거부하고 누락된 필드를 알리는 오류 메시지를 표시한다.
4. WHEN 사용자가 Review_Screen에서 저장을 확정하면, THE System SHALL 검토된 Job_Posting을 데이터베이스에 저장하고 저장 성공을 사용자에게 알린다.
5. IF 데이터베이스 저장에 실패하면, THEN THE System SHALL 저장 실패를 알리는 오류 메시지를 표시하고 검토 중이던 데이터를 유지한다.
5-1. WHERE 저장 실패가 데이터베이스 연결·스키마·클라이언트 문제로 식별되면, THE System SHALL 안전한 원인별 해결 안내와 로그 추적용 오류 ID를 표시한다.
6. WHEN 사용자가 Review_Screen에서 저장을 취소하면, THE System SHALL 추출된 데이터를 저장하지 않고 폐기한다.
7. THE Review_Screen SHALL 모집인원·상세 내용·원본 URL을 편집 가능한 필드로 표시하고 저장 대상 데이터에 포함한다.

### Requirement 6: 자격 프로필 관리

**User Story:** 취업 준비생으로서, 나의 어학·한국사·자격증 점수를 저장하고 싶다, 그래야 공고와 비교하여 적합도를 확인할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 TOEIC(0~990), OPIc(IL·IM1·IM2·IM3·IH·AL), TOEIC Speaking(IL·IM·IH·AL·AM·AH), 한국사(3·2·1급), 컴퓨터활용능력(2·1급), 기타 자격증을 입력하고 저장하면, THE System SHALL 시험 종류와 점수 또는 등급을 단일 Credential_Profile에 저장하고 저장 완료 여부를 표시한다.
2. IF 사용자가 시험별 허용 범위나 등급 또는 자격증 형식(항목당 최대 100자, 최대 50개)을 벗어난 값을 입력하면, THEN THE System SHALL 해당 값을 저장하지 않고 유효하지 않은 필드를 표시하며 기존 저장 값을 유지한다.
3. WHEN 사용자가 Credential_Profile의 값을 수정하고 저장하면, THE System SHALL 수정된 값을 3초 이내에 Credential_Profile에 반영하고 반영 완료 여부를 사용자에게 표시한다.
4. WHEN 사용자가 Credential_Profile 조회를 요청하면, THE System SHALL 저장된 시험별 어학 점수·등급, 한국사·컴퓨터활용능력 등급, 자격증 항목을 3초 이내에 표시한다.
5. IF 사용자가 저장된 값이 없는 상태에서 Credential_Profile 조회를 요청하면, THEN THE System SHALL 저장된 자격 정보가 없음을 나타내는 안내를 표시한다.

### Requirement 7: 적합도 및 합격 가능성 계산

**User Story:** 취업 준비생으로서, 저장한 스펙과 각 공고의 커트라인을 비교한 적합도를 보고 싶다, 그래야 지원 우선순위를 정할 수 있다.

#### Acceptance Criteria

1. WHEN 저장된 Credential_Profile이 존재하고 사용자가 특정 Job_Posting의 적합도를 요청하면, THE System SHALL Credential_Profile의 각 점수를 해당 Job_Posting의 필수 Cutoff_Score와 비교하여 5초 이내에 Fit_Result를 산출한다.
2. WHEN Fit_Result가 산출되면, THE System SHALL 어학은 동일 시험의 독립된 등급 순서로 비교하고 환산표의 대체 기준 중 하나 이상을 만족하면 "충족"으로, 한국사·컴퓨터활용능력은 더 높은 등급(작은 급수)을 만족하면 "충족"으로 판정한다.
3. WHEN Fit_Result가 산출되면, THE System SHALL 합격 가능성 지표를 충족한 필수 Criterion 수 대비 전체 필수 Criterion 수의 비율(0%~100%)로 계산하여 표시한다.
4. IF 사용자가 요청한 Job_Posting의 필수 Criterion 중 하나 이상에 대응하는 점수가 Credential_Profile에 없으면, THEN THE System SHALL 해당 Criterion을 "미충족"으로 판정하고 누락된 항목을 안내하는 메시지를 표시한다.
5. IF Credential_Profile이 저장되어 있지 않은 상태에서 사용자가 적합도를 요청하면, THEN THE System SHALL 자격 프로필 입력이 필요함을 안내하는 메시지를 표시한다.
6. IF 요청한 Job_Posting에 필수 Cutoff_Score가 정의되어 있지 않으면, THEN THE System SHALL 커트라인 정보가 없어 적합도를 산출할 수 없음을 안내하는 메시지를 표시한다.
