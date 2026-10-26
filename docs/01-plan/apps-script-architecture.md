# Apps Script 아키텍처

## 결정

개인용 Google Apps Script Web App을 사용한다. Apps Script 프로젝트는 서버 함수와 HTML Service 화면을 제공하고, Google Sheets를 영속 데이터 저장소로 사용한다.

```text
브라우저
  |
  | google.script.run
  v
Apps Script Web App
  |-- Code.gs              진입점, 공통 응답/오류 처리
  |-- Transactions.gs      거래 CRUD와 검증
  |-- Workbook.gs          스프레드시트/시트 초기화
  |-- Index.html           화면 구조
  |-- Client.html          클라이언트 상태와 호출
  |-- Styles.html          스타일
  |
  v
Google Sheets
  |-- Transactions
  |-- Categories
  `-- Settings
```

## 실행 권한

- 웹앱 실행 주체: 소유자 계정
- 접근 대상: 초기에는 소유자 본인만
- 데이터 접근: Apps Script가 소유한 스프레드시트에만 허용
- 외부 API 키: MVP에서는 사용하지 않음

## 저장소 연결

독립형 Apps Script 프로젝트로 만들고, 최초 `setupWorkbook()` 실행 시 전용 스프레드시트를 생성한다. 생성된 Spreadsheet ID는 `PropertiesService.getScriptProperties()`에 저장한다. 코드에는 ID나 비밀값을 하드코딩하지 않는다.

## 신뢰 경계

- 브라우저 입력값은 신뢰하지 않는다.
- 서버에서 금액, 날짜, 카테고리, 메모를 재검증한다.
- 시트 행 삭제 대신 `deleted_at`을 기록해 복구와 감사가 가능하게 한다.
- 동시 저장은 `LockService`로 보호한다.

## 단계별 구현 범위

### 1단계: 개인용 MVP

수입·지출 등록, 월별 조회, 요약, 소프트 삭제, 시트 열기 링크.

### 2단계: 사용성

카테고리 관리, 수정 기능, 월별 분석, CSV 백업/복원.

### 3단계: 공유 검토

가족 계정 공유, 사용자별 권한, `owner_email` 필드, 감사 로그를 별도 설계한 뒤 진행한다.

