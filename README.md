# 우리가정 가계부

남편과 아내가 함께 기록하는 가계부 프로젝트입니다. 현재 `main`에는 Supabase 기반 웹앱 구현이 있고, 다음 구현 방향은 Google Apps Script와 Google Sheets 기반 개인용 웹앱으로 전환하는 것입니다.

## 현재 전환 상태

- 기존 구현: Vite + Supabase + GitHub Pages
- 새 방향: Apps Script HTML Service + `google.script.run` + Google Sheets
- 원칙: 기존 Supabase 구현은 전환 검증 전까지 보존하고, Apps Script 계획을 먼저 확정한 뒤 서비스 계층을 교체

## 현재 구현 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
cp .env.example .env.local
# .env.local에 Supabase URL과 공개 anon key 입력
npm install
npm run dev
```

브라우저에서 `http://localhost:4173/household-budget/`를 엽니다.

## 기존 Supabase 기능

- 이메일 매직링크 로그인과 가구 참여 코드
- 금액·수입/지출·부담자·날짜 중심의 빠른 입력
- 배우자 화면으로 거래가 실시간 반영되는 Realtime 구독
- 거래 수정·삭제 및 기존 localStorage 기록의 최초 로그인 시 이전
- 월·분기·반기·연간 요약
- 고정비·변동비, 구성원별 지출, 카테고리별 예산
- 반복비 예정 거래 자동 생성

## Apps Script 재기획

Apps Script 전환 후에는 다음 구조를 목표로 합니다.

- 화면: Apps Script HTML Service
- 서버 로직: `google.script.run`으로 호출하는 Apps Script 함수
- 데이터 저장: Google Sheets의 `Transactions`, `Categories`, `Settings` 시트
- 접근: 초기에는 Google 계정 소유자 본인만
- 배포: Apps Script Web App (`/exec`)

기존 Supabase 구현은 비교와 단계적 마이그레이션을 위해 보존합니다. 아직 Google Drive에 실제 Apps Script 프로젝트나 스프레드시트는 만들지 않았습니다.

## Apps Script 기획 문서

- [데이터 스키마](docs/01-plan/schema.md)
- [용어집](docs/01-plan/glossary.md)
- [ERD](docs/01-plan/erd.md)
- [Apps Script 아키텍처](docs/01-plan/apps-script-architecture.md)
- [코딩 컨벤션](docs/01-plan/convention.md)
- [화면 설계](docs/02-design/mockup.md)
- [Apps Script 함수 계약](docs/02-design/apps-script-api.md)
- [배포 계획](docs/02-design/deployment.md)

## 다음 구현 순서

1. Apps Script 프로젝트와 전용 Google Sheets 생성
2. `Transactions`, `Categories`, `Settings` 시트 초기화
3. 서버 함수와 입력 검증 구현
4. HTML Service 화면을 Apps Script 호출로 연결
5. Supabase 데이터에서 필요한 범위의 이전 전략 확정
6. 개인 전용 Web App으로 배포하고 입력·조회·삭제·권한 검증

## 배포 및 보안

Supabase 구현은 GitHub Actions로 GitHub Pages에 배포할 수 있습니다. Repository Secrets에는 공개 anon key만 사용하고 Service Role Key는 절대 넣지 않습니다. Apps Script 전환 후에는 저장소를 비공개로 유지하고, 웹앱 접근 권한을 최소화합니다.

개인 카카오톡 대화방 자동 연동은 포함하지 않습니다. 카카오톡 채널/챗봇 입력은 별도 웹훅 기능으로 추후 검토합니다.

