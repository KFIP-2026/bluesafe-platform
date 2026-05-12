# BlueSafe Platform

BlueSafe XRPL 해커톤 통합 레포입니다. 기존 팀원 레포는 그대로 보존하고, 발표 및 통합 실행을 위해 프론트엔드, BE1, BE2, XRPL core를 한 곳에 모았습니다.

## Structure

```txt
apps/
  mobile-frontend/     Toss-like mobile frontend
services/
  be1-xrpl/            NestJS XRPL contract, escrow, balance, internal wallet API
  be2-ops/             Express operations API: contracts, evidence, disputes, settlements
packages/
  xrpl-core/           XRPL service/core package
docs/
  flow-captures/       Current mobile UI screenshots and flow board
```

## Integrated Changes

- BE1에 내부 XRPL 지갑 API를 통합했습니다.
  - `POST /api/wallet/connect`
  - `POST /api/wallet/disconnect`
  - `xrpl.Wallet.generate()` 기반 주소 생성
- 프론트는 역할 선택 후 지갑 연결 화면을 거쳐 임차인/임대인 플로우로 진입합니다.
- BE1과 BE2는 `http://localhost:5179`, `http://127.0.0.1:5179` CORS를 기본 허용합니다.
- 별도 wallet API 서버는 두지 않습니다. 지갑 연결은 BE1의 `/api/wallet/connect`로 처리합니다.

## Local Run

루트에서 한 번 설치합니다.

```bash
npm install
```

BE1은 Postgres와 Redis가 필요합니다.

```bash
cd services/be1-xrpl
docker compose up -d
cd ../..
```

각 서버를 별도 터미널에서 실행합니다.

```bash
# BE1 XRPL + internal wallet API: http://localhost:3000
npm run dev:be1

# BE2 operations API: http://localhost:3100
npm run dev:be2

# Mobile frontend: http://localhost:5179
npm run dev:frontend
```

브라우저 접속:

```txt
http://localhost:5179
```

## Environment

프론트 기본 연결값:

```env
VITE_BE1_URL=http://localhost:3000
VITE_BE2_URL=http://localhost:3100
VITE_WALLET_API_URL=http://localhost:3000
VITE_BLUESAFE_AUTH_TOKEN=
```

BE1에서 실제 XRPL 에스크로 생성까지 테스트하려면 `XRPL_OPERATOR_SEED`가 필요합니다. 값이 없으면 지갑 연결과 UI 흐름은 확인할 수 있지만, `POST /contracts` 기반 실제 락업은 실패합니다.

BE2는 기본 개발 모드에서 `IPFS_MODE=mock`, `BLUESAFE_AUTH=0`로 실행하는 것을 권장합니다.

## Main API Contracts

BE1:

- `POST /api/wallet/connect`
- `POST /api/wallet/disconnect`
- `POST /contracts`
- `GET /contracts/:id`
- `GET /contracts/:id/balance`

BE2:

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

- 원본 팀원 레포는 수정하지 않았고, 이 레포만 통합 실행용으로 수정합니다.
- BE1 내부지갑은 현재 메모리 기반입니다. 서버 재시작 시 세션이 초기화되며, 운영용으로는 사용자/세션 단위 저장소가 필요합니다.
- `docs/flow-captures/bluesafe-flow-board.png`에서 현재 모바일 화면 흐름을 볼 수 있습니다.
