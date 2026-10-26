# Apps Script 함수 계약

REST 대신 `google.script.run`에서 호출하는 서버 함수 계약을 정의한다.

## 공통 응답

성공:

```json
{ "ok": true, "data": {} }
```

실패:

```json
{
  "ok": false,
  "error": { "code": "VALIDATION_ERROR", "message": "금액을 확인해 주세요." }
}
```

## 함수 목록

### `setupWorkbook()`

최초 1회 실행한다. 전용 스프레드시트와 필요한 시트를 만들고 헤더·기본 카테고리·설정을 초기화한다.

### `getAppConfig()`

화면에 필요한 통화, 시간대, 카테고리 목록, 스프레드시트 링크를 반환한다.

### `getSummary(month)`

- 입력: `YYYY-MM`
- 반환: `{ month, income, expense, balance, transactionCount }`
- 인증: 웹앱 접근 권한 필요

### `listTransactions(month)`

- 입력: `YYYY-MM`
- 반환: 삭제되지 않은 거래 배열
- 정렬: 거래일 내림차순, 생성 시각 내림차순

### `createTransaction(payload)`

```json
{
  "type": "expense",
  "amount": 12000,
  "date": "2026-10-26",
  "category": "식비",
  "memo": "점심"
}
```

서버가 `id`, `created_at`, `updated_at`을 생성하고 한 행을 추가한다.

### `deleteTransaction(id)`

실제 행을 삭제하지 않고 `deleted_at`, `updated_at`을 기록한다.

## 오류 코드

| 코드 | 의미 |
|---|---|
| `VALIDATION_ERROR` | 입력값 형식 또는 범위 오류 |
| `NOT_FOUND` | 거래 또는 시트를 찾지 못함 |
| `LOCK_TIMEOUT` | 동시 저장 잠금 획득 실패 |
| `CONFIGURATION_ERROR` | 스프레드시트 초기화 필요 |
| `INTERNAL_ERROR` | 서버 내부 오류 |

