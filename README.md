# BlueSafe Platform

**BlueSafe**는 재한 외국인 임차인의 **보증금·공과금** 맥락에서, **XRPL** 위에 두는 신뢰·정산 레이어를 실험하는 통합 모노레포입니다. 모바일 웹, XRPL·계약 백엔드(BE1), 운영 API(BE2), 공용 `xrpl-core` 패키지를 한 저장소에서 빌드하고 로컬에서 재현할 수 있습니다.

**라이선스:** 워크스페이스마다 다를 수 있으며, 각 패키지의 `package.json`에 명시된 조항을 따릅니다.

---

## 이 저장소가 하는 일

| 구성 요소 | 역할 |
|-----------|------|
| `apps/mobile-frontend` | Vite 기반 모바일형 UI — 역할 선택, 지갑 연결, 임차인/임대인 플로우 |
| `services/be1-xrpl` | NestJS — `xrpl` 클라이언트, 내부 지갑, 계약 CRUD·잔액, 에스크로·멀티시그·정산 Payment·Trust/IOU·SBT 관련 서비스, 한전 연동 정산(Reconciler) 등 |
| `services/be2-ops` | Express — 계약 메타, 에스크로 앵커, 증빙, 분쟁, 정산, XRPL 트래킹 등 `/v1` REST |
| `packages/xrpl-core` | 워크스페이스 공용 XRPL 관련 코드 |

지갑 연결은 별도 마이크로서비스가 아니라 **BE1**의 `POST /api/wallet/*` 로 제공되어, 로컬 데모 시 구성 요소 수를 줄였습니다.

---

## 배경 (제품 관점)

단기 체류 **외국인 임차인**은 언어·일정 제약으로 보증금 회수와 **월 단위 공과금** 검증에 불리하고, 자금이 **임대인 단일 지갑**에 머무는 구조는 분쟁 시 신뢰 비용을 키웁니다. BlueSafe는 **원장 위 규칙**(에스크로, 다자 서명, 결제·메모 기록)으로 사전에 권한을 쪼개고, **API로 조회 가능한 사용량**과 맞추는 쪽을 지향합니다.

---

## 이 코드베이스에 구현·연결된 기능

아래는 **현재 브랜치에서 확인할 수 있는 구현**을 기준으로 정리한 것입니다. 스테이킹·슬래싱, 메인넷 운영, XLS-70/80 전면 적용 등은 로드맵 항목으로, 이 README의 표와 소스 트리를 함께 보면 범위를 가늠할 수 있습니다.

| 영역 | 코드 쪽에서 하는 일 |
|------|---------------------|
| **내부 지갑** | `WalletService` + `POST /api/wallet/connect` — 역할별 `xrpl.Wallet.generate()` 클래식 주소 |
| **테스트넷 보조** | `POST /api/wallet/fund-iou`(IOU 입금, issuer/운영자 환경 의존), `POST /api/wallet/peer-xrp-roundtrip`(테스트넷 URL일 때만 임차인↔임대인 XRP Payment 2건) |
| **계약·XRPL** | `contracts/*`, `xrpl/*` — 계약 생성·조회·잔액, `EscrowService`, `SignerListService`, `SettlementPaymentService`, `TrustSetService`, `SoulboundNftService` 등 |
| **공과금 정산 파이프** | `reconciler/*` — 사용량 기반 정산 시도 시 XRPL Payment + Memo 등(환경·모킹에 따라 동작 범위 상이) |
| **운영 API** | `be2-ops` — 계약·증빙·분쟁·정산·XRPL 트랙 REST |
| **지갑 전용 모드** | `BE1_WALLET_ONLY=1` 시 `WalletAppModule` — Postgres/Redis 없이 지갑 API만 기동 |

선택 스크립트: `services/be1-xrpl/scripts/testnet-peer-xrp.cjs` — **양 역할 시드**를 환경 변수로 줄 때, 로컬에서 상호 XRP 전송을 직접 돌릴 때 사용합니다.

---

## 설계 방향 (제품·프로토콜)

| 방향 | 내용 |
|------|------|
| **다자 통제** | XRPL **SignerListSet**·**Escrow** 류 프리미티브로 단일 주체가 자금을 독단 해제하기 어렵게 만드는 패턴 |
| **정산 투명성** | 전력 등 **외부 사용량 API**와 대조한 뒤 **Payment + Memo**(해시 등)로 온체인에 근거 남기기 |
| **신뢰 축적** | 계약·이력을 **NFT / SBT** 경로로 남기는 실험(`SoulboundNftService`, BE2 어댑터 등) |
| **XRPL을 고른 이유** | 네이티브 에스크로·멀티시그, 낮은 수수료·짧은 확정, IOU/토큰·DEX 생태, 향후 Credentials·퍼미션 도메인 등 규제 친화 스펙과의 정합 |

---

## 아키텍처 (런타임)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  모바일 웹 — apps/mobile-frontend (Vite), 기본 http://localhost:5179     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────┐                         ┌───────────────────┐
│ BE2 — be2-ops     │                         │ BE1 — be1-xrpl    │
│ :3100, /v1/*      │                         │ :3000             │
│ 계약·증빙·분쟁·정산 │                         │ /contracts,       │
└───────────────────┘                         │ /api/wallet/*     │
                                              │ → xrpl Client   │
                                              └─────────┬─────────┘
                                                        │
                                                        ▼
                                              ┌───────────────────┐
                                              │ XRPL (기본 테스트넷) │
                                              └───────────────────┘

┌───────────────────┐
│ Postgres + Redis  │  ← 전체 BE1 (TypeORM, BullMQ)
└───────────────────┘
```

---

## 테스트넷 XRP

`connect`로 생성한 주소는 처음 **잔액 0**이라 트랜잭션 수수료를 낼 수 없습니다. [XRPL 공식 테스트넷 faucet](https://faucet.altnet.rippletest.net/)으로 해당 주소에 테스트 XRP를 받은 뒤, `peer-xrp-roundtrip` 등 온체인 호출을 시도합니다. Faucet은 Ripple이 운영하는 **외부 HTTP API**이며, 이 레포에는 faucet 서버 구현이 포함되어 있지 않습니다.

---

## 모노레포 디렉터리

```txt
bluesafe-platform/
├── apps/mobile-frontend/
├── services/be1-xrpl/
│   ├── docker-compose.yml
│   ├── scripts/testnet-peer-xrp.cjs
│   └── src/   wallet, contracts, reconciler, xrpl, …
├── services/be2-ops/
├── packages/xrpl-core/
└── docs/flow-captures/
```

---

## 로컬 실행

**요구:** Node.js(LTS), npm, Docker·Docker Compose(BE1 전체 모드)

```bash
git clone https://github.com/KFIP-2026/bluesafe-platform.git
cd bluesafe-platform
npm install

cd services/be1-xrpl && docker compose up -d && cd ../..
```

터미널을 나눠 실행합니다.

```bash
npm run dev:be1          # http://localhost:3000
npm run dev:be2          # http://localhost:3100
npm run dev:frontend     # http://localhost:5179
```

지갑 API만: `npm run dev:be1:wallet`

### 환경 변수

- 프론트: `VITE_BE1_URL`, `VITE_BE2_URL`, `VITE_WALLET_API_URL` 등 (`apps/mobile-frontend`)
- BE1: `services/be1-xrpl/.env.example` (`XRPL_NETWORK_URL`, `XRPL_OPERATOR_SEED`, DB·Redis 등)
- BE2: 저장소 내 문서 및 `.env.example` 참고

---

## API 개요

**BE1 (일부)**

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/wallet/connect` | `tenant` / `landlord` 내부 지갑 연결 |
| `POST` | `/api/wallet/disconnect` | 연결 해제 |
| `POST` | `/api/wallet/fund-iou` | 내부 지갑 IOU 입금(설정 필요) |
| `POST` | `/api/wallet/peer-xrp-roundtrip` | 테스트넷·URL 조건 충족 시 XRP 왕복 Payment |
| `POST` | `/contracts` | 계약 생성 |
| `GET` | `/contracts/:id` | 계약 조회 |
| `GET` | `/contracts/:id/balance` | 잔액 조회 |

**BE2 (`/v1` 일부)**

`POST /v1/contracts`, `PATCH .../status`, `PATCH .../escrow-anchor`, `POST /v1/evidences`, `POST /v1/disputes`, `POST /v1/disputes/:id/decision`, `GET /v1/settlements`, `PATCH /v1/settlements/:id/status`, `POST /v1/xrpl/track` 등.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트 | Vite, React, TypeScript |
| BE1 | NestJS, TypeORM, BullMQ, `xrpl` |
| BE2 | Express, TypeScript |
| 데이터 | PostgreSQL, Redis |
| 원장 | XRPL 테스트넷(기본 설정) |

---

## 제한 사항

- 기본은 **테스트넷** 전제입니다. 메인넷·실자금은 감사·규제·키 운용 절차를 갖춘 뒤에만 검토하세요.
- BE1 **내부 지갑**은 구현상 **프로세스 메모리**에 두는 구간이 있어, **프로세스 재시작 시 주소·키가 달라질 수 있습니다.** 장기 시연 주소가 필요하면 동일 프로세스 안에서 `connect` → faucet → 온체인 작업 순으로 고정하거나, 시드를 별도로 보관하는 방식을 쓰세요.
- `XRPL_OPERATOR_SEED` 등이 없으면 **일부** 계약·온체인 경로는 실패하고, UI·지갑 위주로만 동작할 수 있습니다.

---

UI 흐름 보조 자료: `docs/flow-captures/bluesafe-flow-board.png`
