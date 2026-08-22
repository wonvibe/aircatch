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

## 기술 스택

- 클라이언트: React Native(Expo), Zustand
- 백엔드: NestJS
- DB/인증: Supabase (Postgres + Auth)
- 가격 데이터: Amadeus Self-Service API
- 푸시 알림: Expo Notifications (FCM/APNs)
- 스케줄러: `@nestjs/schedule` 기반 크론
