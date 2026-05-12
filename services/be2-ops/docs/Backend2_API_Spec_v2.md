# BlueSafe Backend2 API Spec v2

## 1. Document Info

- Version: `v2.0`
- Owner: `Backend2`
- Scope: `Evidence Vault`, `Dispute Case Engine`, `XRPL State Watcher`, `Tx Outcome Classifier`, `Notification Hub`, `Audit Trail`, `Contract lifecycle` (MVP)
- Status: `Implemented MVP — spec aligned to code + canvas`; 로드맵 확장은 `docs/Backend2_API_Spec_v3.md`, `docs/Backend2_API_Spec_v4.md`, **`docs/Backend2_API_Spec_v5.md`**, **`docs/Backend2_API_Spec_v6.md`**, **`docs/Backend2_API_Spec_v7.md`**, **`docs/Backend2_API_Spec_v8.md`** 참조 (**§15–§17**는 v3·v4·v5·v6·v7·v8·최근 코드와 동기화, 2026-05-09 이후 개정).
- Baseline: `docs/Backend2_API_Spec_v1.md` (설계 계약; 변경 시 본 문서 **§13** Open Decisions 참조)
- Alignment: `bluesafe-backend2-plan.canvas.tsx` (유저플로우·모듈·8주 순서·문서 패키지 A–E)

### 1.1 Canvas 대비 개발 단계 (요약)

**완료에 가까움 (MVP E2E + v4 일부 착지)**

- 계약 생성·조회·상태 전이 API; **`PATCH /v1/contracts/:contractId/escrow-anchor`** — `escrowCreateTxHash` 저장, `draft`→`escrow_pending`, live 시 `EscrowCreate`+`tesSUCCESS`면 `escrow_validated`(§9.1).
- 증빙 업로드(multipart)·CID/SHA-256·검증·조회·버전 (IPFS mock / Pinata)
- 분쟁 생성(계약·증빙 검증)·단건 조회·Verifier mock 판정·집행 요청(MVP **합성 `txHash`** + 트랙 연결; **v6**: `BLUESAFE_SYNTHETIC_EXECUTION_HASH=0` 시 ledger `txHash` 필수; **v8-B**: `BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict` 시 합성 경로 비활성)
- XRPL 트랙 등록·조회·`refresh`·`account_tx` 백필 (`XRPL_WSS_URL` 설정 시 live `tx` / `account_tx`; 미설정 시 시뮬 경로); **validated 원장 기준 Escrow 객체 조회** (`GET /v1/xrpl/accounts/:account/escrows`, `marker` 지원)
- **`subscribe` 워커**: `accounts`(미검증 트랙 계정) + **`ledger` 스트림**; 트랜잭션·원장 멱등(`xrpl_ingestion_events` + 메모리 dedup); 원장마다 **`settlement.ledger_closed`** 도메인 이벤트 기록
- **Tx 정책(v1 §7.3)**: `delayed_jobs` 테이블(`005_v4_delayed_jobs.sql`) + **`xrpl-tx-policy.worker`** — stale 트랙을 큐에 넣고 claim 후 `tx`/`account_tx` 프로브
- 트랜잭션 결과코드 → `outcomeClass`; 검증 완료 시 `execution_pending` 분쟁 자동 `executed` / `rejected`
- 감사로그·이벤트 스트림 조회(**`GET /v1/events?eventType=`** 필터); 알림 **큐·워커·mock provider**
- **RBAC(옵션)**: `BLUESAFE_AUTH=1` 시 `/v1`에 역할·스코프 헤더; 스모크·로컬은 기본 비활성
- `npm run smoke` E2E; **`npm run subscribe-soak`** + `docs/runbooks/v4-subscribe-soak.md`

**캔버스 대비 여전히 부분·후속 (상세 §15–§17)**

- 유저플로우 **2**: 앵커 API·live 검증은 있으나 **온체인 submit·서명**은 Blockchain Lead 영역(v1 §4.2). **5**: 집행 응답 `txHash`는 여전히 **합성** 경로가 기본. **3**: `settlement.ledger_closed`는 **원장 경계 이벤트** 수준; **월별 Payment·Memo·집계 파이프라인**은 미구현(**v4-D/E**). **6**: 목록·감사·이벤트는 있으나 **집계·export API**는 **v4-E**.
- P0 Notification: 실 FCM/APNs/Email은 **v4**; P2 Reputation 미구현.

**다음 개발 단계 (v4 잔여)**

1. **v4-A**: Live XRPL CI/필수 job·감사 p95·soak **수치** 기록(런북은 초기 제공됨).
2. **v4-C/E**: 집행 **실 ledger** 모드·리포트·export.
3. **v4-F**: Bearer/mTLS 등 프로덕션 인증 강화·메인넷 게이트.

(See `docs/Backend2_API_Spec_v4.md` for v4 phased gates; **`docs/Backend2_API_Spec_v5.md`** for post-v4 work.)

---

## 2. Purpose

이 문서는 v1에서 고정한 W1 계약을 계승하면서, **현재 구현**과 **캔버스 통합 가이드**·**참조 문서 세트**를 한곳에 묶는다.

핵심 목표 (v1과 동일):

- 계약/분쟁 증빙의 `IPFS CID` 기반 무결성 보장
- XRPL 트랜잭션 상태(`validated`) 기준의 일관된 상태 전이
- `tes/tec/tem/ter` 기반 실패 분류와 재시도 정책 표준화
- 운영사 콘솔에서 케이스 이력을 완전 추적 가능하게 설계

v2는 위 목표 대비 **구현된 API·도메인·제한사항**과 **공식/커뮤니티 문서 링크**를 명시한다.

---

## 3. Official Docs Mapping

프로젝트에서 태그한 문서(`@xrpl.js`, `@xrpl_escrow`, …)와 공식 URL을 함께 둔다. 구현 시 **validated 원장**을 쓰는지 여부는 [xrpl.js 2.x migration — Validated Results](https://xrpl.org/docs/references/xrpljs2-migration-guide)를 참고한다.

### 3.1 Core XRPL (`@xrpl.js`, `@xrpl_http` / `@xrpl_wss`, `@xrpl_publicapimethods`)

- [XRP Ledger Docs — HTTP / WebSocket API](https://xrpl.org/docs/references/http-websocket-apis/) (공개 메서드 전반)
- [subscribe](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe) — `transactions` / `ledger` 등 스트림 (Backend2 후속: 월 정산·실시간 동기화)
- [xrpl.js — npm / 타입](https://js.xrpl.org/) — `Client`, `Client.request`, `Wallet` (오프라인 서명·`autofill` 패턴)
- [xrpl.js 2.x migration (ripple-lib 1.x 대체)](https://xrpl.org/docs/references/xrpljs2-migration-guide)

### 3.2 Escrow (`@xrpl_escrow`, `@xrpl_escrowcreate`, `@xrpl_escrowfinish`, `@xrpl_escrowcancel`)

- [EscrowCreate (인터페이스)](https://js.xrpl.org/interfaces/EscrowCreate.html)
- [EscrowFinish](https://js.xrpl.org/interfaces/EscrowFinish.html)
- [EscrowCancel](https://js.xrpl.org/interfaces/EscrowCancel.html)
- [LedgerEntry — Escrow 객체](https://js.xrpl.org/interfaces/LedgerEntry.Escrow.html)
- 프로토콘 레퍼런스: [EscrowCreate / Finish / Cancel](https://xrpl.org/docs/references/protocol/transactions/) (트랜잭션 타입 목록에서 각 타입)

#### 3.2.1 Escrow ↔ BlueSafe 도메인 매핑 (v7-A)

BlueSafe는 **원장 `validated` 결과**와 **rippled `tx` / `subscribe` / `account_tx`**에서 읽은 `tx_json`을 기준으로 `xrpl_txs`에 프로토콜 필드를 정규화한다. 상세 규칙·Finish 발신자(Delegate) 논의는 `docs/adr/0005-v7-escrow-xrpl-tx-mapping.md`, `docs/adr/0006-xrpl-escrow-execution-actor.md`.

| XRPL 개념 | rippled / xrpl.js 필드 | `contracts` | `xrpl_txs` (기존 + v7-A) |
| --- | --- | --- | --- |
| Escrow 생성 트랜잭션 해시 | `hash` | `escrow_create_tx_hash` | `tx_hash` (동일 해시로 트랙 등록 시) |
| 트랜잭션 타입 | `TransactionType` | — | `tx_type` (`EscrowCreate` / `EscrowFinish` / `EscrowCancel`) |
| 발신 계정 (공통) | `Account` | — | `account` (rippled `Account`; 구독·백필용) |
| 에스크로 펀드 소유자 | Create: `Account` / Finish·Cancel: `Owner` | 비즈니스상 `landlord_id` 등과 **별도 매핑 ADR** (1:1 강제 아님) | `escrow_owner` |
| 수취 목적지 | Create: `Destination` | 테넌트/중립 계정 등 **제품 정책** | `escrow_destination` (Create만; Finish/Cancel은 NULL 가능) |
| 에스크로 객체 식별 | Create: `Sequence` / Finish·Cancel: `OfferSequence` | — | `escrow_offer_sequence` |
| Finish·Cancel 서명자 | `Account` (트랜잭션 제출자) | 집행 주체 — **ADR 0006** | `escrow_submitter_account` |
| 검증 여부·엔진 결과 | `validated`, `meta.TransactionResult` | — | `validated`, `result_code`, `outcome_class` |
| 원장 객체 조회 | `account_objects` … `LedgerEntry.Escrow` | — | `GET /v1/xrpl/accounts/:account/escrows` 응답으로만 제공(동일 스키마 `account`·`destination`·`amount` 등) |

### 3.3 권한·다중서명 (`@xrpl_signerlistset`)

- [SignerListSet](https://js.xrpl.org/interfaces/SignerListSet.html) (후속: Verifier/운영 다중서명; **집행 계정 모델**은 `docs/adr/0006-xrpl-escrow-execution-actor.md`)

### 3.4 실패·플래그 (`@xrpl_teccodes`, `@xrpl_errorcodes`, `@xrpl_flags`)

- [Transaction Results (tes / tec / tem / ter)](https://xrpl.org/docs/references/protocol/transactions/transaction-results)
- [xrpl.js — AccountSetAsfFlags 등](https://js.xrpl.org/enums/AccountSetAsfFlags.html)
- [AccountRoot 플래그 (원장)](https://js.xrpl.org/enums/LedgerEntry.AccountRootFlags.html)

### 3.5 증빙·메타·토큰 (`@xrpl_meta`, `@xrpl_nftoken`, `@xrpl_xls20`, `@xrpl_xls33`, `@xrpl_xls70`, `@xrpl_xls80`)

- [XRPL Meta (토큰/NFT 메타 REST·WS)](https://xrplmeta.org/)
- 공식 Docs — NFT / 토큰 개념: [XRPL Docs — Tokens](https://xrpl.org/docs/concepts/tokens/) (XLS-20 등 amendment별 문서로 이어짐)
- XLS-70(Credential)·XLS-80 등: 동일 **Concepts / References** 트리에서 amendment 문서 연결 (Reputation·KYC 브릿지 설계 시)

### 3.6 샘플·연동·비즈니스 (`@xrpl핵심기능별샘플코드typescript`, `@xrpl핵심기능별샘플코드python`, `@xrpl_rwasto`, KFIP, 지갑 가이드, 서비스 설계)

- [XRPL Korea — 개발 참고자료 허브 (oopy)](https://xrplkorea.oopy.io/2f4898c6-80bf-8043-9162-dded31508893)
- [XRPL 기반 서비스 설계 가이드 (Notion)](https://catalyze-research.notion.site/XRPL-2bc898c680bf8044b0b5f9cac6c52b7f?pvs=74)
- 로컬 사본: 저장소 루트 `XRPL기반서비스설계가이드.txt` (동일 주제 메모/체크리스트 보관 시)
- [XRPL 기반 RWA/STO 설계 (Notion)](https://catalyze-research.notion.site/XRPL-RWA-STO-2b9898c680bf8003ba9ad57558d04950?pvs=74)
- [핵심 기능 샘플 TypeScript (Notion)](https://catalyze-research.notion.site/XRPL-23e898c680bf8023b1b5f94b0b544db3?source=copy_link)
- [핵심 기능 샘플 Python (Notion)](https://catalyze-research.notion.site/XRPL-Python-294898c680bf809f8186fe2c56644980?source=copy_link)
- [xrplkorea/XRPL (GitHub 샘플)](https://github.com/xrplkorea/XRPL)
- [외부 지갑 연동 (Girin + xrpl.js + React)](https://catalyze-research.notion.site/XRPL-Girin-Wallet-Integration-Demo-295898c680bf80a09b23ef59f092ffce?source=copy_link)
- [내부 지갑 연동 (Notion)](https://catalyze-research.notion.site/XRPL-XRPL-Wallet-Integration-Demo-295898c680bf80979f4afce1b579f808?source=copy_link)
- [Ripple DevRel — 리소스 허브](http://linktr.ee/rippledevrel)
- [XRPL Dev Console](https://xrplkorea.dev/)
- [XRP Ledger Explorer (livenet)](https://livenet.xrpl.org/)
- [Price Oracles (개념)](https://xrpl.org/docs/concepts/decentralized-storage/price-oracles)

### 3.7 Canvas 패키지 A–E (빠른 참조)

| 패키지 | 포함 문서(태그) | 사용 단계(캔버스) |
| --- | --- | --- |
| A. 트랜잭션/상태 | xrpl.js, xrpl_http/wss, public methods, EscrowCreate/Finish/Cancel | 2, 3, 5, 6 |
| B. 실패 처리 | xrpl_teccodes, xrpl_errorcodes, xrpl_flags | 2, 5, 6 |
| C. 증빙/메타 | xrpl_meta, xrpl_nftoken, xrpl_xls20 (+ 확장 XLS-33/70/80) | 1, 4 |
| D. 신원/권한 | xrpl_xls70, xrpl_xls80, xrpl_signerlistset | 5, 7+ |
| E. 레퍼런스/샘플 | TS/Python 샘플, KFIP, GitHub xrplkorea/XRPL | 전 단계 |

### 3.8 v2 코드에서의 소비 (요약)

- **Live**: `xrpl` `Client` + `Client.request` — `tx`, `account_tx`, **`account_objects`(type `escrow`, `ledger_index: "validated"`)** (`XRPL_WSS_URL` 설정 시)
- **오프라인 조립**: `EscrowFinish` / `EscrowCancel` 타입으로 집행 바디 검증용 조립 (실제 submit은 Blockchain Lead 영역)
- **분류**: `transaction-results` 계열 접두사 → `outcomeClass` 매핑

---

## 4. Architecture Boundaries

### 4.1 In Scope (Backend2)

- Evidence upload/verify/versioning (mock 또는 Pinata CID)
- Dispute case lifecycle and verifier mock decision
- XRPL tx 조회·refresh·`account_tx` 백필 및 정규화 상태 저장
- Tx outcome classification (`tes/tec/tem/ter` → `outcomeClass`)
- Event emission and in-memory / Postgres event query; notification **enqueue API** (`queued` → 백그라운드 워커·mock provider; v3-B)
- Audit log write/read
- Contract lifecycle API (상태 PATCH + **escrow-anchor PATCH**)

### 4.2 Out of Scope (other roles / deferred)

- Escrow 트랜잭션의 **실제 서명·서버 submit**·메인넷 운영 게이트 (Blockchain Lead + ADR)
- **월 정산** 비즈니스 규칙(기간별 Payment·Memo·집계) 전체 파이프라인 — 현재는 **`settlement.ledger_closed`** 등 스트림 기반 이벤트만 제공
- Console UI, 모바일 UI
- **프로덕션 강등 인증**: `BLUESAFE_AUTH=1`은 헤더 기반 MVP RBAC; Bearer/mTLS·정식 IdP는 **v4-F**

### 4.3 Runtime (v2 구현)

- Node.js, Express 5, TypeScript, Zod, Multer, `xrpl`
- 저장소: **`DATABASE_URL` 없으면** `src/store.ts`(인메모리); **있으면** Postgres + 부팅 시 `db/migrations/*.sql` 순차 적용
- IPFS: `IPFS_MODE` / Pinata JWT (`src/services/ipfs.service.ts`)

---

## 5. Domain Model (v2 implemented; v1 대비 메모)

### 5.1 Contract

- `id`, `tenantId`, `landlordId`
- `status` (`draft`, `escrow_pending`, `escrow_validated`, `active`, `closed`, `cancelled`)
- `escrowCreateTxHash` (optional; **`PATCH .../escrow-anchor`** 또는 운영 절차로 설정; live XRPL 시 `EscrowCreate`+`tesSUCCESS`면 `escrow_validated` 전이 가능)
- `createdAt`, `updatedAt`

### 5.2 EvidenceFile

- v1 필드 전부 +
- `storageProvider`: `mock` | `pinata`
- `encryptionScheme?`: `aes-256-gcm-v1` (IPFS blob이 암호문일 때만)
- `retainUntil?`: ISO — 보존 정책 메타(자동 삭제는 별도 작업)
- **(V8-C)** `retentionClass`: `standard` \| `regulated` \| `legal_hold` (기본 `standard`)
- **(V8-C)** `jurisdiction?`, `legalHoldUntil?` — 법무/규제 메타; retention purge 후보에서 제외 규칙에 사용 (ADR `0012`)
- `localContentHashSeed`: **내부용**, API 응답 제외

### 5.3 DisputeCase

- v1과 동일하되 **`evidenceBundle`**: 문자열 배열(evidence id 목록). v1 명세의 단일 `evidenceBundleId` 대신 구현이 직접 id 배열을 보관.

### 5.4 CaseDecision

- v1과 동일 (`decidedBy`: `verifier_mock`)

### 5.5 XrplTransaction

- v1 필드 +
- `account?`, `disputeId?` (집행·트랙 병합)
- `trackingStatus`: `created` | `submitted` | `pending_validation` | `validated_success` | `validated_fail` | `retry_scheduled`
- `network`: `testnet` | `mainnet`

### 5.6 NotificationEvent / 5.7 AuditLog

- v1과 동일 개념

### 5.8 EventEnvelope (저장소 이벤트)

- `eventId`, `eventType`, `occurredAt`, `entityType`, `entityId`, `payload`, `traceId?`

---

## 6. State Machines (W1 Fixed + v2 behavior)

### 6.1 Contract State

- `draft -> escrow_pending`
- `escrow_pending -> escrow_validated | cancelled`
- `escrow_validated -> active`
- `active -> closed | cancelled`

서버: `PATCH /v1/contracts/:contractId/status`에서만 허용 전이 검증.

### 6.2 Dispute State

- `filed -> under_review`
- `under_review -> decided | rejected`
- `decided -> execution_pending`
- `execution_pending -> executed | rejected`
- `executed -> closed`

v2: 추적 tx가 `validated`일 때 `outcomeClass === success` → `executed`, 그 외 validated 실패 → `rejected` 자동 갱신 가능.

### 6.3 Tx Tracking State

- `created -> submitted -> pending_validation`
- `pending_validation -> validated_success | validated_fail | retry_scheduled`
- `retry_scheduled -> submitted`

---

## 7. Tx Outcome Classifier Policy

### 7.1 Minimum Classification

- `tes*` → `success`
- `tec*` → `manual_review` (validated but business-fail)
- `tem*` → `final_fail`
- `ter*` → `retryable`

### 7.2 Retry Rules (목표; 큐 미구현)

- Max retries: `3`
- Backoff: `10s`, `30s`, `90s`
- Retry targets: only `retryable`
- `manual_review`, `final_fail`: 자동 재시도 없음

### 7.3 Fallback Rules (목표)

- `pending_validation` 타임아웃(`120s`) → `account_tx` 백필 트리거
- `tx`·`account_tx` 모두에서 미발견 + 재시도 소진 → `manual_review`

---

## 8. Event Contract

### 8.1 Envelope

```json
{
  "eventId": "evt_01",
  "eventType": "dispute.filed",
  "occurredAt": "2026-05-09T01:00:00Z",
  "entityType": "dispute",
  "entityId": "dsp_123",
  "payload": {},
  "traceId": "trc_abc"
}
```

### 8.2 Event Types

- `evidence.uploaded`, `evidence.verified` (감사 위주)
- `escrow.tx_submitted`, `escrow.tx_validated`, `escrow.tx_failed` (후 둘은 목표/확장)
- `dispute.filed`, `dispute.decision_recorded`, `dispute.execution_requested`, `dispute.execution_status_updated` (v2: 라이브 검증 후 분쟁 자동 전이)
- `notification.requested`, `notification.sent`, `notification.failed`
- `contract.created`, `contract.status_changed`, **`contract.escrow_anchor_updated`**
- **`settlement.ledger_closed`** (원장 스트림 기반 정산·동기화 훅; 비즈니스 집계는 후속)

---

## 9. API Spec v2

Base path: `/v1`

추가: `GET /health`, Contracts CRUD 일부, **`GET /v1/contracts` 목록(페이지네이션·필터)**, **`PATCH /v1/contracts/:contractId/escrow-anchor`**, `GET /v1/disputes/:id`, **`GET /v1/disputes` 목록**, `GET /v1/events`(**`eventType` 쿼리**), XRPL `refresh`, **`GET /v1/xrpl/transactions` 목록**, 집행 응답에 `txHash`, track에 `account`, merge 규칙.

### 9.0 Health

#### GET `/health`

Response `200`: `{ "ok": true, "service": "bluesafe-backend2", "now": "<ISO>" }`

Query **`deep=1`** (또는 환경 변수 `HEALTH_DEEP_DEFAULT=1`): 저장소·XRPL 준비 상태를 포함한다 (v4 readiness).

Response `200` 예:

```json
{
  "ok": true,
  "service": "bluesafe-backend2",
  "now": "2026-05-09T12:00:00.000Z",
  "storage": "postgres",
  "db": "ok",
  "xrpl": "ok",
  "xrplSubscribe": {
    "started": true,
    "connected": true,
    "lastConnectedAt": "2026-05-09T11:59:50.000Z",
    "lastDisconnectedAt": "2026-05-09T11:59:40.000Z",
    "accountsSubscribed": 3,
    "ledgerStreamSubscribed": true,
    "lastLedgerIndex": 12345678,
    "ledgerClosedEvents": 42,
    "disconnectCycles": 1
  }
}
```

- `db`: `ok` (Postgres `SELECT 1` 성공) \| `skip` (인메모리 저장소) \| `error` (Postgres 실패 시; `dbDetail` 문자열 가능)
- `xrpl`: `ok` \| `disabled` (`XRPL_WSS_URL` 없음) \| `degraded` (WSS는 있으나 `server_info` 실패; `xrplDetail` 가능)
- **`xrplSubscribe`** (optional): `XRPL_WSS_URL`가 있고 `XRPL_SUBSCRIBE_WORKER_DISABLED`가 아닐 때, subscribe 워커의 인프로세스 스냅샷(W4 관측) — 연결 여부, 마지막 `ledgerClosed` 인덱스, 구독 계정 수 등
- **`xrplTxPolicy`** (optional): `XRPL_WSS_URL`가 있을 때 정책 워커 설정 요약 + **누적 메트릭**(tick·해결·소진 등; 인메모리, W5 관측) — `transactionsStream`·`subscribeLogReconnects` 플래그 포함

저장소 미초기화 등으로 점검 불가 시 `503`.

### 9.1 Contracts

#### POST `/v1/contracts`

Request:

```json
{ "tenantId": "usr_tenant_1", "landlordId": "usr_landlord_1" }
```

Response `201`: Contract 객체.

#### GET `/v1/contracts`

Operator Console용 목록. Query (모두 optional):

| 이름 | 설명 |
| --- | --- |
| `limit` | 1–200, 기본 50 |
| `offset` | 0 이상, 기본 0 |
| `status` | 계약 상태 (`draft`, `escrow_pending`, …) |
| `tenantId` | 테넌트 id |
| `landlordId` | 임대인 id |
| `updatedFrom`, `updatedTo` | `updatedAt` 범위(ISO 8601, inclusive) |

Response `200`:

```json
{
  "items": [/* Contract */],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

잘못된 ISO: `400` `B2_VALIDATION_ERROR`.

#### PATCH `/v1/contracts/:contractId/escrow-anchor`

Request: `{ "txHash": "<64 hex 또는 rippled가 허용하는 해시 문자열>" }` (Zod: 길이 8–128)

동작 요약:

- `escrowCreateTxHash` 갱신. `draft`이면 **`escrow_pending`**으로 전이.
- `XRPL_WSS_URL`이 설정된 경우: `tx`로 조회 후 필요 시 **`account_tx`**(계약 `tenantId`·`landlordId` 계정 순)로 보강. **`validated` + `tesSUCCESS` + `TransactionType` EscrowCreate**이고 계약이 `escrow_pending`이면 **`escrow_validated`**.
- `active`/`closed`/`cancelled`에서는 `409`. 이미 `escrow_validated`인데 **다른** 해시로 바꾸면 `409`.

`BLUESAFE_AUTH=1`일 때 역할·소속 검증은 §11·미들웨어와 동일.

#### GET `/v1/contracts/:contractId`

Response `200` | `404` `B2_NOT_FOUND`.

#### PATCH `/v1/contracts/:contractId/status`

Request: `{ "status": "escrow_pending" }`  
Response `200` | `404` | `409` (전이 불가).

### 9.2 Evidence Vault

#### POST `/v1/evidences`

multipart: `file`, `contractId`, **`category`** (`contract_pdf` \| `utility_bill` \| `photo` \| `receipt` \| `other`, 기본 `other`), optional `disputeId` (해당 **계약**의 분쟁이어야 함), optional `uploaderId` (기본 `operator_local`), optional **`retentionDays`** (양의 정수, 상한 `EVIDENCE_MAX_RETENTION_DAYS` — `retain_until` 저장만; 자동 삭제는 미구현).

- **용량**: `EVIDENCE_MAX_UPLOAD_BYTES` 초과 시 `413` `B2_EVIDENCE_TOO_LARGE`.
- **MIME**: 카테고리별 허용 목록 위반 시 `400` `B2_EVIDENCE_MIME_NOT_ALLOWED` (ADR `docs/adr/0003-evidence-vault-w2.md`).
- **암호화**: `EVIDENCE_ENCRYPTION_KEY`(32바이트 base64) 설정 시 IPFS 업로드 전 **AES-256-GCM**; 미설정 시 평문 업로드이며 `is_encrypted`는 실제와 일치.
- **권한**: 계약에 대해 `canAccessContract`가 거부되면 `403`.

Response `201`:

```json
{
  "evidenceId": "evd_001",
  "cid": "bafy...",
  "sha256": "abc123...",
  "version": 1,
  "createdAt": "2026-05-09T01:00:00Z",
  "encryptionScheme": "aes-256-gcm-v1",
  "retainUntil": "2028-05-09T01:00:00.000Z"
}
```

실패: `502` `B2_IPFS_UPLOAD_FAILED` \| `500` `B2_CONFIG_ERROR`(암호화 키 형식 오류).

#### POST `/v1/evidences/verify`

Request:

```json
{ "cid": "bafy...", "expectedSha256": "abc123..." }
```

Response `200`: `{ "verified": true, "cid": "...", "actualSha256": "..." }`  
CID 미존재: `404`. 계약 접근 불가: `403`.

#### GET `/v1/evidences/:evidenceId`

메타 조회 (`localContentHashSeed` 제외, `storageProvider`·`retainUntil`·`encryptionScheme` 포함). 계약 접근 불가 시 `403`.

### 9.3 Dispute Case Engine

#### POST `/v1/disputes`

Request:

```json
{
  "contractId": "ctr_001",
  "raisedBy": "tenant",
  "reasonCode": "UTILITY_OVERCHARGE",
  "evidenceIds": ["evd_001", "evd_002"]
}
```

Response `201`: `{ "disputeId", "status": "filed", "createdAt" }`  
계약 없음 / 증빙 없음: `404`. 계약 접근 불가: `403` `B2_FORBIDDEN`.

#### PATCH `/v1/disputes/:disputeId/status`

Request: `{ "status": "under_review" | "filed" }`  
전이: `filed`→`under_review`(검토 시작), `under_review`→`filed`(**운영자만**, `BLUESAFE_AUTH=1` 시).  
성공 시 `under_review`면 이벤트 **`dispute.review_started`**.  
`403` / `409` (허용되지 않는 전이).

#### POST `/v1/disputes/:disputeId/verifier-votes`

역할: `operator` \| `verifier`. Body: `{ "verifierId", "recommendation" }` — `recommendation`은 판정 API와 동일 enum.  
분쟁이 `filed` 또는 `under_review`일 때만 허용. 이벤트 **`dispute.verifier_vote`** 저장.

#### GET `/v1/disputes/:disputeId/review-state`

투표 이벤트 집계: `{ "votes", "tally", "quorumMet", "quorumK", "status" }` — `quorumK`는 `DISPUTE_VERIFIER_QUORUM_K`(기본 1).

#### GET `/v1/disputes`

Query (optional): `limit`, `offset` (위와 동일 규칙), `contractId`, `status`, `updatedFrom`, `updatedTo` (ISO).

Response `200`: `{ "items": [/* DisputeCase */], "total", "limit", "offset" }`

#### GET `/v1/disputes/:disputeId`

Response `200`: DisputeCase. 계약 스코프 밖: `403`.

#### POST `/v1/disputes/:disputeId/decision`

Request: `{ "decision": "cancel_to_owner", "memo": "..." }`  
Response `200`: `{ "disputeId", "status": "decided", "decisionId" }`  
상태 불가: `409`. 계약 스코프 밖: `403`.

#### POST `/v1/disputes/:disputeId/execution`

Request:

```json
{
  "txType": "EscrowCancel",
  "owner": "rOwnerXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "offerSequence": 10,
  "network": "testnet",
  "txHash": "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"
}
```

- `txHash` (optional, v6 / v8-B): 64자 **hex** rippled 트랜잭션 id. **`BLUESAFE_SYNTHETIC_EXECUTION_HASH=0`** 또는 **`BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict`**(백엔드 submit 실패 시)에는 **필수**. XRPL live가 켜져 있으면 `tx`로 조회해 `TransactionType`이 `txType`과 다르면 `409`.
- **합성 `txHash`(MVP)**: `BLUESAFE_EXECUTION_DEPLOYMENT_TIER` 기본 `dev`이고 `BLUESAFE_SYNTHETIC_EXECUTION_HASH`가 `0`이 아닐 때만, `txHash` 생략·submit 불가 시 허용. 스테이징/프로덕션은 `strict` 권장 — `docs/adr/0011-v8-execution-keys-synthetic-hash.md`.

Response `202`:

```json
{
  "requestId": "exec_001",
  "status": "execution_pending",
  "txHash": "ABCDEF...",
  "synthetic": true
}
```

`decided`가 아니면 `409`. 계약 스코프 밖: `403`.

### 9.4 XRPL State Watcher

#### POST `/v1/xrpl/track`

Request:

```json
{
  "txHash": "ABCDEF...",
  "txType": "EscrowCreate",
  "network": "testnet",
  "account": "rOwnerXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

기존 레코드와 **merge** (`disputeId` 등 기존 값 유지).

Response `202`: `{ "txHash", "trackingStatus", "validated", "account" }` — `XRPL_WSS_URL`가 있으면 직후 rippled `tx`로 **한 번** 보강해 `trackingStatus`/`validated`/`account`가 갱신될 수 있음(W4).

#### GET `/v1/xrpl/transactions`

추적 중인 트랜잭션 목록. Query (optional): `limit`, `offset`, `account`, `trackingStatus`, `validated` (`true` \| `false`), `network` (`testnet` \| `mainnet`).

정렬: `lastCheckedAt` 내림차순.

Response `200`: `{ "items": [/* XrplTransaction */], "total", "limit", "offset" }`

#### GET `/v1/xrpl/transactions/:txHash`

Query: `refresh=true` (live 시 `tx` 재조회).

Response `200` 예:

```json
{
  "txHash": "ABCDEF...",
  "txType": "EscrowFinish",
  "account": "rOwner...",
  "disputeId": "dsp_001",
  "validated": true,
  "resultCode": "tesSUCCESS",
  "outcomeClass": "success",
  "ledgerIndex": 123456,
  "trackingStatus": "validated_success",
  "retries": 0,
  "escrowOwner": "rOwner...",
  "escrowDestination": null,
  "escrowOfferSequence": 42,
  "escrowSubmitterAccount": "rOwner...",
  "clientPolicyHint": {
    "code": "B2_XRPL_TX_VALIDATED_SUCCESS",
    "message": "Ledger-validated transaction with a successful engine result."
  }
}
```

`escrowOwner` / `escrowDestination` / `escrowOfferSequence` / `escrowSubmitterAccount` — **v7-A** Escrow 프로토콜 정렬 필드(EscrowCreate·Finish·Cancel에만 채워짐). 정의: `docs/adr/0005-v7-escrow-xrpl-tx-mapping.md`.

#### POST `/v1/xrpl/transactions/:txHash/refresh`

Live 전용. `XRPL_WSS_URL` 없으면 `400` 안내.

#### POST `/v1/xrpl/backfill/account-tx`

Request: `{ "account": "r...", "fromLedger?": 0, "resultCode?": "tesSUCCESS" }`  
live 실패 시 시뮬 보정 경로.

#### GET `/v1/xrpl/accounts/:account/escrows`

Live 전용. rippled `account_objects` — `ledger_index: "validated"`, `type: "escrow"` ([account_objects](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_objects)).

Query: `limit` (optional, 정수 **10–200**, 기본 50; rippled 비관리 연결은 최소 10), **`marker`** (optional — 이전 응답의 `nextMarker`를 JSON 문자열 또는 rippled가 돌려준 그대로 전달하여 [account_objects](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_objects) 페이지네이션)

Response `200` 예:

```json
{
  "account": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "ledgerIndex": "validated",
  "resolvedLedgerIndex": 12345678,
  "ledgerHash": "...",
  "count": 1,
  "escrows": [
    {
      "ledgerEntryIndex": "...",
      "account": "r...",
      "destination": "r...",
      "amount": "1000000",
      "finishAfter": 946684800,
      "cancelAfter": 946688400,
      "previousTxnId": "...",
      "previousTxnLedgerSeq": 7000000,
      "flags": 0
    }
  ],
  "nextMarker": null
}
```

주소 형식 오류: `400`. Live 비활성: `400`. rippled 오류: `502` `B2_XRPL_UPSTREAM_ERROR`.

#### POST `/v1/notifications`

Request: `{ "eventType", "recipientId", "channel": "push"|"email"|"inapp", "payload" }`  
**v3:** `202 Accepted` — 본문 `status: "queued"`로 저장되고, 백그라운드 워커가 provider 전송 후 `sent` / `retry_scheduled` / `failed`(DLQ: `deadLetter: true`)로 갱신한다. 조회: `GET /v1/notifications/:notificationId`. 환경 변수: `NOTIFICATION_PROVIDER_MODE`(`success`|`fail_first`|`fail_always`), `NOTIFICATION_MAX_ATTEMPTS`, `NOTIFICATION_WORKER_INTERVAL_MS`, `NOTIFICATION_WORKER_DISABLED=1`.

#### GET `/v1/audits`

Query: `entityType`, `entityId`, `from`, `to` (ISO). **(V8-C)** `limit` (1–2000) 및/또는 `cursor`(opaque)를 주면 **키셋 페이지** 모드: 응답에 `nextCursor` 포함; 생략 시 기존과 같이 필터 결과 **전량** `items` (ADR `0012`).

#### GET `/v1/reports/audits.csv`

**(V8-C)** `GET /v1/reports/audits.ndjson`과 **동일 쿼리·동일 역할**(`operator` \| `verifier` \| `auditor`); UTF-8 BOM + 헤더 행이 선행한다.

#### GET `/v1/events`

Query (모두 optional): `entityType`, `entityId`, **`eventType`** (예: `settlement.ledger_closed`, `dispute.execution_status_updated`).

응답: `{ "count": <number>, "items": [ /* EventEnvelope */ ] }` — **서버 측 페이지네이션 없음**(전량 필터 결과; 대량 시 v4-E에서 cursor/제한 검토).

`BLUESAFE_AUTH=1`일 때 `X-Bluesafe-Role` 등 §11.2 참고.

### 9.6 QA

- `npm run smoke` — `scripts/smoke-test.mjs`, `SMOKE_PORT` (기본 3100)
- **`npm run subscribe-soak`** — `scripts/subscribe-soak.mjs` (헬스 폴링; `RUN_SERVER=1`로 자식 프로세스 기동 가능); 런북: `docs/runbooks/v4-subscribe-soak.md`

---

## 10. Error Model

### 10.1 Common API Error Response

```json
{
  "errorCode": "B2_TX_FINAL_FAIL",
  "message": "Transaction rejected by XRPL",
  "details": {
    "txHash": "ABCDEF...",
    "resultCode": "temMALFORMED"
  }
}
```

### 10.2 Backend Error Codes

- `B2_VALIDATION_ERROR`
- `B2_NOT_FOUND`
- `B2_FORBIDDEN`
- `B2_TX_RETRYABLE`
- `B2_TX_MANUAL_REVIEW`
- `B2_TX_FINAL_FAIL`
- `B2_IPFS_UPLOAD_FAILED`
- `B2_EVIDENCE_HASH_MISMATCH`
- `B2_INTERNAL_ERROR` (처리되지 않은 예외)
- `B2_XRPL_UPSTREAM_ERROR` (rippled `account_objects` 등 live 호출 실패 시 `502`)

---

## 11. Security Requirements

- Evidence at-rest encryption (KMS envelope 권장)
- RBAC: `tenant`, `landlord`, `operator`, `verifier`, **`auditor`** (읽기 전용; v6-E)
- Evidence download·분쟁 판정 시 감사로그
- XRPL memo에 PII 직접 저장 금지

### 11.1 v2 구현 갭 (2026-05 갱신)

- **인증·RBAC**: `BLUESAFE_AUTH=1` 시 헤더 기반 역할(`X-Bluesafe-Role`, 스코프 헤더) + 주요 `/v1` 라우트 `requireRoles`; **프로덕션 Bearer/mTLS·IdP 연동**은 **v4-F**.
- KMS·실제 암호화 스트림 없음 (`isEncrypted` 플래그 수준)
- 운영 전 Postgres + 비밀 관리 필수; 인메모리는 개발 전용

### 11.2 Optional RBAC (`BLUESAFE_AUTH=1`)

- 모든 `/v1/*` 요청에 **`X-Bluesafe-Role`**: `tenant` \| `landlord` \| `operator` \| `verifier` \| **`auditor`**
- **`auditor`**: 테넌트/임대인 스코프 헤더 불필요 — **조회 전용**(`GET`/`HEAD`만 허용; 그 외 메서드는 `403`). 계약·정산·분쟁·증빙·이벤트·리포트 등 읽기 API는 `requireRoles`에 포함.
- **Transport (옵션, v6)**: `BLUESAFE_V1_BEARER_TOKEN` 및/또는 `BLUESAFE_MTLS_CLIENT_CERT_SUBJECT_HEADER`가 설정되면 `/v1` 전역에서 **Bearer 또는 mTLS 프록시 헤더** 검증(역할 헤더와 독립).
- `tenant`: **`X-Bluesafe-Tenant-Id`** 필수 — 계약 목록·조회·수정 시 해당 테넌트로 스코프
- `landlord`: **`X-Bluesafe-Landlord-Id`** 필수 — 동일하게 임대인 스코프
- `BLUESAFE_AUTH` 미설정 또는 `0`(기본): 헤더 없이 동작(스모크·로컬)
- **(V8-D)** `BLUESAFE_OPERATOR_CONSOLE_SCOPES=1`이면 **`operator`** 역할에 한해 민감 라우트가 **`X-Bluesafe-Operator-Scopes`**(쉼표 구분: `export`,`purge`,`registry`,`sla`,`outbox`,`evidence`,`dispatch`,`settlements`,`disputes`,`all`)를 요구할 수 있음 — **헤더 생략 = 전체 권한(호환)**; 알 수 없는 토큰만 있으면 `403`. 인트로스펙션: **`GET /v1/operator/runtime/auth-providers`**. 선택 **`BLUESAFE_OIDC_ISSUER_URL`**: Issuer URL만 노출(본 서비스는 JWT 검증 미구현).

---

## 12. Definition of Done

### 12.1 W1 Done (v1)

- Domain model·상태머신·이벤트 타입·API·에러·Tx outcome 정책 고정

### 12.2 W2 Done (v1)

- Evidence upload/verify, CID/SHA-256, 버전, 감사 (권한·단위 테스트는 지속 확장)

### 12.3 W3 “초입” (캔버스 — Dispute 엔진 주차)

- 케이스 생성·상태 전환·Verifier mock·집행 요청·XRPL 트랙 연계 **MVP 달성** (본 repo 기준)

### 12.4 v2 MVP frozen (체크리스트)

- [x] §1.1 E2E 스모크 통과
- [x] Postgres + 마이그레이션 (`DATABASE_URL` 시 `db/migrations/*.sql`; 기본 인메모리)
- [x] 알림 mock provider + DB 큐·재시도·DLQ(v3-B; 외부 FCM/APNs 미연동)
- [ ] Live XRPL CI/런북 **필수** job (수동 런북·soak 스크립트는 초기 제공)
- [x] `subscribe` 워커 + 멱등(accounts + **`ledger`**; `xrpl_ingestion_events` + `settlement.ledger_closed` 이벤트)
- [x] v1 §7.3 타임아웃 프로브 + **`delayed_jobs`** 큐(`005_v4_delayed_jobs.sql`) + policy 워커 claim

---

## 13. Open Decisions (ADR 후보)

- Pinning provider SLA·운영 재시도(핀 고정 실패 시)
- 클라이언트 측 암호화 vs 서버만 암호화(현재: 서버 선택 암호화 — ADR 0003)
- 알림 provider·DLQ
- 메인넷 활성화 게이트
- `escrowCreateTxHash`와 Blockchain Lead submit 인터페이스

---

## 14. Configuration

| Variable | 설명 |
| --- | --- |
| `PORT` | HTTP (기본 3000) |
| `IPFS_MODE` | `mock` \| `pinata` |
| `IPFS_PINATA_JWT` | Pinata JWT |
| `IPFS_PINATA_ENDPOINT` | 기본 Pinata pinning URL |
| `EVIDENCE_MAX_UPLOAD_BYTES` | 증빙 단일 파일 최대 크기(바이트; 기본 15MiB 상한 내에서 설정) |
| `EVIDENCE_MAX_RETENTION_DAYS` | `retentionDays` 상한(기본 2555) |
| `EVIDENCE_ENCRYPTION_KEY` | 설정 시 32바이트 raw key의 **base64** — 업로드 시 AES-256-GCM 적용 |
| `XRPL_WSS_URL` | WSS 있으면 live `tx` / `account_tx` / `account_objects` |
| `XRPL_REQUEST_TIMEOUT_MS` | 요청 타임아웃 |
| `DATABASE_URL` | 설정 시 Postgres + 부팅 시 마이그레이션(`db/migrations/*.sql`) |
| `XRPL_SUBSCRIBE_WORKER_DISABLED` | `1`이면 `subscribe` 워커 비활성(기본: `XRPL_WSS_URL` 있으면 활성) |
| `XRPL_SUBSCRIBE_MAX_ACCOUNTS` | `subscribe`에 넣을 최대 계정 수(기본 50, 최대 100) |
| `XRPL_SUBSCRIBE_ACCOUNTS_REFRESH_MS` | 트랙 기준 계정 목록 재동기 주기(기본 45000ms) |
| `XRPL_SUBSCRIBE_TRANSACTIONS_STREAM` | W4: `1`이면 `subscribe`에 **`transactions`** 스트림 포함(공용 허브에서는 대역·CPU 유의; ADR `docs/adr/0004`) |
| `XRPL_SUBSCRIBE_LOG_RECONNECTS` | W4: `1`이면 subscribe 워커가 재연결 백오프 직전 JSON 한 줄 로그 |
| `XRPL_TX_POLICY_WORKER_DISABLED` | `1`이면 **v4-B** `pending_validation` 타임아웃 워커 비활성(기본: `XRPL_WSS_URL` 있으면 활성) |
| `XRPL_TX_POLICY_INTERVAL_MS` | 정책 워커 폴링 간격(기본 30000, 최소 5000) |
| `XRPL_PENDING_TX_TIMEOUT_MS` | `lastCheckedAt` 기준 이 시간(ms) 지나면 `tx`/`account_tx` 재조회(기본 120000, v1 §7.3) |
| `XRPL_TX_POLICY_BATCH_SIZE` | 한 틱당 최대 처리 트랙 건수(기본 10) |
| `XRPL_TX_POLICY_MAX_NOT_FOUND_PROBES` | `tx`·`account_tx` 모두 미발견 시 재시도 횟수 상한(기본 5, 이후 `manual_review`) |
| `XRPL_TX_ACCOUNT_BACKFILL_PER_TICK` | W4: 정책 워커 틱마다 `account` 없는 미검증 트랙에 대해 rippled `tx`로 `Account` 채우기 시도(기본 8, `0`이면 비활성) |
| `XRPL_TX_POLICY_LOG_SUMMARY` | W5: `1`이면 정책 워커가 틱마다 JSON 한 줄 요약(`jobsClaimed`, `jobsResolved` 등)을 stdout에 기록 |
| `XRPL_TX_POLICY_MAX_BACKOFF_MS` | W5: `delayed_jobs` 재스케줄 시 지수 백오프 상한(ms, 기본 300000) |
| `DISPUTE_VERIFIER_QUORUM_K` | W3: `GET .../review-state`의 `quorumMet`에 쓰는 최소 동일 추천 수(기본 1) |
| `HEALTH_DEEP_DEFAULT` | `1`이면 `/health`가 쿼리 없이도 `db`/`xrpl` 필드를 포함 |
| `NOTIFICATION_PROVIDER_MODE` | `success`(기본) \| `fail_first` \| `fail_always` — mock 전송 시뮬 |
| `NOTIFICATION_MAX_ATTEMPTS` | 실패 시 DLQ까지 시도 횟수(기본 5) |
| `NOTIFICATION_WORKER_INTERVAL_MS` | 워커 폴링 간격 ms(기본 2000, 스모크는 100) |
| `NOTIFICATION_WORKER_BATCH_SIZE` | 한 틱당 처리 건수(기본 20) |
| `NOTIFICATION_WORKER_DISABLED` | `1`이면 워커 비활성 |
| `BLUESAFE_AUTH` | `1`이면 `/v1`에 역할·스코프 헤더 필수(§11.2) |
| `BLUESAFE_OPERATOR_CONSOLE_SCOPES` | V8-D: `1`이면 operator 전용 민감 API에 `X-Bluesafe-Operator-Scopes` 게이트(§11.2) |
| `BLUESAFE_OIDC_ISSUER_URL` | V8-D: OIDC issuer URL(정보 노출용; 토큰 검증은 후속) |
| `BLUESAFE_XRPL_TOPOLOGY` | V8-E: `public_hub`(기본) \| `dedicated` \| `clio` — 선언적 토폴로지 라벨 |
| `BLUESAFE_XRPL_DR_RUNBOOK_URL` | V8-E: DR/페일오버 런북 HTTPS 링크(`/health`·`xrpl-operations`) |
| `BLUESAFE_SYNTHETIC_EXECUTION_HASH` | v6: `0`이면 `POST .../disputes/:id/execution`에 **ledger `txHash`(64 hex) 필수**; 미설정이면 기본 합성 해시 허용(단, v8-B `strict` 티어는 예외) |
| `BLUESAFE_EXECUTION_DEPLOYMENT_TIER` | v8-B: `dev`(기본) \| `strict` — `strict`이면 MVP **합성 `txHash` 경로 비활성**(실 `txHash` 또는 성공한 백엔드 submit 필수). ADR `0011` |
| `IPFS_PINATA_MAX_ATTEMPTS` | v6-B: Pinata 핀 업로드 최대 시도 횟수(기본 4, 최대 10) |
| `IPFS_PINATA_RETRY_INITIAL_MS` | v6-B: 첫 재시도 전 대기(ms, 기본 400) |
| `IPFS_PINATA_RETRY_MAX_MS` | v6-B: 재시도 백오프 상한(ms, 기본 10000) |
| `IPFS_PINATA_UNPIN_BASE_URL` | v6-B: Pinata unpin API 베이스(기본 `https://api.pinata.cloud/pinning/unpin`, CID는 path) |
| `NOTIFICATION_AUTO_DOMAIN_ENQUEUE` | v6-C: `0`이면 도메인 이벤트 자동 알림 비활성(그 외 기본 활성) |
| `REPUTATION_OUTBOUND_WEBHOOK_URL` | v6-F: 설정 시 `POST /internal/reputation-events` 수락 후 비동기 POST 대상 |
| `BLUESAFE_V1_BEARER_TOKEN` | 설정 시 모든 `/v1` 요청에 `Authorization: Bearer <동일값>` 필수(역할 헤더와 별개) |
| `BLUESAFE_MTLS_CLIENT_CERT_SUBJECT_HEADER` | 설정 시 해당 헤더가 비어 있지 않아야 `/v1` 통과(프록시 mTLS 연동) |
| `BLUESAFE_EXECUTION_SUBMIT_ENABLED` | `1`이면 XRPL live + 시드 시 `POST .../execution`이 **ledger 제출** 시도(합성/`txHash` 없을 때) |
| `BLUESAFE_EXECUTION_SUBMIT_SEED` | 집행 제출용 **family seed**(테스트넷 전용 권장; `owner`와 지갑 주소 일치 필수) |
| `EVIDENCE_KMS_STUB_DEK_BASE64` | `EVIDENCE_ENCRYPTION_KEY` 대신 32바이트 DEK base64(스텁 KMS) |
| `EVIDENCE_KMS_HTTP_UNWRAP_URL` | KMS sidecar: POST로 wrapped DEK 전달 → `{ plaintextKeyBase64 }` |
| `EVIDENCE_KMS_WRAPPED_DEK_BASE64` | HTTP unwrap 시 서버가 sidecar에 보낼 ciphertext(문서화된 문자열) |
| `EVIDENCE_KMS_HTTP_UNWRAP_BEARER` | unwrap HTTP 선택 Bearer |
| `EVIDENCE_KMS_HTTP_UNWRAP_TIMEOUT_MS` | unwrap 요청 타임아웃(기본 10000) |
| `EXPORT_JOB_WORKER_DISABLED` | `1`이면 감사 NDJSON export 잡 워커 비활성 |
| `EXPORT_JOB_WORKER_INTERVAL_MS` | export 워커 폴링 간격(기본 2000) |
| `EXPORT_JOB_WORKER_BATCH_SIZE` | 한 틱에 claim 할 잡 수(기본 3) |
| `SMOKE_PORT` | 스모크 전용 포트 (기본 3100) |
| `SUBSCRIBE_SOAK_ITERATIONS`, `SUBSCRIBE_SOAK_INTERVAL_MS`, `RUN_SERVER` | `npm run subscribe-soak` 동작 제어 |
| `SUBSCRIBE_SOAK_JSON` | `0`이면 마지막 한 줄 JSON 요약 비활성(기본: 출력) |
| `SUBSCRIBE_SOAK_REPORT_PATH` | 설정 시 요약 JSON 한 줄을 해당 파일에 append |
| `xrpl-live-probe` | `npm run xrpl-live-probe` — `XRPL_WSS_URL`로 `server_info`만 검사(GitHub `workflow_dispatch` + secret 권장) |

---

## 15. Roadmap: canvas 8주 ↔ 현재 위치

본 표는 **코드·`docs/Backend2_API_Spec_v3.md`·`docs/Backend2_API_Spec_v4.md`·`docs/Backend2_API_Spec_v5.md`**와 동기화한다. “현재”는 **v3-A/B/C/D + v4-B/C/D 일부 착지**까지 반영한다.

| 주차 | 캔버스 목표 | 현재 | 다음 액션 (주로 v4) |
| --- | --- | --- | --- |
| W1 | 설계 고정 | 완료 | ADR 파일 분리 |
| W2 | Evidence Vault | API+Pinata/mock + **MIME·용량·선택 암호화·`retain_until`** + ADR(`docs/adr/0003`) | Pinata SLA·증빙 다운로드 URL·KMS 연동 |
| W3 | Dispute 엔진 | 케이스·판정·집행 + **`PATCH .../status`(검토 시작)** + **검증자 투표 이벤트·`review-state`·쿼럼** + 계약 스코프 강화 | 실명 검증자·다수결 DB·SLA 타이머 |
| W4 | XRPL 안정화 | subscribe(ledger[+**transactions** 옵션])·health·**재연결 로그**·soak·live-probe | 장기 soak CI 수치·대량 네트워크 운영 ADR |
| W5 | 에러/재시도 | 분류기·delayed_jobs·hint·백오프·요약 로그·**정책 누적 메트릭(health)·`xrpl.tx_policy_exhausted` 이벤트** | Prometheus·외부 큐 |
| W6 | 알림+콘솔 | **알림 큐·워커·DLQ·상태 조회**; **콘솔 목록 API** | FCM/APNs/Email 등 실 provider; 집계·export(**v4-E**) |
| W7 | 통합 검증 | 로컬 `npm run smoke`; CI Postgres 스모크 | **Live** testnet job·감사 p95 |
| W8 | 데모 | 런북(`v4-subscribe-soak`)·soak 스크립트 | 장애·중복 시나리오·수치 기록 |

---

## 16. 유저플로우 ↔ 문서 ↔ 구현 (캔버스 §2 정렬)

| 단계 | Backend2 | 필수 문서(태그) | 완료 기준(캔버스) | 상태 (v3·v4 기준) |
| --- | --- | --- | --- | --- |
| 1 계약 등록 | 계약·증빙 API | xrpl_meta, nftoken, xls20, xrpl.js | CID 검증·계약 조회 | **달성** |
| 2 Escrow 생성 | tx validated + **앵커 PATCH** | escrowcreate, http/wss, public methods | pending→validated | **부분**: 해시·상태·live 검증; **submit**은 범위 밖 |
| 3 월 정산 | subscribe + account_tx + **원장 이벤트** | subscribe, http/wss | 누락 없이 최신화 | **부분**: `settlement.ledger_closed`; **월 집계·Payment** → **v4-D/E** |
| 4 분쟁 | CID 번들·케이스 | meta, nftoken, xls20 | 증빙 체인 | **달성** |
| 5 판정/집행 | Finish/Cancel·tec | escrowfinish/cancel, teccodes | 정책 자동 | **부분**: 분류·트랙·자동 분쟁 상태; 집행 `txHash` **합성(MVP)**; 실ledger → **v4-C** |
| 6 종료/리포트 | 통계·이력 | tx, account_objects, http/wss | 콘솔 재현 | **부분**: 감사·이벤트(`eventType`)·목록·Escrow **`marker`**; 통계·export → **v4-E** |

---

## 17. 모듈 ↔ 의존 문서 (캔버스 §3)

| 우선순위 | 모듈 | 핵심 구현 | 의존 문서 | 상태 (v3·v4 기준) |
| --- | --- | --- | --- | --- |
| P0 | XRPL State Watcher | subscribe+tx+account_tx+account_objects | public methods, http/wss, xrpl.js | **부분**: accounts+**ledger**·멱등·백필·escrows·**marker**; `account` 없는 트랙·월 집계 → **v4** |
| P0 | Tx Outcome Classifier | tes/tec/tem/ter | teccodes, errorcodes | **구현**; **`delayed_jobs`**와 policy 워커 결합 |
| P0 | Evidence Vault | IPFS CID·검증 | meta, nftoken, xls20 | **구현** |
| P0 | Dispute Case Engine | 상태머신 | escrowfinish/cancel, signerlistset | **구현**(MVP); 실ledger 집행·SignerListSet 운영 모델 → **v4-C**·**v4-F** |
| P0 | Notification Hub | 큐·워커·mock provider·DLQ | public methods | **부분**: V3-B 완료; 실 provider·웹훅 → **v4** |
| P1 | Operator Console API | 필터·관리 | public methods, http/wss | **부분**: V3-D 목록·필터; **헤더 RBAC(옵션)**; 집계·export·강인증 → **v4-E**·**v4-F** |
| P1 | Audit Trail | 불변 로그 | errorcodes, teccodes | **구현**; 시간 필터·인덱스(V3); p95·대량 export → **v4-A**·**v4-E** |
| P2 | Reputation Bridge | SBT 이벤트 | xls20, xls70, xls80 | **미구현** → **v4** 훅 이후 |

---

## 18. Changelog v1 → v2

- **(v2 문서·코드, 2026-05-09)** W3: **`PATCH /v1/disputes/:id/status`**, **`POST .../verifier-votes`**, **`GET .../review-state`**, 분쟁 생성·판정·집행·조회에 **계약 스코프(`canAccessDispute`)**; 이벤트 `dispute.review_started`, `dispute.verifier_vote`.
- **(v2 문서·코드, 2026-05-09, V8-D/E/F)** Operator 콘솔 **`X-Bluesafe-Operator-Scopes`**, **`GET /v1/operator/runtime/auth-providers`**, **`GET /v1/operator/runtime/xrpl-operations`**, deep **`/health`** → `xrplOperations`; reputation **DLQ** `GET/POST /internal/reputation-delivery*`, **`docs/reputation-v2-consumer-guide.md`**; ADR `0013`/`0014`; 런북 `docs/runbooks/v8-xrpl-dr-topology.md`.
- **(v2 문서·코드, v6 확장)** 감사 **`GET /v1/audits`**·**`GET .../audits.ndjson`** 지연 샘플 Prometheus; **`POST /v1/reports/export-jobs`** / **`GET /v1/reports/export-jobs/:id`** 비동기 NDJSON; **`POST /v1/operator/disputes/review-sla-scan`**; 집행 **옵션 ledger submit**; **`/v1` Bearer/mTLS 가드**; KMS DEK **stub/HTTP unwrap**; Alertmanager **예시 규칙** `docs/prometheus/bluesafe-alerts.example.yml`.
- **(v2 문서·코드, 2026-05-09)** W4/W5: **`XRPL_SUBSCRIBE_TRANSACTIONS_STREAM`**, **`XRPL_SUBSCRIBE_LOG_RECONNECTS`**, **`/health?deep=1`의 `xrplTxPolicy`**(설정+누적 메트릭); 정책 소진 시 **`xrpl.tx_policy_exhausted`** 이벤트; ADR `docs/adr/0004`.
- **(v2 문서·코드, 2026-05-09)** v7-A/B: §3.2.1 Escrow 매핑 표; ADR `0005`/`0006`; `/internal/prometheus`에 **watcher SLO** 메트릭(`bluesafe_xrpl_watcher_*`, `bluesafe_xrpl_subscribe_connected`, `bluesafe_xrpl_backfill_account_tx_live_apply_total`); 예시 알럿·런북 `docs/runbooks/v7-subscribe-watcher-slo.md`.
- **(v2 문서·코드, 2026-05)** `PATCH /v1/contracts/:contractId/escrow-anchor`, **`GET /v1/events?eventType=`**, **`settlement.ledger_closed`** / **`contract.escrow_anchor_updated`** 이벤트, **`subscribe` `ledger` 스트림**, **`delayed_jobs` + tx policy claim**, **`BLUESAFE_AUTH`** MVP RBAC, **`npm run subscribe-soak`**·런북.
- **(v2 문서·코드, 2026-05)** v4 초기 구현: `/health?deep=1`·`HEALTH_DEEP_DEFAULT`, Escrows `marker` 쿼리, **xrpl-tx-policy** 워커(v1 §7.3), `pingStorage` / `pingRippled`, GitHub Actions Postgres 스모크.
- **(v2 문서 개정, 2026-05-09)** v3·v4 로드맵과 정합: **§1.1** 캔버스 요약, **§15–§17** 표(“상태 (v3·v4 기준)” 열), Document Info에 v3/v4 참조·Baseline **§13** 정정.
- Contracts API 추가; Dispute `evidenceIds`·`GET`; Execution에 `network`·`txHash` 응답
- XRPL: `account`, merge, `refresh`, backfill live/시뮬, **`GET .../accounts/:account/escrows`** (`account_objects`, `ledger_index: validated`)
- Events `GET`; Evidence `storageProvider`; 인메모리 한계 명시
- 오류코드 `B2_INTERNAL_ERROR`, **`B2_XRPL_UPSTREAM_ERROR`**; Health·smoke

---

*End of BlueSafe Backend2 API Spec v2*
