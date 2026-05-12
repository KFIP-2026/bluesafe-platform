# BlueSafe Platform

BlueSafe XRPL hackathon monorepo입니다. 기존 팀별 저장소를 보존한 상태에서, 발표와 통합 실행을 위해 프론트엔드, BE1, BE2, XRPL core, 내부지갑 레퍼런스를 한 저장소에 모았습니다.

## Structure

```txt
apps/
  mobile-frontend/     Toss-like mobile frontend
services/
  be1-xrpl/            NestJS XRPL contract, escrow, balance, internal wallet API
  be2-ops/             Express operations API: contract state, evidence, disputes, settlements, XRPL tracking
packages/
  xrpl-core/           XRPL service/core package: escrow, multisig, NFT/SBT, credentials, payment
docs/
  flow-captures/       Current mobile UI screenshots and flow board
```

## Integrated Changes

- `services/be1-xrpl`에 내부지갑 API를 통합했습니다.
  - `POST /api/wallet/connect`
  - `POST /api/wallet/disconnect`
  - `xrpl.Wallet.generate()` 기반 내부 XRPL 주소 생성
  - 프론트가 기대하는 `address`, `publicKey`, `network` 응답 제공
- `apps/mobile-frontend`는 역할 선택 후 `BlueSafe 지갑 만들기` 화면을 거쳐 임차인/임대인 플로우로 진입합니다.
- 프론트 Vite proxy는 `/api/wallet` 요청을 BE1 `http://localhost:3000`으로 전달합니다.
- 별도 wallet API 서버는 두지 않습니다. 내부지갑 연결은 BE1의 `/api/wallet/connect`로 흡수했습니다.

## Local Run

각 패키지 의존성은 개별 package-lock을 기준으로 설치합니다.

```bash
cd apps/mobile-frontend && npm install
cd ../../services/be1-xrpl && npm install
cd ../be2-ops && npm install
```

실행 포트:

```bash
# BE1 XRPL + internal wallet API
cd services/be1-xrpl
npm run start:dev

# BE2 operations API
cd services/be2-ops
$env:PORT=3100
npm run dev

# Mobile frontend
cd apps/mobile-frontend
npm run dev -- --host 127.0.0.1 --port 5179
```

프론트 접속:

```txt
http://localhost:5179
```

## Main API Contracts

### BE1

- `POST /api/wallet/connect`
- `POST /api/wallet/disconnect`
- `POST /contracts`
- `GET /contracts/:id`
- `GET /contracts/:id/balance`

### BE2

- `POST /v1/contracts`
- `PATCH /v1/contracts/:contractId/status`
- `PATCH /v1/contracts/:contractId/escrow-anchor`
- `POST /v1/evidences`
- `POST /v1/disputes`
- `POST /v1/disputes/:disputeId/decision`
- `GET /v1/settlements`
- `PATCH /v1/settlements/:settlementId/status`
- `POST /v1/xrpl/track`

## Notes

- 원본 팀원 repo는 수정하지 않았습니다. 이 저장소는 통합본입니다.
- `BE1`은 DB/Postgres와 Redis 환경을 필요로 합니다. 내부지갑 API 자체는 메모리 지갑을 생성하지만, Nest 앱 전체 부팅에는 기존 BE1 환경 설정이 적용됩니다.
- `docs/flow-captures/bluesafe-flow-board.png`에서 현재 모바일 화면 흐름을 볼 수 있습니다.
