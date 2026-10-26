# Apps Script 코딩 컨벤션

## 기술 규칙

- Apps Script 런타임에서 동작하는 JavaScript를 사용한다.
- 화면과 서버 코드를 파일로 분리한다: `Index.html`, `Styles.html`, `Client.html`, `Code.gs`, `Transactions.gs`.
- 클라이언트는 `google.script.run`만 사용하고 SpreadsheetApp에 직접 접근하지 않는다.
- 모든 입력 검증은 서버에서 다시 수행한다.
- 서버 함수의 반환값은 `{ ok, data, error }` 구조로 통일한다.

## 이름 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| Apps Script 파일 | 역할 기반 PascalCase 또는 `.gs` | `Code.gs`, `Transactions.gs` |
| HTML 파일 | PascalCase | `Index.html`, `Styles.html` |
| 서버 함수 | camelCase | `createTransaction` |
| 내부 함수 | 끝에 `_`를 붙임 | `getWorkbook_` |
| 상수 | UPPER_SNAKE_CASE | `TRANSACTIONS_SHEET` |
| 시트 열 | snake_case | `created_at`, `deleted_at` |
| CSS 클래스 | kebab-case | `summary-card` |

## 호출 규칙

- `google.script.run.withSuccessHandler(...).withFailureHandler(...).functionName(payload)` 순서를 지킨다.
- 서버 함수는 원시 예외를 화면에 노출하지 않고 표준 오류 객체로 변환한다.
- 쓰기 전용 함수는 `LockService.getScriptLock()`을 획득하고 `finally`에서 해제한다.

## Git 커밋

```text
<type>(<scope>): <description>
```

예: `feat(script): add transaction write service`

