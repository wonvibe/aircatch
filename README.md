# 에어캐치 (AirCatch)

항공권 특가 알림 앱. 다중 목적지를 등록해두면 서버가 주기적으로 Amadeus API 가격을 조회하고, 등록 시점 기준가보다 저렴해지면 푸시 알림을 보낸다.

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

```bash
pnpm dev:mobile          # Expo Go 또는 시뮬레이터로 QR/키 입력 접속
```

### Supabase

```bash
pnpm exec supabase start   # 로컬 스택(Docker 필요)
pnpm exec supabase db diff # 마이그레이션과 실제 스키마 차이 확인
```

### Amadeus

1. https://developers.amadeus.com 에서 가입 후 앱을 하나 만들면 무료 Self-Service(test) API 키(Client ID/Secret)가 발급된다.
2. `.env`의 `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`에 채워 넣는다. `AMADEUS_ENV=test`가 기본값(운영 전환 시 `production`).
3. 키가 없거나 Amadeus 호출이 실패해도 앱은 정상 동작한다 — `/watches` 생성은 성공하고 `baselinePrice`만 `null`로 남는다(`apps/api/src/watches/watches.service.ts`의 `captureBaseline` 참고). 공항 검색(`/airports/search`)도 시드 데이터에서 못 찾으면 빈 배열을 반환할 뿐 에러가 나지 않는다.

### 가격 모니터링 크론 / 알림

- `apps/api/src/cron/price-monitor.service.ts`가 두 개의 스케줄을 돌린다: 편도/왕복 watch는 5분마다 실행되며 각 watch를 id 해시 기준 12개 슬롯 중 하나에만 배정해 사실상 시간당 1회 조회(부하 분산), 다구간 watch는 4시간마다 전체를 훑는다(`flight-offers`가 더 비싼 호출이라 저빈도로 운영).
- 기준가 하락 판정: 새 가격이 `baseline_price`보다 낮고, 하락폭이 5,000원 이상이거나 `target_price` 이하이면 알림 발송 + `baseline_price`/`last_notified_price` 갱신. 임계값 미만의 소폭 하락은 `price_history`에는 기록되지만 기준가는 움직이지 않는다(나중에 더 큰 폭으로 떨어졌을 때 원래 기준가 대비로 정확히 비교하기 위함).
- 로컬에서 즉시 확인하려면 cron을 기다리지 않고 바로 트리거할 수 있다:
  ```bash
  curl -X POST http://localhost:3000/internal/cron/run-price-check \
    -H "x-internal-secret: $INTERNAL_CRON_SECRET"
  ```
- 푸시 발송은 `expo-server-sdk` 사용. `EXPO_ACCESS_TOKEN`은 선택값(비워둬도 동작) — Expo 계정에 enhanced security를 켰다면 채워야 한다. 알림 발송 결과는 항상 `notification_logs`에 기록된다(성공/실패 모두).

## 기술 스택

- 클라이언트: React Native(Expo), Zustand
- 백엔드: NestJS
- DB/인증: Supabase (Postgres + Auth)
- 가격 데이터: Amadeus Self-Service API
- 푸시 알림: Expo Notifications (FCM/APNs)
- 스케줄러: `@nestjs/schedule` 기반 크론
