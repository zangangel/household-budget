# Household Budget

Google Apps Script와 Google Sheets로 만드는 개인 가계부입니다.

## 현재 방향

기존의 브라우저 `localStorage` MVP에서 Apps Script 웹앱으로 방향을 전환했습니다.

- 화면: Apps Script HTML Service
- 서버 로직: `google.script.run`으로 호출하는 Apps Script 함수
- 데이터 저장: Google Sheets의 `Transactions` 시트
- 접근: Google 계정 인증을 거친 개인용 웹앱
- 배포: Apps Script Web App (`/exec`)

기존 `index.html`과 `src/`는 동작 비교와 화면 재사용을 위한 이전 프로토타입으로 보존합니다. 실제 Apps Script 구현은 다음 단계에서 추가합니다.

## Apps Script MVP

1. 월 선택과 수입·지출 요약
2. 수입·지출 내역 등록
3. 선택한 월의 내역 조회
4. 내역 삭제
5. Google Sheets에서 원장 직접 확인·백업

## 기획 문서

- [데이터 스키마](docs/01-plan/schema.md)
- [용어집](docs/01-plan/glossary.md)
- [ERD](docs/01-plan/erd.md)
- [Apps Script 아키텍처](docs/01-plan/apps-script-architecture.md)
- [코딩 컨벤션](docs/01-plan/convention.md)
- [화면 설계](docs/02-design/mockup.md)
- [Apps Script 함수 계약](docs/02-design/apps-script-api.md)
- [배포 계획](docs/02-design/deployment.md)

## 구현 순서

1. Apps Script 프로젝트와 전용 Google Sheets 생성
2. `Transactions`, `Categories`, `Settings` 시트 초기화
3. 서버 함수와 입력 검증 구현
4. HTML Service 화면을 Apps Script 호출로 연결
5. 개인 전용 Web App으로 배포
6. 테스트 계정으로 입력·조회·삭제와 권한 확인

## 데이터 보호

금융 데이터가 포함되므로 저장소는 비공개로 유지합니다. Apps Script 배포 권한은 초기에는 `나만`으로 제한하고, 다른 사용자 공유가 필요해질 때 별도 권한 설계를 먼저 검토합니다.

