# 우리가정 가계부

남편과 아내가 함께 기록하는 실시간 가계부입니다. 모바일 빠른 입력, Supabase 공동 데이터, Realtime 갱신, 월별 예산과 반복비를 제공합니다.

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
cp .env.example .env.local
# .env.local에 Supabase URL과 공개 anon key 입력
npm install
npm run dev
```

브라우저에서 `http://localhost:4173/household-budget/`를 엽니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 전체 실행합니다.
3. Authentication → URL Configuration에 다음 주소를 추가합니다.
   - 로컬: `http://localhost:4173/household-budget/`
   - 배포: `https://zangangel.github.io/household-budget/`
4. `.env.local`에 다음 값을 입력합니다.

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

첫 번째 사용자가 가구를 만들고 참여 코드를 배우자에게 공유합니다. 배우자는 이메일 매직링크로 로그인한 뒤 참여 코드를 입력합니다. 딸은 로그인 계정 없이 가족 구성원으로 추가할 수 있습니다.

공식 통계 비교를 사용하려면 `benchmark_snapshots`에 출처와 기준 기간이 포함된 대한민국 3인 가구 데이터를 등록해야 합니다. 출처 없는 숫자는 저장소에 포함하지 않습니다.

## GitHub Pages 배포

저장소의 Settings → Pages에서 `GitHub Actions` 배포를 선택합니다. 다음 Repository Secrets를 추가하면 `main` 브랜치 push마다 자동 배포됩니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Service Role Key는 절대 추가하지 않습니다. 브라우저에는 공개 anon key만 사용하고, 실제 데이터 접근은 Supabase RLS가 제한합니다.

## 주요 기능

- 이메일 매직링크 로그인과 가구 참여 코드
- 금액·수입/지출·부담자·날짜 중심의 빠른 입력
- 배우자 화면으로 거래가 실시간 반영되는 Realtime 구독
- 거래 수정·삭제 및 기존 localStorage 기록의 최초 로그인 시 이전
- 월·분기·반기·연간 요약
- 고정비·변동비, 구성원별 지출, 카테고리별 예산
- 반복비 예정 거래 자동 생성
- 공식 기준 데이터가 등록된 경우 3인 가구 평균 대비 비교

개인 카카오톡 대화방 자동 연동은 포함하지 않습니다. 카카오톡 채널/챗봇을 통한 입력은 별도 웹훅 기능으로 추후 확장할 수 있습니다.
