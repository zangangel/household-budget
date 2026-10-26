# 데이터 스키마

## 저장 전략

Apps Script가 관리하는 Google Sheets를 가계부의 단일 원장으로 사용한다. 화면은 시트 데이터를 직접 조작하지 않고 서버 함수만 호출한다.

## 시트 구성

### `Transactions`

| 열 | 타입 | 필수 | 제약 | 설명 |
|---|---|---:|---|---|
| `id` | 문자열 | 예 | 고유 UUID | 내역 식별자 |
| `type` | enum | 예 | `income`, `expense` | 수입 또는 지출 |
| `amount` | 양의 정수 | 예 | `> 0` | 원 단위 금액 |
| `date` | `YYYY-MM-DD` 문자열 | 예 | 유효한 날짜 | 실제 거래일 |
| `category` | 문자열 | 예 | 허용 카테고리 | 분류 |
| `memo` | 문자열 | 아니오 | 최대 80자 | 사용자 메모 |
| `created_at` | ISO 8601 문자열 | 예 | 서버 생성 | 생성 시각 |
| `updated_at` | ISO 8601 문자열 | 예 | 서버 갱신 | 마지막 변경 시각 |
| `deleted_at` | ISO 8601 문자열/null | 예 | 기본 null | 소프트 삭제 시각 |

### `Categories`

| 열 | 타입 | 필수 | 설명 |
|---|---|---:|---|
| `name` | 문자열 | 예 | 화면에 표시할 카테고리명 |
| `type` | enum | 예 | `income`, `expense`, `both` |
| `sort_order` | 정수 | 예 | 표시 순서 |
| `active` | boolean | 예 | 사용 여부 |

### `Settings`

| 키 | 값 | 설명 |
|---|---|---|
| `schema_version` | 문자열 | 원장 구조 버전 |
| `timezone` | 문자열 | 기본 `Asia/Seoul` |
| `currency` | 문자열 | 기본 `KRW` |

## 검증 규칙

1. 금액은 1원 이상의 정수만 허용한다.
2. `type`은 `income` 또는 `expense`만 허용한다.
3. 날짜는 `YYYY-MM-DD` 형식으로 서버에서 재검증한다.
4. 카테고리는 `Categories` 시트에서 활성 상태인 값만 허용한다.
5. 메모는 최대 80자이며 HTML 출력 시 이스케이프한다.
6. 삭제는 행을 지우지 않고 `deleted_at`을 기록한다.
7. 모든 쓰기 작업은 `LockService`로 동시 실행을 직렬화한다.

