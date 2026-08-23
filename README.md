# 에어캐치 (AirCatch)

항공권 특가 알림 앱. 다중 목적지를 등록해두면 서버가 주기적으로 Travelpayouts Data API로 가격을 조회하고, 등록 시점 기준가보다 저렴해지면 푸시 알림을 보낸다.

전체 요구사항은 [`prd.md`](./prd.md), 구현 계획은 `.claude/plans/`를 참고.

## 구조 (pnpm 모노레포)

```
apps/
  mobile/            # Expo(React Native) 앱
  api/                # NestJS 백엔드
packages/
  shared-types/       # FE/BE 공유 DTO (zod)
  config/              # 공통 tsconfig
supabase/
  migrations/          # SQL 마이그레이션
  seed.sql             # airports 초기 시드
```

## 시작하기

```bash
corepack enable
pnpm install
cp .env.example .env   # 값 채워넣기
```

### 백엔드 (NestJS)

```bash
pnpm dev:api            # http://localhost:3000 , GET /health 로 확인
```

### 모바일 앱 (Expo)

Expo는 이 앱(`apps/mobile/`) 루트의 `.env`만 읽는다 — 저장소 루트 `.env`와는 별도다.

```bash
cp apps/mobile/.env.example apps/mobile/.env   # 값 채워넣기 (Supabase URL/anon key, API base URL)
pnpm dev:mobile                                 # Expo Go 또는 시뮬레이터로 QR/키 입력 접속
```

- 인증 화면은 Supabase Auth로 직접 가입/로그인한다. Supabase 프로젝트의 Auth 설정에서 "Confirm email"이 켜져 있으면 가입 후 이메일 확인이 필요하다.
- 푸시 알림 토큰 등록은 EAS `projectId`가 있어야 동작한다(`eas init` 이후 `app.json`의 `extra.eas.projectId`). 아직 EAS 프로젝트를 만들지 않았다면 콘솔에 경고만 찍히고 나머지 기능은 정상 동작한다(`src/hooks/usePushRegistration.ts`).
- 가격 추이 화면의 "목표가 이하 추천 일정"은 별도 API 없이, 이미 불러온 `price_history`를 클라이언트에서 필터링해 만든다.

### Supabase

```bash
pnpm exec supabase start   # 로컬 스택(Docker 필요)
pnpm exec supabase db diff # 마이그레이션과 실제 스키마 차이 확인
```

### Travelpayouts (가격 데이터)

> **Amadeus for Developers의 무료 Self-Service API는 2026-07-17부로 완전히 종료**됐다(셀프서비스 가입 자체가 없어지고 Enterprise 영업 문의로만 연결됨). 대체 데이터 소스로 [Travelpayouts Data API](https://www.travelpayouts.com/programs/100/tools/api)(Aviasales 제휴 네트워크)를 사용한다 — 무료, 진짜 셀프서비스(이메일+비밀번호만으로 즉시 가입, 승인 절차 없음), 초당 10회 요청 허용.

1. https://www.travelpayouts.com 에서 가입(이메일/비밀번호만 필요) 후 [Programs → Tools → API](https://www.travelpayouts.com/programs/100/tools/api)에서 토큰 발급.
2. `.env`의 `TRAVELPAYOUTS_TOKEN`에 채워 넣는다.
3. 키가 없거나 호출이 실패해도 앱은 정상 동작한다 — `/watches` 생성은 성공하고 `baselinePrice`만 `null`로 남는다(`apps/api/src/watches/watches.service.ts`의 `captureBaseline` 참고).
4. 호출량 확인(재시작하면 리셋되는 인메모리 카운터 — Travelpayouts는 Amadeus와 달리 월별 할당량이 없고 초당 10회 제한만 있어서, "한도 임박 경고"가 아니라 단순 호출량 확인용):
   ```bash
   curl http://localhost:3000/internal/travelpayouts/usage-status -H "x-internal-secret: $INTERNAL_CRON_SECRET"
   ```
5. **공항 검색은 더 이상 외부 API로 폴백하지 않는다** — 대신 Travelpayouts의 공개 공항/도시/국가 참조 데이터(토큰 불필요)를 통째로 가져와 `airports` 테이블에 upsert하는 스크립트가 있다. 전 세계 취항 공항을 한 번에 커버하므로(2만+ 행) 최초 1회, 또는 데이터 갱신이 필요할 때 실행:
   ```bash
   cd apps/api
   pnpm import:airports
   ```
   (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`가 루트 `.env`에 있어야 한다.) `seed.sql`의 20개 공항은 이 스크립트를 아직 안 돌린 로컬 개발 환경을 위한 최소 데이터로 남겨뒀다.
6. **알려진 정확도 한계**: Travelpayouts 캘린더는 실제 Aviasales 검색 이력 기반 캐시 데이터라 최대 7일 정도 갱신 지연이 있고(실시간 GDS 조회 아님), 다구간/왕복 가격은 구간별 최저가를 합산한 근사치다(단일 결합 견적 API가 없음) — `apps/api/src/pricing/fare-finder.service.ts` 참고. 그래서 가격 추이 화면에 "실제 결제가와 다를 수 있음" 배너가 항상 붙어 있다.

### 가격 모니터링 크론 / 알림

- `apps/api/src/cron/price-monitor.service.ts`가 두 개의 스케줄을 돌린다: 편도/왕복 watch는 5분마다 실행되며 각 watch를 id 해시 기준 12개 슬롯 중 하나에만 배정해 사실상 시간당 1회 조회(부하 분산), 다구간 watch는 4시간마다 전체를 훑는다(구간마다 별도 호출이 필요해서 저빈도로 운영).
- 기준가 하락 판정: 새 가격이 `baseline_price`보다 낮고, 하락폭이 5,000원 이상이거나 `target_price` 이하이면 알림 발송 + `baseline_price`/`last_notified_price` 갱신. 임계값 미만의 소폭 하락은 `price_history`에는 기록되지만 기준가는 움직이지 않는다(나중에 더 큰 폭으로 떨어졌을 때 원래 기준가 대비로 정확히 비교하기 위함).
- 로컬에서 즉시 확인하려면 cron을 기다리지 않고 바로 트리거할 수 있다:
  ```bash
  curl -X POST http://localhost:3000/internal/cron/run-price-check \
    -H "x-internal-secret: $INTERNAL_CRON_SECRET"
  ```
- 푸시 발송은 `expo-server-sdk` 사용. `EXPO_ACCESS_TOKEN`은 선택값(비워둬도 동작) — Expo 계정에 enhanced security를 켰다면 채워야 한다. 알림 발송 결과는 항상 `notification_logs`에 기록된다(성공/실패 모두).

## 배포

### 백엔드 — Docker

`apps/api/Dockerfile`은 pnpm 공식 모노레포 배포 패턴(`pnpm deploy`)을 따른다. **빌드 컨텍스트는 저장소 루트**여야 한다(워크스페이스 전체가 있어야 lockfile을 풀 수 있음):

```bash
docker build -f apps/api/Dockerfile -t aircatch-api .
docker run -p 3000:3000 --env-file .env aircatch-api
```

Dockerfile 하나로 Railway/Render/Fly.io 등 Dockerfile 기반 배포를 지원하는 아무 플랫폼에나 올릴 수 있다 — 각 플랫폼에서 "Dockerfile 경로"를 `apps/api/Dockerfile`, "루트 디렉터리"를 저장소 루트로 지정하고, `.env.example`의 값들을 환경변수로 등록하면 된다. 이 환경에는 Docker 데몬이 없어서 **실제로 빌드해보지는 못했다** — 배포 전에 로컬에서 한 번 빌드해보길 권한다.

### 모바일 — EAS Build

```bash
npx eas login          # Expo 계정 로그인
cd apps/mobile
eas init                # app.json에 extra.eas.projectId 기록 (푸시 알림에도 필요)
eas build --platform ios --profile preview      # 또는 android
eas submit --platform ios                        # 스토어 제출
```

`eas.json`에 development/preview/production 프로필을 기본으로 넣어뒀다. `eas init` 전에는 `projectId`가 없어서 푸시 토큰 등록이 조용히 스킵된다(README 상단 "모바일 앱" 절 참고) — EAS 계정이 없어 이 저장소에서 직접 실행해보지는 못했다.

## 기술 스택

- 클라이언트: React Native(Expo), Zustand
- 백엔드: NestJS
- DB/인증: Supabase (Postgres + Auth)
- 가격 데이터: Travelpayouts Data API
- 푸시 알림: Expo Notifications (FCM/APNs)
- 스케줄러: `@nestjs/schedule` 기반 크론
