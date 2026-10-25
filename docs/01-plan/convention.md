# 코딩 컨벤션

## 기술 선택

- MVP는 의존성 없는 HTML, CSS, JavaScript로 시작한다.
- 브라우저 표준 API를 우선 사용하고, 프레임워크 도입은 화면과 상태 복잡도가 실제로 증가한 뒤 결정한다.
- 표시 문자열은 한국어, 변수와 파일 이름은 영어로 작성한다.

## 이름 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| 파일 | 소문자 kebab-case 또는 기존 역할명 | `styles.css`, `app.js` |
| 변수/함수 | camelCase | `monthFilter`, `formatCurrency` |
| 상수 | UPPER_SNAKE_CASE | `STORAGE_KEY` |
| 데이터 필드 | camelCase | `createdAt` |
| CSS 클래스 | kebab-case | `summary-card` |

## Git 커밋

```text
<type>(<scope>): <description>
```

허용 타입은 `feat`, `fix`, `docs`, `refactor`, `test`, `chore`이며 설명은 현재형으로 짧게 쓴다.

예: `feat(entry): add local transaction form`

