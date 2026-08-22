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

## 기술 스택

- 클라이언트: React Native(Expo), Zustand
- 백엔드: NestJS
- DB/인증: Supabase (Postgres + Auth)
- 가격 데이터: Amadeus Self-Service API
- 푸시 알림: Expo Notifications (FCM/APNs)
- 스케줄러: `@nestjs/schedule` 기반 크론
