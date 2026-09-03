# 채용 공고 대시보드

공기업·사기업 채용 공고를 비교하고, 저장한 자격 프로필을 기준으로 공고 적합도를 확인하는 단일 사용자용 MVP입니다.

## 로컬 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 루트 경로는 `/dashboard`로 이동합니다.

## 데이터베이스 준비

`.env.example`을 `.env`로 복사하고 `DATABASE_URL`을 사용할 PostgreSQL 연결 문자열로 변경합니다.

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
```

`db:migrate`는 연결된 PostgreSQL에 마이그레이션을 적용합니다.

링크·이미지 공고 분석에는 `.env`의 `OPENAI_API_KEY`와 `OPENAI_MODEL`을 설정합니다. OpenAI 호환 API를 사용한다면 `OPENAI_BASE_URL`도 변경할 수 있습니다.

## MVP 화면 경로

- `/dashboard`: 채용 공고 대시보드
- `/profile`: TOEIC·OPIc·TOEIC Speaking, 한국사, 컴퓨터활용능력을 포함한 단일 자격 프로필
- `/postings/add`: 링크·이미지 공고 분석
- `/postings/review`: 분석 결과 검토·저장

## 공고 API

- `GET /api/postings`: 전체 공고 최신순 조회
- `GET /api/postings?view=private`: 사기업 공고 마감순 조회
- `POST /api/postings`: 검토 완료 공고 저장
- `GET /api/postings/table?category=개발`: 공기업 평가 기준표 조회
- `GET /api/profile`: 단일 자격 프로필 조회
- `PUT /api/profile`: 자격 프로필 저장·수정
- `GET /api/postings/:id/fit`: 공고 적합도 계산

## 검증

```bash
npm run lint
npm run test
npm run db:validate
npm run build
```
