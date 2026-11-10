# 가게비서 · am-erica-frontend

소상공인을 위한 정책, 홍보, 고객응대, 경영 비서의 React + TypeScript 프론트엔드입니다.

## 실행

Node.js 22.12 이상(또는 20.19 이상)이 필요합니다.

```bash
npm install
npm run dev
```

현재 개발 서버는 http://localhost:7001 에서 확인할 수 있습니다. `vite.config.ts`에 지정된 포트를 사용하며, 포트 사용 중이면 다른 포트로 넘어가지 않고 오류를 표시합니다.

macOS에서 `Port 7000 is already in use`가 발생하고 `lsof -nP -iTCP:7000 -sTCP:LISTEN` 결과가 `ControlCenter`라면 AirPlay 수신 기능이 포트를 사용하고 있는지 확인해 주세요. 해당 기능을 끈 다음 다시 실행할 수 있습니다. 이 프로젝트는 시스템 프로세스를 종료하거나 시스템 설정을 자동으로 변경하지 않습니다.

```bash
npm run build
npm test
npm run preview
```

`build`는 TypeScript 검사 후 `dist/`에 배포 파일을 생성합니다. `preview`도 7001번 포트를 사용합니다.

## 구성

```text
src/
  App.tsx                  화면 전환, 검색, 브라우저 저장
  main.tsx                 React 진입점, 나눔고딕 로드
  components/
    Header.tsx, header.css
    Footer.tsx, footer.css
    Layout.tsx, layout.css  간단한 상단 메뉴와 공통 레이아웃
    Modal.tsx, modal.css
  pages/
    LandingPage.tsx, landing.css           서비스 소개
    BusinessSetupPage.tsx, business-setup.css  업종 선택
    Dashboard.tsx, dashboard.css
    AssistantPage.tsx, workspace.css
    HistoryPage.tsx
    SettingsPage.tsx
  services/assistant.ts    FastAPI 요청, 체험 템플릿, CSV 계산
  services/navigation.ts   소개·업종 선택·비서 화면 경로 처리
  styles/global.css       공통 스타일과 디자인 변수
  data.ts, types.ts
```

나눔고딕은 npm 패키지에서 로컬로 번들링하므로 Google Fonts 접속이 필요하지 않습니다. 모바일에서는 단일 열의 비서 선택 카드와 작업 화면을 사용합니다. URL 해시로 화면을 구분하며 새로고침과 브라우저 뒤로 가기를 지원합니다.

## 이용 흐름

1. 기본 주소 또는 `#intro`: 서비스 소개를 확인하고 시작하기를 누릅니다.
2. `#setup`: 여덟 가지 업종 중 하나를 선택합니다. 가게 이름은 선택 입력입니다. 업종을 고르기 전에는 계속 진행할 수 없습니다.
3. `#dashboard`: 정책·홍보·고객 답장·매출 분석 중 필요한 일을 선택합니다.

첫 방문에서 비서 주소로 직접 접속해도 업종 선택 화면을 먼저 표시합니다. 선택 결과는 `gage-profile`과 `gage-onboarded` 키로 현재 브라우저에 보관됩니다. 다시 방문하면 소개 화면의 '내 가게로 가기'로 바로 진입할 수 있고, 비서 화면 상단의 '업종 변경'으로 다시 선택할 수 있습니다. 차트·할 일·홍보 배너는 비서 홈에서 제외했으며 실제 생성한 최근 작업만 최대 두 개 표시합니다.

## 현재 제공 기능

- 정책: 가게 상황 입력, 체험용 정책 탐색 가이드, 공식 사이트 링크. 실제 RAG 검색이나 자격 판정은 백엔드 구현 대상입니다.
- 홍보: 카드뉴스 문안, 숏폼 기획, 인스타그램 게시글의 체험 템플릿. 이미지·영상 파일 생성은 백엔드 구현 대상입니다.
- 고객응대: 리뷰·메일·상담 답변 초안. 자동 발송이나 실시간 챗봇 연결은 백엔드 구현 대상입니다.
- 경영: CSV 직접 입력·파일 불러오기, 매출 합계·평균·날짜별 최고 매출·시간대별 최고 매출 계산. 식재료 가격 조회, 원가 계산, AI 전략은 백엔드 구현 대상입니다.
- 공통: 서비스 소개·업종 선택, 결과 수정·복사·텍스트 다운로드, 작업 이력 필터·검색, 가게 정보 저장.

소개 페이지의 비서 화면 미리보기는 서비스 설명을 위한 예시입니다. CSV 계산은 실제 입력 데이터를 사용합니다. 체험 모드에서 CSV는 서버로 전송하지 않습니다. 가게 정보·업종 선택 여부·작업 이력(최대 50개)은 현재 브라우저 localStorage에 저장됩니다. 결과 편집은 복사·다운로드에 반영되며 이력에는 최초 생성본이 보관됩니다. 계정 간 공유 및 서버 영구 저장은 구현하지 않았습니다.

CSV 예시(UTF-8, 최대 1MB):

```csv
날짜,시간,매출
2026-11-01,10,85000
2026-11-01,12,210000
2026-11-02,12,245000
```

필수 열은 `매출`/`매출액`/`amount`/`sales`, 선택 열은 `날짜`/`date`/`일시`/`datetime` 및 `시간`/`hour`입니다. 시간은 0~23 또는 HH:mm 형식입니다. 따옴표로 감싼 천 단위 쉼표, CRLF, UTF-8 BOM을 처리합니다. 음수 매출은 환불로 합계에 포함합니다. 건당 평균은 입력 행 수, 일평균은 데이터가 존재하는 날짜 수를 기준으로 계산합니다.

## FastAPI 연결

기본은 `demo` 모드입니다. 실제 연결 시 `.env.example`을 `.env.local`로 복사하고 아래 값을 설정한 뒤 개발 서버를 다시 시작하세요.

```dotenv
VITE_API_MODE=live
```

Vite가 `/api` 요청을 `http://127.0.0.1:8000`으로 프록시합니다. FastAPI는 다음 엔드포인트를 구현하면 됩니다.

```text
POST /api/assistants/policy
POST /api/assistants/marketing
POST /api/assistants/customer
POST /api/assistants/sales
```

요청 형식:

```json
{
  "message": "가게 운영자금 지원을 찾고 있어요.",
  "format": "지원 정책 탐색",
  "profile": {
    "name": "오후의 커피",
    "owner": "김가게",
    "category": "카페",
    "region": "서울 마포구"
  }
}
```

응답 형식:

```json
{
  "text": "답변 본문",
  "sources": [{ "title": "근거 문서 제목", "url": "https://example.com/source" }]
}
```

`sources`는 선택 필드이며 http/https 링크만 표시합니다. RAG 비서는 실제 검색 출처를 이 필드에 반환하세요. 매출 비서는 `message`에 CSV 문자열을 전달합니다. 연결 모드에서 오류가 발생하면 사용자에게 오류를 표시하며 체험 결과로 대체하지 않습니다. 요청 제한 시간은 30초입니다. 배포 환경에서는 `/api`를 FastAPI로 전달하는 리버스 프록시를 구성해야 합니다. 로그인·인증·서버 저장·실제 AI 기능은 백엔드 연결 시 별도로 구현해야 합니다.
