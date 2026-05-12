# BlueSafe Backend2 API Spec v3

## 1. Document Info

- Version: `v3.0`
- Owner: `Backend2`
- Document type: **다음 구현 계획(roadmap spec)** — v2의 API·도메인 전문을 대체하지 않음
- Extends: `docs/Backend2_API_Spec_v2.md` (현행 동작·엔드포인트의 단일 소스)
- Baseline design: `docs/Backend2_API_Spec_v1.md` (W1 계약·상태머신·분류기 원칙)
- Alignment: `bluesafe-backend2-plan.canvas.tsx` (유저플로우 1–6, P0/P1/P2, 8주 순서)
- Status: `V3-A/B/C/D + v4-B/C/D partial (code)` — V3-A/B + **`subscribe` 워커(accounts + `ledger`)** + **멱등** `xrpl_ingestion_events` + **Console 목록 API** + **`delayed_jobs` tx policy** + **escrow-anchor PATCH** + **옵션 RBAC(`BLUESAFE_AUTH`)** + **정산형 이벤트 `settlement.ledger_closed`**. Live 통합 테스트·24h soak·감사 p95·월 집계 파이프라인은 미완. **후속 로드맵:** `docs/Backend2_API_Spec_v5.md`, `docs/Backend2_API_Spec_v6.md`, `docs/Backend2_API_Spec_v7.md`.

### 1.1 v2 대비 현재 진행 상황 (요약)

| 영역 | v2 코드 상태 | 캔버스 목표 대비 |
| --- | --- | --- |
| 계약·증빙·분쟁·판정·집행·트랙·감사·이벤트 | E2E 스모크 통과 | 1·4·5 단계 충족 |
| Escrow 온체인 생성·`escrowCreateTxHash` | **`PATCH .../escrow-anchor`** + live 검증으로 **부분 연결** | 단계 **2**: submit은 범위 밖; 앵커·상태 동기 **일부 달성** |
| `subscribe`·월 정산 스트림 | `accounts` + **`ledger`**, `settlement.ledger_closed` 이벤트 | 단계 **3**: 원장 이벤트 **최소 달성**; **월 집계·Payment**는 미달 |
| Watcher | `tx`, `account_tx`, `refresh`, `GET …/escrows`, **`subscribe`(accounts+ledger, 멱등)** | `account` 없는 트랙은 폴링·백필 의존 |
| Tx 재시도 큐 | **`delayed_jobs`** + policy worker claim | W5 목표 **부분 달성**(DB 폴링 큐; 외부 큐는 ADR) |
| Notification | `queued`→워커→`sent`/`retry_scheduled`/`failed`(DLQ); `GET /v1/notifications/:id` | 외부 푸시·메일 provider 미연동(mock) |
| 저장소 | 인메모리(기본) 또는 `DATABASE_URL` Postgres | V3-A 진행 중(스모크는 기본 경로) |
| Operator Console·리포트 | **목록 API(페이지네이션·필터)**; **옵션 헤더 RBAC** | 단계 **6**·P1 일부; 집계·export는 **v4-E** |
| Reputation (XLS-20/70/80 브릿지) | 없음 | P2 |

---

## 2. Purpose of v3

v3는 **운영 가능한 Backend2**로 올리기 위한 **구현 게이트**를 정의한다.

- v1의 설계 원칙(validated 상태, `tes/tec/tem/ter`, 감사·이벤트)을 **유지**한다.
- v2에서 증명된 API 표면은 **최대 호환**하되, 영속화·인증·백그라운드 작업이 붙으면서 **마이그레이션·버전 정책**이 필요하다.
- 캔버스의 **W4–W8** 및 유저플로우 **2·3·6**을 v3 범위에 명시한다.

---

## 3. Reference Docs (태그 세트 — v3 구현 시 동일 계열)

v2 §3과 동일한 패키지를 전제로 하며, v3 작업 시 우선순위만 강조한다.

| 우선순위 | 태그 / 주제 | v3에서 쓰는 지점 |
| --- | --- | --- |
| P0 | `@xrpl.js`, `@xrpl_http/wss`, `@xrpl_publicapimethods` (`tx`, `account_tx`, `account_objects`, **`subscribe`**) | Watcher 워커·정산 스트림 |
| P0 | `@xrpl_escrowcreate`, `@xrpl_escrowfinish`, `@xrpl_escrowcancel`, `@xrpl_escrow` | 단계 2·5 온체인 연동 |
| P0 | `@xrpl_teccodes`, `@xrpl_errorcodes`, `@xrpl_flags` | 재시도·DLQ·운영 알림 문구 |
| P1 | `@xrpl_signerlistset` | 다중서명·Verifier 운영 모델 |
| P2 | `@xrpl_meta`, `@xrpl_nftoken`, `@xrpl_xls20`, `@xrpl_xls33`, `@xrpl_xls70`, `@xrpl_xls80` | 증빙 메타·Reputation 브릿지 |
| E | `@xrpl_rwasto`, TS/Python 샘플, KFIP, 내부/외부 지갑 가이드, `XRPL기반서비스설계가이드.txt` | 구현·리뷰·데모 |

공식 URL 목록은 **v2 §3**을 normative로 따른다(v3에서 중복 나열하지 않음).

---

## 4. v3 Scope (In / Out)

### 4.1 In scope (v3 게이트에서 완료 대상)

1. **Postgres** 영속화 (또는 동등 RDB), 스키마 마이그레이션, repository 계층; 프로세스 재시작 후 데이터 보존.
2. **Notification Hub**: provider 인터페이스(FCM / APNs / email 등), `queued` → 전송 → `failed` / `retry_scheduled`, 백오프·최대 재시도·DLQ(또는 dead topic).
3. **XRPL**: `XRPL_WSS_URL` 기반 **통합 테스트**(CI 또는 문서화된 런북); **`subscribe`** 기반 워커(또는 별도 프로세스)로 validated 트랜잭션/원장 이벤트 수신 + **멱등 키**(예: `ledger_index` + `txHash` + `eventType`).
4. **Tx policy 모듈**: v1/v2 §7.3 — `pending_validation` 타임아웃 후 `tx` / `account_tx` 프로브를 **`delayed_jobs` 큐 + claim 워커**로 이행(마이그레이션 `005_v4_delayed_jobs.sql`).
5. **감사 API**: `GET /v1/audits`에 시간 범위 `from` / `to`(ISO) 필터 및 인덱스 전제.
6. **Operator Console API (최소)**: 계약·분쟁·트랙 목록 페이지네이션 + 필터(상태·기간·tenant 등) — UI는 범위 밖.

### 4.2 Out of scope (v3에서 다루지 않거나 후속)

- 모바일·콘솔 프론트엔드.
- 메인넷 **운영 승인 게이트**의 비즈니스 판단(ADR에 기록만).
- Reputation SBT 온체인 반영(P2 전용 v3.x 또는 별도 서비스).

---

## 5. Phased Delivery (권장 순서)

캔버스 8주와 정렬한 **v3 내부 페이즈**. 병행 가능한 항목은 병렬 스프린트로 조정한다.

| Phase | 목표 | 산출물 | 캔버스 매핑 |
| --- | --- | --- | --- |
| **V3-A** | 영속화 | Postgres 스키마, `pg` 또는 Prisma, seed, 기존 API가 DB를 사용 | 인프라 전 주차 |
| **V3-B** | 알림 | Provider 모듈, 큐 테이블 또는 외부 큐, 관리용 재시도 API(선택) | W6 일부 |
| **V3-C** | XRPL 워커 | `subscribe`(accounts) + 재연결 + `xrpl_ingestion_events` 멱등 + `applyLiveTxStatus` 공유 | W4·W5 |
| **V3-D** | 운영 API | Audits 시간 필터(기존), Console 최소 목록/필터 — **`GET /v1/contracts`**, **`GET /v1/disputes`**, **`GET /v1/xrpl/transactions`** + `004_operator_list_indexes.sql` | W6·단계 6 |
| **V3-E** (선택) | EscrowCreate 연동 | `escrowCreateTxHash` 채움, Blockchain Lead와 submit 경계 문서화 | 단계 2 |

---

## 6. API / Domain Deltas (v3에서 예고하는 변경)

v2 경로(`/v1/...`)는 **가능하면 유지**. 호환이 깨지면 `Accept-Version` 또는 `/v2/...` 도입을 ADR에 기록.

### 6.1 공통

- **인증**: v2 normative는 `Authorization: Bearer ...` 또는 mTLS를 예고했으나, **현재 구현**은 `BLUESAFE_AUTH=1` 시 **헤더 기반 RBAC**(`X-Bluesafe-Role`, 스코프 헤더) — v2 §11.2·v4-F 참고.
- **페이지네이션**: 목록 API에 `cursor` 또는 `offset`/`limit` 표준화.
- **Id**: DB surrogate UUID와 기존 `ctr_` / `dsp_` 공개 id 병행 여부를 ADR에서 결정.

### 6.2 신규 또는 확장 (예정)

| 기능 | 방향 |
| --- | --- |
| Audits | `from`, `to` 쿼리; DB 인덱스 `(entityType, entityId, createdAt)` |
| Console lists | `GET /v1/contracts`, `GET /v1/disputes`, `GET /v1/xrpl/transactions` — `limit`/`offset` + 상태·tenant·기간·`contractId`·`account`·`validated`·`network` 등(v2 §9 반영) |
| Escrows 목록 | `GET …/escrows`에 **`marker`** 쿼리(또는 POST body)로 rippled 페이지네이션 전달 — **구현됨** |
| Contract escrow | **`PATCH /v1/contracts/:id/escrow-anchor`** 로 `escrowCreateTxHash` + rippled live 검증(선택) — **구현됨** |
| Events | **`GET /v1/events?eventType=`** — **구현됨** |
| Notifications | 발송 비동기화; 웹훅/폴링으로 전송 상태 조회(선택) |
| Health | `/health`에 DB·XRPL 연결 readiness 서브필드(선택) |

### 6.3 Contract / Dispute (온체인 연동 시)

- **`PATCH /v1/contracts/:contractId/escrow-anchor`** 로 **`escrowCreateTxHash`** 설정 및 live `EscrowCreate` 검증(v2 §9.1) — **구현됨**. 집행 `txHash`를 합성이 아닌 **실제 submit 결과**로 교체하는 플로우(ADR)는 후속.

---

## 7. XRPL Watcher (v3 상세 요구)

### 7.1 subscribe

- [subscribe](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe) — 최소 `streams`: `["ledger"]` 또는 `["transactions"]` 중 제품 결정.
- **구현(v3-C, 현재):** 별도 WSS `Client`로 **`command: "subscribe", streams: ["ledger"], accounts: [...]`**(accounts는 선택) — 계정 목록은 `xrpl_txs` 중 `validated = false` 이고 `account`가 있는 행에서 유도(`listXrplSubscribeAccounts`, 주기적 갱신). `transaction` 스트림에서 `validated === true`인 항목만 처리; 멱등 키 `(ledger_index, tx_hash, event_source)` / `event_source = xrpl_subscribe_transaction`. **`ledgerClosed`** 스트림은 멱등 키 `xrpl_subscribe_ledger_closed` + 합성 `tx_hash`로 **`settlement.ledger_closed`** 도메인 이벤트 기록. `applyLiveTxStatus`는 `src/services/xrpl-tx-reconcile.ts`에서 공유.
- 연결 끊김 시 exponential backoff 재연결; 중복 이벤트는 **멱등 저장**(테이블 유니크 제약 또는 Redis SETNX).
- v3-C 한계: 트랙에 `account`가 없으면 스트림으로는 갱신되지 않음 → `tx` / `refresh` / `account_tx` 백필 유지.

### 7.2 폴링과의 관계

- 기존 `tx` / `account_tx` / `account_objects`는 **보정(backfill)** 및 subscribe 누락 시 복구에 사용.
- v1/v2 §7.3 타임아웃 정책을 워커 타이머와 통합.

### 7.3 테스트

- Testnet 고정 계정 또는 dockerized rippled가 아닌 경우: **문서화된 런북** + CI `workflow_dispatch`로 `XRPL_WSS_URL` 주입 job.

---

## 8. Notification Hub (v3 상세 요구)

- 상태: `queued` → `sent` | `failed` | `retry_scheduled` (v1 도메인 유지).
- **구현(v3-B):** DB 테이블 `notifications`에 `attempt_count`, `next_attempt_at`, `last_error`, `dead_letter`, `updated_at`(`002_notification_hub.sql`). API: `POST /v1/notifications` → `202`/`queued`; 워커가 `NotificationProvider`로 전송·지수 백오프 재시도·`NOTIFICATION_MAX_ATTEMPTS` 초과 시 `failed`+DLQ. `GET /v1/notifications/:id`로 상태 조회.
- Provider별 타임아웃·HTTP 재시도 정책 분리(현재 `mock` provider; `NOTIFICATION_PROVIDER_MODE`로 실패 시뮬레이션).
- PII는 payload 최소화; v1 §11 PII·memo 금지 유지.

---

## 9. Security & Operations (v3 게이트)

- RBAC 최소 역할: `tenant`, `landlord`, `operator`, `verifier` (v1 §11). **구현:** `BLUESAFE_AUTH=1` + 헤더 기반 스코프(v2 §11.2); Bearer/mTLS는 v4-F.
- 시크릿: DB URL, Pinata JWT, FCM 키 등 — **환경 변수 + 비밀 저장소**; 리포지토리에 비밀 금지.
- 메인넷: 별도 플래그 `ALLOW_MAINNET_TRACKING` 등 ADR 후 도입.

---

## 10. Definition of Done — v3

- [ ] 모든 v2 스모크 시나리오가 **Postgres 기준**으로 동일 재현(`DATABASE_URL` 주입 CI 또는 로컬 DB로 검증 필요).
- [x] 알림 1건이 `queued`로 기록된 뒤 provider 실패 시 재시도·최종 `failed` 또는 DLQ 기록(스모크: 기본 provider 성공 경로; `fail_first`/`fail_always`·`NOTIFICATION_MAX_ATTEMPTS`로 실패·DLQ 검증 가능).
- [ ] `subscribe` 워커가 최소 24h soak 또는 동등 부하 테스트에서 메모리 누수·중복 이벤트 없이 동작(런북에 기록). *(코드: 멱등 INSERT + 메모리 Set; **초기 soak 스크립트·런북** `docs/runbooks/v4-subscribe-soak.md` 제공, 수치·24h는 미수행)*
- [x] `GET /v1/audits`에 `from`/`to`(ISO) 적용; Postgres 경로에 `created_at`·복합 인덱스.
- [x] Operator Console 최소 목록: 계약·분쟁·XRPL 트랙 `limit`/`offset` + 필터(v2 §9.1·9.3·9.4); Postgres 보조 인덱스 `004_operator_list_indexes.sql`.
- [ ] 감사 목록 성능 기준(예: p95 < 500ms @ N건) 측정·문서화.
- [ ] Live XRPL 통합 테스트 1개 이상 CI 또는 수동 런북 통과.
- [x] `docs/Backend2_API_Spec_v2.md`에 v3에서 확정된 API·로드맵 표(**§1.1·§15–§17**) 반영; 이후 본 문서를 `Implemented`로 갱신할 때 v4 **§10**과 중복 체크리스트 정리.

---

## 11. Open ADRs (v3 착수 전 결정)

1. ORM: **Prisma vs `pg` + 수동 SQL**.
2. 큐: **DB 테이블만** vs **Redis / SQS** 등 외부 큐.
3. subscribe 워커: **API 프로세스 내** vs **별도 worker 프로세스**.
4. 공개 ID(`ctr_*`) vs UUID 단일화.
5. IPFS 보존·언핀 정책(캔버스 권장 문서 #1).

---

## 12. Changelog (planned) v2 → v3

- **(landed)** `src/repository/*`, `db/migrations/001_init.sql`, `DATABASE_URL` 게이트, 비동기 `writeAudit`/`emitEvent`, `GET /v1/audits?from=&to=`.
- 영속 저장소 도입으로 재시작 내구성 확보.
- **(landed V3-B)** 알림 큐·워커·`NotificationProvider`(`success`/`fail_first`/`fail_always`)·`GET /v1/notifications/:id`·마이그레이션 `002_notification_hub.sql`.
- **(landed V3-C)** `src/services/xrpl-subscribe.worker.ts`, `xrpl_ingestion_events`, `listXrplSubscribeAccounts` / `tryRecordXrplIngestionEvent`, `xrpl-tx-reconcile.ts`.
- **(landed V3-D)** `GET /v1/contracts`, `GET /v1/disputes`, `GET /v1/xrpl/transactions`(페이지네이션·필터); `db/migrations/004_operator_list_indexes.sql`.
- **(landed v4-B/C/D, 코드)** `delayed_jobs`(`005_v4_delayed_jobs.sql`) + `xrpl-tx-policy.worker` claim, **`ledger` subscribe** + `settlement.ledger_closed`, **`PATCH .../escrow-anchor`**, **`GET /v1/events?eventType=`**, **`BLUESAFE_AUTH`**(헤더 MVP).
- Bearer/mTLS·정식 IdP·운영 readiness 추가 항목은 **v4-F** 등 후속.

---

*End of BlueSafe Backend2 API Spec v3 (planning)*
