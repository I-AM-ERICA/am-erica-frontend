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

## GitHub Pages 배포

배포 주소: https://i-am-erica.github.io/am-erica-frontend/

GitHub 저장소의 **Settings → Pages → Source → GitHub Actions**를 선택합니다.
`main`에 push하면 `.github/workflows/deploy-pages.yml`이 Node.js 22에서 의존성 설치,
테스트, 빌드, Pages 배포를 순서대로 실행합니다. Actions 화면에서 수동 실행도 가능합니다.
`npm run build`만 실행하면 로컬 `dist/`가 만들어지며 인터넷에 게시되지는 않습니다.

워크플로는 Pages 경로에 맞춰 Vite의 `base`를 설정합니다. 같은 경로로 로컬 빌드하려면:

```bash
npm run build -- --base=/am-erica-frontend/
```

**Settings → Secrets and variables → Actions → Variables**에 다음 공개 설정을 등록하고
워크플로를 다시 실행합니다. 값은 빌드 시 번들에 포함되므로 비밀키를 넣지 않습니다.

| 변수 | 값 |
|---|---|
| `VITE_API_BASE_URL` | 네이버 백엔드의 HTTPS 원점. 예: `https://api.example.com` (`/api` 제외) |
| `VITE_NAVER_CLIENT_ID` | 네이버 로그인 공개 Client ID |
| `VITE_NAVER_REDIRECT_URI` | `https://i-am-erica.github.io/am-erica-frontend/` (생략하면 배포 앱 루트 사용) |
| `VITE_STAFF_IMAGE_BASE_URL` | 선택. 공개 스태프 이미지 폴더 URL |

백엔드 연결 전에는 소개·로그인 화면을 먼저 배포할 수 있지만 실제 로그인과 AI 기능은 사용할 수 없습니다.
로컬 `.env`는 GitHub에 업로드하지 않으며 GitHub 빌드에 자동 반영되지 않습니다.
백엔드 배포 후 CORS에 `https://i-am-erica.github.io`를 허용하고,
네이버 개발자센터 및 백엔드의 로그인 콜백도 위 주소와 일치시켜야 합니다.
Pages는 `/api` 프록시를 제공하지 않습니다. 생성 이미지 URL 역시 브라우저가 접근 가능한 HTTPS여야 합니다.
Pages에서는 기존 `/api/auth/callback/naver` 대신 앱 루트로 콜백을 받아 404를 방지합니다.
로컬 개발의 Vite 프록시와 기존 로컬 로그인 콜백은 유지합니다.

공식 안내: https://vite.dev/guide/static-deploy.html#github-pages

## 구성

```text
src/
  App.tsx                  화면 전환, 검색, 계정 설정 복원
  main.tsx                 React 진입점, 나눔고딕 로드
  components/
    Header.tsx, Footer.tsx, Layout.tsx, Modal.tsx
  pages/
    LandingPage.tsx         서비스 소개
    Login.tsx               네이버 로그인
    BusinessSetupPage.tsx   업종 선택
    Dashboard.tsx, AssistantPage.tsx, HistoryPage.tsx, SettingsPage.tsx
    styles/                 모든 앱 CSS (공통·컴포넌트·페이지 스타일)
  services/assistant.ts    Spring Boot 요청, 체험 템플릿, CSV 계산
  services/navigation.ts   로그인·업종 선택·비서 화면 경로 처리
  services/auth.ts         네이버 인증 시작·콜백·세션·로그아웃
  data.ts, types.ts
```

나눔고딕은 npm 패키지에서 로컬로 번들링하므로 Google Fonts 접속이 필요하지 않습니다. 모바일에서는 단일 열의 비서 선택 카드와 작업 화면을 사용합니다. URL 해시로 화면을 구분하며 새로고침과 브라우저 뒤로 가기를 지원합니다.

## 이용 흐름

1. 기본 주소 또는 `#intro`: 서비스 소개를 확인하고 시작하기를 누릅니다.
2. `#login`: 로그인하지 않았다면 네이버 로그인을 먼저 진행합니다. 우측 상단 로그인 버튼으로도 진입할 수 있습니다.
3. `#setup`: 여덟 가지 업종 중 하나를 선택합니다. 가게 이름은 선택 입력입니다. 업종을 고르기 전에는 계속 진행할 수 없습니다.
4. `#dashboard`: 정책·홍보·고객 답장·매출 분석 중 필요한 일을 선택합니다.

로그인 후 계정의 매장과 비서 선택을 백엔드에서 불러옵니다. 저장된 매장이 없는 계정만 업종 선택 화면을 표시합니다. 작업 이력은 `gage-activities:{userId}` 키로 계정별로 현재 브라우저에 보관됩니다. 기존 비로그인 체험 데이터는 특정 계정으로 자동 이전하지 않습니다. 다시 방문하면 소개 화면의 '내 가게로 가기'로 바로 진입할 수 있고, 비서 화면 상단의 '업종 변경'으로 다시 선택할 수 있습니다. 차트·할 일·홍보 배너는 비서 홈에서 제외했으며 실제 생성한 최근 작업만 최대 두 개 표시합니다.

## 현재 제공 기능

- 정책: 대화형 질문·답변, 실시간 스트리밍, 최근 대화 문맥 전달, 출처 링크. 백엔드의 Search-R1 gRPC 연결 경로를 사용하며 실제 모델 서버는 별도 실행이 필요합니다.
- 홍보: 카드뉴스 문안, 숏폼 기획, 인스타그램 게시글의 체험 템플릿. 이미지·영상 파일 생성은 백엔드 구현 대상입니다.
- 고객응대: 고객 리뷰 입력과 리뷰 답글 초안 작성·수정·복사·저장. 리뷰 사이트에 자동으로 게시되지는 않습니다.
- 경영: CSV 직접 입력·파일 불러오기, 매출 합계·평균·날짜별 최고 매출·시간대별 최고 매출 계산. 식재료 가격 조회, 원가 계산, AI 전략은 백엔드 구현 대상입니다.
- 공통: 서비스 소개·업종 선택, 결과 수정·복사·텍스트 다운로드, 작업 이력 필터·검색, 가게 정보 저장.

소개 페이지의 비서 화면 미리보기는 서비스 설명을 위한 예시입니다. CSV 계산은 실제 입력 데이터를 사용합니다. 체험 모드에서 CSV는 서버로 전송하지 않습니다. 가게 정보와 비서 선택은 백엔드 DB에 저장하고, 작업 이력(최대 50개)은 현재 브라우저 localStorage에 저장합니다. 결과 편집은 복사·다운로드에 반영되며 이력에는 최초 생성본이 보관됩니다. 작업 이력의 서버 저장 및 다른 기기 간 동기화는 구현하지 않았습니다.

CSV 예시(UTF-8, 최대 1MB):

```csv
날짜,시간,매출
2026-11-01,10,85000
2026-11-01,12,210000
2026-11-02,12,245000
```

필수 열은 `매출`/`매출액`/`amount`/`sales`, 선택 열은 `날짜`/`date`/`일시`/`datetime` 및 `시간`/`hour`입니다. 시간은 0~23 또는 HH:mm 형식입니다. 따옴표로 감싼 천 단위 쉼표, CRLF, UTF-8 BOM을 처리합니다. 음수 매출은 환불로 합계에 포함합니다. 건당 평균은 입력 행 수, 일평균은 데이터가 존재하는 날짜 수를 기준으로 계산합니다.

## Spring Boot 연결

Vite는 `/api` 요청을 `http://127.0.0.1:8000`의 인접 `am-erica-backend`로 전달합니다.
로그인 토큰과 계정에 저장된 가게 ID를 사용합니다. Python AI는 Spring Boot 뒤의 내부 서비스입니다.
비서별 API 연결은 `src/services/`의 전용 서비스를 참고하세요.

### 고객응대 · Scrable

`http://localhost:7001/#customer`에서 리뷰를 입력하고 **리뷰 답글 만들기**를 누릅니다.
`VITE_API_MODE=demo`여도 고객응대는 실제 백엔드를 호출하므로 모드 변경이 필요 없습니다.
`src/services/customer.ts`가 다음 요청을 보내며, 가게 소유권은 백엔드가 확인합니다.

```http
POST /api/stores/{storeId}/ai/customer/reply
Authorization: Bearer <access_token>
Content-Type: application/json

{"reviewText":"음료가 늦게 나왔어요.","tone":"정중하고 따뜻하게"}
```

백엔드가 Scrable의 gRPC `CustomerAssistant.DraftReply`를 호출하고 반환한 `reply`를
오른쪽 초안 칸에 표시합니다. 리뷰는 최대 2,000자, 프론트의 대기는 최대 330초입니다.
현재 Mac에서는 생성에 수십 초~2분 정도 걸리며, 오류가 나면 예시 문안으로 대체하지 않습니다.
결과는 수정·복사·다운로드할 수 있고 최초 생성본을 이용 내역에 보관합니다. 자동 게시하지 않습니다.
현재 화면은 별점 입력을 받지 않으므로 별점 기반 `sentiment`는 표시하지 않습니다.

Scrable을 먼저 `bash scripts/run_local.sh start`로 켜 두세요. 백엔드의 고객응대 연결은
`AI_CUSTOMER_HOST`, `AI_CUSTOMER_PORT`, `AI_CUSTOMER_MOCK_ENABLED`, `AI_CUSTOMER_DEADLINE`,
`AI_CUSTOMER_KEY_FILE`로 설정합니다. 로컬 상세 설정은 백엔드 README와 Scrable의
`RUN_SERVE.md`를 참고하세요. 내부 키와 모델 인증 토큰은 프론트에 전달하지 않습니다.

배포 시에도 `/api`를 Spring Boot로 전달하는 리버스 프록시가 필요하며,
고객응대 경로의 프록시 대기 시간은 모델 생성 시간을 고려해야 합니다.

## 네이버 로그인 설정 및 백엔드 연동

프론트엔드 로그인 흐름과 인접 `am-erica-backend`의 `POST /api/auth/naver`가 구현되어 있습니다. **실제 이용에는 프론트엔드 `.env`의 Client ID와 백엔드 `.env`의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI` 설정 및 서버 실행이 필요합니다.** 백엔드는 실행 디렉터리의 `.env`를 자동으로 읽습니다.

1. [네이버 개발자 센터](https://developers.naver.com/apps/#/register)에서 네이버 로그인 애플리케이션을 등록합니다.
2. 개발 서비스 URL을 `http://localhost:7001`, Callback URL을 `http://localhost:7001/api/auth/callback/naver`로 등록합니다. 배포할 때는 해당 HTTPS 주소로 등록하고 환경 변수도 변경합니다. Callback URL에는 `#login`을 붙이지 않습니다.
3. `.env.example`을 참고해 `.env.local`에 `VITE_NAVER_CLIENT_ID`, `VITE_NAVER_REDIRECT_URI`를 설정하고 개발 서버를 재시작합니다. 이 값들은 빌드 시 반영됩니다.
4. Client Secret은 Spring Boot의 서버 환경 변수로만 설정합니다. `VITE_` 환경 변수에는 넣지 마세요.

프론트엔드는 네이버 인증 요청에 난수 `state`를 붙이고 sessionStorage에 10분 동안 보관합니다. 콜백에서 `state`와 유효시간을 확인하고 일회성으로 소비합니다. 인증 코드·오류 쿼리는 즉시 주소에서 제거합니다. 중복 React effect에서도 코드를 한 번만 교환합니다.

개발 서버는 `GET /api/auth/callback/naver`만 프록시에서 제외하여 프론트엔드를 표시합니다. 프론트엔드는 콜백의 `code`와 `state`를 검증하고 주소를 `/#login`으로 정리한 뒤, `POST /api/auth/naver`로 코드 교환을 요청합니다. 나머지 `/api` 요청은 기존처럼 백엔드로 전달합니다. `vite preview`에도 같은 규칙이 적용됩니다. 운영 리버스 프록시에도 이 콜백 경로만 프론트엔드 `index.html`로 전달하는 예외가 필요합니다.

### 백엔드 API

`POST /api/auth/naver` 요청:

```json
{
  "code": "네이버가 반환한 인증 코드",
  "state": "인증 요청 시 생성한 state",
  "redirectUri": "http://localhost:7001/api/auth/callback/naver"
}
```

백엔드는 등록한 redirect URI만 허용하고, 서버에 보관한 Client ID/Secret으로 네이버 토큰 API에서 코드를 교환한 뒤 프로필 API로 사용자를 확인합니다. 네이버 프로필 `id`로 계정을 식별하고 이 서비스의 JWT를 발급합니다. 이메일 제공에 동의하지 않아도 로그인할 수 있으며 사용자 조회 응답의 이메일은 빈 문자열이 됩니다. 네이버 이메일과 일반 로그인 이메일이 같다는 이유만으로 기존 계정에 자동 연결하지 마세요. 사용자 입력을 그대로 신뢰하거나 네이버 access token을 서비스 JWT로 반환하지 않습니다.

기존 `AuthDtos.TokenResponse`와 같은 응답:

```json
{ "accessToken": "서비스 JWT", "tokenType": "Bearer", "expiresIn": 3600 }
```

이후 프론트엔드는 기존 `GET /api/users/me`를 Bearer 토큰으로 호출해 `{ "id": 1, "email": "owner@example.com", "name": "사장님" }` 형식을 확인한 후에만 로그인 상태로 전환합니다. 이 API는 네이버에서 확보한 사용자 정보 및 서비스 가입 정책에 맞춰 위 필드를 반환해야 합니다. 네이버 오류·동의 취소·교환 실패는 로그인으로 처리하지 않습니다. 운영 백엔드는 모든 보호 API에서 JWT를 검증해야 하며 프론트엔드 화면 제한만으로 접근을 허용하면 안 됩니다.

서비스 토큰은 현재 탭의 sessionStorage에 보관하며 새로고침 시 `/api/users/me`로 재검증합니다. 만료 또는 API의 401 응답이면 로그아웃됩니다. 소개 화면 우측의 로그아웃은 이 탭의 서비스 세션을 삭제하며 네이버 계정 자체에서 로그아웃하거나 연결을 해제하지 않습니다. 현재 갱신 토큰은 지원하지 않습니다. `VITE_API_MODE=demo`여도 로그인은 실제 인증을 요구합니다.

공식 문서: [네이버 로그인 개발 가이드](https://developers.naver.com/docs/login/devguide), [회원 프로필 API](https://developers.naver.com/docs/login/profile/profile.md).


## 스태프 이미지 및 성별 선택

비서 이미지는 Supabase의 공개 `frontend-image/staff` 폴더에서 직접 불러옵니다. 제공된 공개 주소를 기본값으로 사용하므로 추가 환경설정이나 Supabase API 키는 필요하지 않습니다. 이미지 경로를 바꾸려면 `.env`에 `VITE_STAFF_IMAGE_BASE_URL`을 지정하고 개발 서버를 재시작하세요. 기준 주소는 `staff` 폴더까지이며, `.env.example`에 예시가 있습니다.

| 비서 | 파일 이름 | 기본 선택 |
| --- | --- | --- |
| 정책 | `policy_boy.jpeg` / `policy_girl.jpeg` | 남성 |
| 홍보 | `advertise_boy.jpeg` / `advertise_girl.jpeg` | 여성 |
| 고객응대 | `customer_boy.jpeg` / `customer_girl.jpeg` | 여성 |
| 경영 | `economic_boy.jpeg` / `economic_girl.jpeg` | 남성 |

남성 파일은 `boys/`, 여성 파일은 `girls/`에서 불러옵니다. 비서 선택 화면의 각 카드에서 남성·여성을 개별 선택할 수 있습니다. 선택은 계정별로 백엔드 DB에 저장되어 다음 로그인과 다른 브라우저에서도 복원되며, 소개·비서 작업·이용 내역·검색·도움말의 이미지에도 반영됩니다. 이미지를 불러오지 못하면 기존 비서 아이콘을 표시합니다.


## 정책 비서 채팅

정책 비서 카드를 누르면 대화 화면이 열립니다. 질문(최대 1,000자)을 입력하고 Enter 또는 전송 버튼으로 보내며 Shift+Enter는 줄바꿈입니다. 한글 조합 중 Enter는 전송하지 않습니다. 답변은 SSE로 순차 표시되고, 중지·실패 시 재시도·복사·출처 열기·새 대화를 지원합니다.

계정 설정의 매장 ID를 사용해 대화방을 생성하고 `/api/me/policy/conversations` API로 저장·조회합니다. 질문은 `{ question, clientMessageId }`만 전송하고 백엔드가 저장된 정상 질의응답 중 최근 네 번(8개 메시지, 각 최대 2,000자)을 모델 문맥으로 구성합니다. 중지·실패한 답변은 모델 문맥에서 제외합니다.

계정별로 최근 대화방 **5개**를 DB에 보관하며, 각 방의 질문·답변·출처·처리 상태를 모두 불러옵니다. 입장 시 가장 최근 대화를 열고 상단 ‘최근 대화’에서 다른 방을 선택할 수 있습니다. 새 대화의 첫 질문 또는 수동 메일 검색 때 방을 생성하며, 여섯 번째 방을 만들면 마지막 활동이 가장 오래된 방과 그 메시지를 삭제합니다. 새로고침·재로그인·다른 기기에서도 같은 계정의 대화를 복원합니다. 기존 브라우저 저장 대화는 자동 이전하지 않습니다.

질문은 모델 호출 전에, 답변은 SSE 완료 전에 서버에서 저장합니다. 조회 실패를 빈 대화로 처리하지 않으며 다시 불러오기 버튼을 제공합니다. 처리 중인 대화로 돌아오면 완료 상태를 자동 확인합니다. 수동 이메일 검색 결과도 현재 방에 저장합니다. 완료된 개별 답변을 기록하는 일반 ‘이용 내역’은 기존 브라우저 저장 방식을 유지합니다.

백엔드에 `chat_conversations`, `chat_messages` 테이블이 이미 있으면 추가 환경변수나 SQL 실행은 필요 없습니다. 새 DB에서는 백엔드 README의 스키마 안내를 따르세요. 백엔드 변경 후 서버를 재시작해야 새 API를 사용할 수 있습니다.

정책 채팅에는 별도 프론트엔드 환경변수가 필요하지 않습니다. **`VITE_API_MODE=demo`여도 정책 채팅은 백엔드를 호출합니다.** 연결 실패 시 예시 응답으로 대체하지 않습니다. 프론트엔드 전체 요청 제한시간은 120초입니다.

백엔드 local 프로필은 기본적으로 `[MOCK]` 예시 응답을 보내며 화면에도 `예시 응답`으로 표시합니다. 실제 정책 비서는 백엔드의 `local,policy-mvp,supabase` 프로필과 SSH 터널로 연결합니다. `am-erica-backend/scripts/run-policy-mvp.sh` 및 백엔드 README의 실서버 연결 안내를 사용하세요. 기존 프론트의 `/api` 프록시와 인증·매장·SSE 로직을 재사용하므로 내부 키나 검색 API 키를 프론트에 넣지 않습니다. 검색 이용 한도 초과는 별도 안내로 표시합니다.

`node scripts/live-policy-smoke.mjs`는 실행 중인 로컬 프론트(7001), 백엔드(8000), Python gRPC 서버를 대상으로 실제 서비스 함수를 호출합니다. 테스트 계정을 생성하므로 로컬 개발 환경에서만 실행하세요. 네이버 OAuth 대신 테스트 회원가입 JWT로 인증 흐름을 검증하며 답변·출처 수신, 다른 계정의 매장 접근 거부, topK 검증을 확인합니다. 이메일은 보내지 않습니다. 검색 API 호출이 포함되며 현재 한도 소진 상태에서는 새 질문을 평가할 수 없습니다.


## 홍보 비서 카드뉴스 UI

홍보 비서 화면은 **참고 이미지 한 장 + 홍보 주제 + 카드뉴스 글귀** 입력과 결과 이미지 확인으로 구성됩니다. JPG·PNG·WEBP를 최대 5MB까지 선택하거나 끌어다 놓을 수 있고, 로컬 미리보기·이미지 변경/제거·글귀 500자 제한·분위기 선택을 제공합니다. 선택한 참고 이미지는 브라우저 메모리에서만 처리하고 서버나 localStorage로 저장하지 않습니다.

사용자 요청에 따라 PosterLlama 서버 주소·API 규격이 정해질 때까지 **실제 생성 호출과 백엔드 변경은 보류**했습니다. 현재 생성 버튼은 비활성화되어 있고 연결 준비 상태를 표시합니다. 새로운 환경변수 설정은 필요하지 않습니다.

연결 시 `MarketingPage`의 선택 prop `onGenerate: MarketingGenerator`에 모델 호출 함수를 전달합니다. 입력은 `MarketingRequest`(참고 이미지의 base64/MIME 타입, 주제, 글귀, 분위기, 채널)이며 출력은 `MarketingResult`(headline, body, hashtags, imageUrl)입니다. 이 타입은 프론트엔드 연결 지점이며 확정된 모델 API 계약은 아닙니다. 기존 백엔드 `/promotion/poster`에는 참고 이미지 필드가 없으므로 현재 UI 입력을 그대로 보내서는 안 됩니다.

결과 화면에는 이미지 미리보기·원본 열기·이미지 저장·홍보 문구 복사·생성 중/취소/오류/이미지 미반환 상태를 준비했습니다. 이미지가 있는 결과만 이용 내역에 저장하며, 내역을 열면 이미지도 다시 볼 수 있습니다. 외부 이미지 다운로드 시 로그인 토큰이나 쿠키를 전달하지 않습니다. 다운로드 CORS가 허용되지 않으면 원본 보기로 저장할 수 있습니다. 실제 PosterLlama 출력과 API 연동은 검증하지 않았습니다.

### 정책 비서 이메일 알림

정책 채팅 상단의 `오전 6시 이메일 알림` 스위치는 로그인 계정의 설정을 백엔드에 저장합니다.
접수 기간이 남은 정책은 이전에 받은 정책이어도 매일 다시 보내며, 진행 중인 정책이 없는 날에도 확인 메일을 보냅니다.
알림은 한국 시간 오전 6시에 백엔드가 발송합니다. 수신 주소는 계정 이메일이며 설정 저장 자체로 즉시 메일을 보내지는 않습니다.
별도의 프론트 환경변수는 필요 없습니다. SMTP 비밀번호는 백엔드 `.env`에만 넣으세요.
백엔드 `.env.example` 및 README의 `오전 6시 정책 이메일 리마인드` 절에 Gmail SMTP 설정과 DB 마이그레이션 방법이 있습니다.
수동 버튼과 오전 6시 자동 알림은 학습된 정책 모델을 새로 호출해 최신 검색 결과와 출처를 이메일로 보냅니다. DB에 등록된 접수 기간 내 정책도 함께 안내합니다. 모델 답변을 정책 DB의 공고로 자동 등록하지는 않습니다. 예시 응답·빈 응답·출처 없는 응답·검색 한도 오류는 발송하지 않고 안내하며, 계정별 자동 알림이 OFF여도 수동 발송할 수 있습니다. 오전 6시에 백엔드·모델 서버·SSH 터널이 실행 중이어야 합니다.


### 계정별 매장·비서 선택 저장

매장 설정과 비서 성별 선택은 이제 Spring 백엔드 DB에 저장합니다. 로그인 직후 `/api/me/settings`를 조회하고 저장된 매장이 있으면 초기 설정을 반복하지 않습니다.
매장 저장은 `PUT /api/me/store-profile`, 비서 선택은 `PATCH /api/me/staff-preferences/{assistant}`를 사용합니다.
실패 시 브라우저 저장을 성공으로 처리하지 않으며, 설정 조회 실패는 재시도 화면으로 안내합니다.
정책 채팅/메일 알림은 복원된 매장 ID를 사용하므로 가게 이름을 변경해도 새 매장이 만들어지지 않습니다.
비서 이미지는 기존 Supabase Storage의 공개 URL을 사용하며, DB에는 이미지 파일 대신 비서별 boy/girl 선택만 저장합니다.
기존 localStorage 설정은 DB 값을 덮어쓰지 않습니다. DB에 저장한 적이 없다면 한 번 다시 입력해야 합니다.
이용 내역과 정책 채팅 기록은 이번 변경에 포함되지 않으며 기존 브라우저 저장을 유지합니다.

서버 재시작 후에도 유지하려면 백엔드 `README.md`의 **Supabase에 매장 정보와 비서 선택 계속 저장하기** 안내를 따르세요.
기본 local 프로필의 H2 메모리 DB는 재시작 시 초기화됩니다. `local,supabase` 프로필, DB 연결 정보, 사전 SQL 테이블 생성이 필요합니다.
프론트에 DB 비밀번호나 Supabase 비밀키를 추가하지 않습니다. 공개 이미지 URL 설정도 바꿀 필요 없습니다.
