# Household Budget

개인 가계부를 위한 local-first 웹 앱입니다. 현재 버전은 브라우저의 `localStorage`에만 데이터를 저장하므로, 별도 서버나 계정 없이 바로 사용할 수 있습니다.

## 현재 MVP

- 수입·지출 내역 등록
- 월별 수입·지출·잔액 요약
- 카테고리와 메모 기록
- 내역 삭제
- 반응형 화면

## 실행

Python 3가 설치되어 있다면:

```bash
npm run dev
```

그 다음 브라우저에서 `http://localhost:4173`을 엽니다. `npm`은 패키지 설치가 아니라 실행 명령을 편하게 제공하기 위해 사용합니다.

## 데이터 보관

현재 데이터는 이 브라우저의 localStorage에만 저장됩니다. 브라우저 데이터 삭제, 시크릿 창 종료, 다른 기기 사용 시 데이터가 공유되지 않습니다. 금융 데이터 보호를 위해 초기 저장소는 비공개로 만들었습니다.

## 다음 단계

1. CSV 내보내기·가져오기
2. 월별/카테고리별 분석
3. 반복 지출과 예산 한도
4. 선택적 로그인 및 동기화

## 프로젝트 문서

- [데이터 스키마](docs/01-plan/schema.md)
- [용어집](docs/01-plan/glossary.md)
- [ERD](docs/01-plan/erd.md)
- [코딩 컨벤션](docs/01-plan/convention.md)
- [화면 설계](docs/02-design/mockup.md)

