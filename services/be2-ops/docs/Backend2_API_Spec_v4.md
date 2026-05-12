# BlueSafe Backend2 API Spec v4

## 1. Document Info

- Version: `v4.0`
- Owner: `Backend2`
- Document type: **로드맵·성숙도 게이트(spec)** — v2의 **현행 API·도메인 전문**을 대체하지 않음; v3의 **구현 계획**을 계승하되 **v3에서 남은 과제와 캔버스 단계 2·3·6·W5–W8**을 v4 페이즈로 재정렬한다.
- Normative (현재 동작): `docs/Backend2_API_Spec_v2.md`
- Design baseline: `docs/Backend2_API_Spec_v1.md` (상태머신·분류기·이벤트 계약)
- Prior roadmap: `docs/Backend2_API_Spec_v3.md` (V3-A/B/C/D 산출물 기준선)
- Alignment: `bluesafe-backend2-plan.canvas.tsx` (유저플로우 1–6, P0/P1/P2, 패키지 A–E, 8주 가이드)
- **v2 동기화**: `docs/Backend2_API_Spec_v2.md` **§1.1·§15–§17**(및 Document Info 로드맵 포인터)는 v3·v4 본 문서와 **모순 없이 정렬**(2026-05-09 이후 개정).
- Status: `Planning — partial implementation in repo` — v4는 **메인넷 전 운영 준비**, **온체인 진실(truth)**, **정산·리포트**, **신원·평판 훅**을 범위로 한다. **다수 게이트는 코드에 선반영**(§13). **v4 이후 로드맵:** `docs/Backend2_API_Spec_v5.md`, `docs/Backend2_API_Spec_v6.md`, `docs/Backend2_API_Spec_v7.md`.

### 1.1 v3 대비 요약 (개발 상황 스냅샷)

| 영역 | v3 문서/코드 기준 | v4에서 다룰 갭 |
| --- | --- | --- |
| 영속화 | Postgres + 마이그레이션·repository | CI·스테이징에서 **스모크 동일 재현** 고정 |
| 알림 | 큐·워커·mock provider·DLQ 필드 | **FCM/APNs/Email** 실연동·웹훅(선택) |
| XRPL Watcher | `subscribe`(accounts)·멱등·`tx`/`account_tx`/refresh/escrows | **`ledger` 스트림·soak 런북 초안**·`account` 없는 트랙 복구 전략 |
| Tx 정책 | v1 §7.3 분류·백필 호출 존재 | **지연 DB 큐·claim**으로 표준 이행(외부 큐·메트릭은 ADR) |
| 캔버스 단계 2 | `escrowCreateTxHash` 미연결 | **`PATCH .../escrow-anchor`**·live `EscrowCreate` 검증 — **submit**은 여전히 Blockchain Lead |
| 캔버스 단계 3 | 월 정산 파이프라인 없음 | **`settlement.ledger_closed`** 이벤트; **월 집계·Payment**는 후속 |
| 캔버스 단계 6 | 목록·감사 일부 | **통계·보내기**·운영 대시보드용 집계 API |
| 인증·RBAC | 문서상 후속 | **`BLUESAFE_AUTH` + 헤더 역할(MVP)**; Bearer/mTLS·콘솔 분리 → **v4-F** |
| Reputation | 없음 | **오프체인 이벤트 버스** 또는 XLS-20/70/80 **브릿지 훅**(P2) |

### 1.2 v2 normative 문서와의 관계

- **현행 API·엔드포인트**는 계속 `docs/Backend2_API_Spec_v2.md` **§9**가 단일 소스다.
- **8주 로드맵·캔버스 대비 진척**은 **§15–§17**에서 읽되, 그 “현재/상태” 열은 **v3 구현분 + v4 계획**을 반영하도록 유지한다(본 v4 **§5·§10**과 쌍을 이룸).

---

## 2. Purpose of v4

v3가 **운영 가능한 백엔드**(영속화·알림 워커·subscribe·콘솔 최소 목록)에 초점을 맞췄다면, v4는 다음을 목표로 한다.

1. **온체인 진실**: 집행·에스크로 생성이 **실제 ledger hash**와 `validated` 결과에 의해 기록되도록 Blockchain Lead 경계와 Backend2 책임을 ADR로 고정한다.
2. **정산·스트림 성숙도**: 캔버스 단계 **3** — `subscribe` + `account_tx` 보정만으로는 부족한 **비즈니스 이벤트(월 정산 등)** 를 도메인 이벤트로 승격한다.
3. **장애·재시도 운영화**: 캔버스 **W5** — 분류기를 넘어 **지연 작업 큐**(DB 또는 외부 큐)·관측 가능한 DLQ·알림 연계.
4. **보안·컴플라이언스**: 인증·메인넷 게이트·감사 성능 기준·PII 최소화를 **완료 정의**에 포함한다.
5. **확장 레일(P1/P2)**: `@xrpl_signerlistset`, XLS-33/70/80, 내부·외부 지갑 가이드에 맞춘 **Verifier/운영 서명 모델** 및 **평판 브릿지** 옵션을 설계만이 아니라 **게이트 단위**로 쪼갠다.

v1 원칙(**validated 기준**, `tes/tec/tem/ter`, 감사·이벤트)은 유지한다.

---

## 3. Reference Docs (태그 세트 — v4 강조)

v2 `§3` URL·태그를 normative로 두고, v4 작업 시 **우선 읽을 묶음**만 아래에 정리한다. (중복 링크 나열는 v2에 위임.)

| 묶음 | 태그·주제 | v4에서의 용도 |
| --- | --- | --- |
| A. 트랜잭션·상태 | `@xrpl.js`, `@xrpl_http/wss`, `@xrpl_publicapimethods`, `@xrpl_escrow`, `@xrpl_escrowcreate`, `@xrpl_escrowfinish`, `@xrpl_escrowcancel` | 단계 2·5: **submit 이후** `tx`/`account_tx`/`account_objects`, **validated** 명시 ([xrpl.js 2.x migration — Validated Results](https://xrpl.org/docs/references/xrpljs2-migration-guide)) |
| B. 실패·플래그 | `@xrpl_teccodes`, `@xrpl_errorcodes`, `@xrpl_flags` | W5 큐·운영 알림 문구·사용자 노출 정책 |
| C. 증빙·메타 | `@xrpl_meta`, `@xrpl_nftoken`, `@xrpl_xls20`, `@xrpl_xls33` | 증빙 메타 확장·토큰화 옵션(ADR) |
| D. 신원·권한·평판 | `@xrpl_signerlistset`, `@xrpl_xls70`, `@xrpl_xls80` | Verifier 다중서명·Credential/SBT류 연동 **게이트** |
| E. 샘플·비즈니스·지갑 | `@xrpl_rwasto`, `@xrpl핵심기능별샘플코드typescript`, `@xrpl핵심기능별샘플코드python`, KFIP 샘플, `@xrpl내부지갑연동가이드라인`, `@xrpl외부지갑연동가이드라인`, 저장소 `XRPL기반서비스설계가이드.txt` | 온보딩·키 보관·submit 책임 분리 리뷰 |

---

## 4. v4 Scope (In / Out)

### 4.1 In scope (v4 게이트)

1. **V3 잔여 DoD 마감**: Postgres 기준 스모크를 CI(또는 문서화된 필수 job)로 고정; `subscribe` soak 또는 동등 부하·메모리 프로파일 1회 이상; 감사 목록 **p95 목표** 수치화.
2. **Tx policy 워커**: v1 `§7.2–7.3` — `pending_validation` 타임아웃, 재시도 백오프, `tx`/`account_tx` 트리거를 **`delayed_jobs` 테이블 + claim 워커**로 구현·관측(메트릭/로그 필드는 후속). *(코드: `xrpl-tx-policy.worker.ts` + `005_v4_delayed_jobs.sql`.)*
3. **EscrowCreate 연동(캔버스 단계 2)**: **`PATCH /v1/contracts/.../escrow-anchor`** 로 `escrowCreateTxHash` 및 rippled `tx`/`account_tx` 검증; 계약 `escrow_pending` → `escrow_validated` 전이. **합성 txHash** 집행 경로와의 하위호환 유지. **submit**은 Blockchain Lead 영역.
4. **집행 경로 실거래화(캔버스 단계 5 보강)**: Verifier/운영이 서명한 **EscrowFinish/Cancel**이 ledger에 올라간 뒤 Backend2가 트랙·분쟁 상태를 갱신(또는 기존 트랙 API로 수렴). *(MVP는 합성 `txHash` 기본.)*
5. **정산 파이프라인(캔버스 단계 3) — 최소**: `ledgerClosed` 스트림에서 **`settlement.ledger_closed`** 도메인 이벤트 저장·`GET /v1/events?eventType=` 조회. (예시 이름 `settlement.period_closed` 등 추가 이벤트·알림 훅은 ADR.)
6. **Operator Console 성숙도(캔버스 단계 6)**: 목록 API 위에 **집계·CSV/NDJSON export**(권한 분리), `GET …/escrows`의 **marker** 전달(v3 `§6.2` 예고 이행). *(코드: `marker` 쿼리 전달 완료.)*
7. **인증·RBAC**: `tenant` / `landlord` / `operator` / `verifier` 스코프; **`BLUESAFE_AUTH=1`** 시 헤더 기반 MVP RBAC; 스모크·로컬은 **non-prod**에서 `BLUESAFE_AUTH` 비활성 권장. Bearer/mTLS·IdP는 **v4-F**.
8. **Health / readiness**: `/health`에 DB·XRPL WSS 선택적 서브필드(운영 프로브). *(코드: `GET /health?deep=1`, `HEALTH_DEEP_DEFAULT`.)*

### 4.2 Out of scope (v4에서 다루지 않거나 후속 v4.x / 별도 서비스)

- 모바일·운영 콘솔 UI 자체.
- 메인넷 **비즈니스 승인** 판단(플래그·ADR만).
- 완전 자동화된 **Reputation SBT 온체인 민팅**(v4는 **이벤트 계약·아웃바운드 웹훅**까지만; 온체인은 P2 전용 마이크로서비스 가능).

---

## 5. Phased Delivery (v4 내부 페이즈)

캔버스 **W5–W8** 및 유저플로우 **2·3·6**과 정렬. 병렬 가능 항목은 팀 역량에 따라 조정.

| Phase | 목표 | 산출물 | 캔버스 매핑 |
| --- | --- | --- | --- |
| **V4-A** | v3 마감·검증 | Postgres CI 스모크, subscribe 부하/soak 런북, 감사 p95 기준 문서화 | W7 |
| **V4-B** | Tx policy 큐 | 지연 테이블 또는 외부 큐, DLQ 관측, v1 §7.3 단일 구현체 | W5 |
| **V4-C** | 온체인 생성·집행 | `escrowCreateTxHash`, 실제 Finish/Cancel 트랙, SignerListSet 설계(선택 구현) | 단계 2·5 |
| **V4-D** | 정산 스트림 | `ledger`/`transactions` 기반 정산 이벤트, 알림 연계 | 단계 3 |
| **V4-E** | 콘솔·리포트 | 집계 API, export, escrows marker | 단계 6 |
| **V4-F** | 보안·메인넷 | Auth/RBAC, `ALLOW_MAINNET_TRACKING`, mTLS 옵션 | 캔버스 §4·v2 §13 |

---

## 6. API / Domain Deltas (v4 예고)

`/v1/...` 호환을 기본으로 한다. 깨지는 변경은 `Accept-Version` 또는 `/v2/` ADR.

| 기능 | 방향 |
| --- | --- |
| 계약·에스크로 | **`PATCH /v1/contracts/:contractId/escrow-anchor`** 로 **`escrowCreateTxHash`** 및 rippled 검증(구현); 추가 `POST .../escrow`·웹훅은 ADR |
| 집행 | `POST .../execution` 응답의 `txHash`를 **클라이언트/서명기 제출 결과**로 받는 모드(플래그) |
| 정산 | **`GET /v1/events?eventType=settlement.ledger_closed`** 등(구현); `GET /v1/settlements`·추가 `settlement.*` 타입은 ADR |
| 콘솔 | `GET /v1/reports/summary?from&to` (예시) — 집계 차원은 제품과 함께 고정 |
| 인증 | **`BLUESAFE_AUTH=1`** 시 **401/403** + 헤더 역할(구현); Bearer/mTLS·IdP는 **v4-F** |
| Health | `{ "db": "ok"|"skip", "xrpl": "ok"|"disabled"|"degraded" }` 등 — **`GET /health?deep=1` 구현됨**(v2 §9.0) |

---

## 7. XRPL (v4 상세)

### 7.1 Submit 경계

- **Backend2**: 트랙·검증·상태머신·감사·알림.
- **지갑/서명기**(내부·외부 가이드라인 참조): 트랜잭션 직렬화·서명·submit 또는 XUMM/Girin 등 위임.
- ADR: “Backend2가 **절대 마스터 시크릿을 보관하지 않는다**” vs “HSM 내 특정 역할만” 등.

### 7.2 SignerListSet

- Verifier 다수결·운영 긴급 키 회전 시 [@xrpl_signerlistset](https://js.xrpl.org/interfaces/SignerListSet.html)와 rippled 문서를 따라 **quorum/weight** 모델을 명문화.

### 7.3 정산 스트림

- `subscribe`의 [`ledgerClosed`](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe) 등으로 **기간 경계**를 잡고, 금액 집계는 **오프체인 원장** 또는 별도 회계 DB에 기록(온체인 Payment와 혼동 금지).

### 7.4 XLS·NFT·메타 (P2 훅)

- `@xrpl_xls20`, `@xrpl_xls70`, `@xrpl_xls80`, `@xrpl_meta`: v4 범위는 **아웃바운드 이벤트 페이로드 스키마**와 **멱등 키**; 실제 민팅은 별도 마일스톤.

---

## 8. Notification & Operations (v4)

- 실제 푸시/메일 provider SLA·템플릿 버전·바운스 처리.
- 정산·에스크로 실패·DLQ는 **운영자에게** 별도 채널(심각도 구분).

---

## 9. Security (v4 게이트)

- RBAC + **객체 수준 필터**(테넌트는 자기 `contractId`만).
- 시크릿·키 로테이션 런북.
- 메인넷: `ALLOW_MAINNET_TRACKING` + 별도 **비즈니스 플래그** 이중 확인.

---

## 10. Definition of Done — v4

- [x] **Postgres 스모크 CI**: `.github/workflows/ci.yml` — `DATABASE_URL` + 서비스 Postgres에서 `npm run build` + `npm run smoke`.
- [x] **Live XRPL 통합 테스트** 1건 CI 또는 수동 런북. *(수동: `npm run xrpl-live-probe`; CI: `workflow_dispatch` + secret `XRPL_WSS_URL` — secret 없으면 job skip)*
- [x] **subscribe soak/부하** 런북·**요약 JSON 한 줄**(`subscribe-soak.mjs`, `SUBSCRIBE_SOAK_REPORT_PATH`). *(장기 24h·CI 고정 수치는 선택)*
- [x] v1 `§7.3` 타임아웃→`tx` / `account_tx` — **`delayed_jobs` 큐 + claim** (`xrpl-tx-policy.worker.ts`, `005_v4_delayed_jobs.sql`).
- [ ] 캔버스 단계 **2**: 테스트넷에서 **submit까지 포함한** E2E(현재는 앵커·검증 API 중심).
- [ ] 캔버스 단계 **5**: 최소 1개 플로우에서 집행 `txHash`가 **합성이 아닌** ledger 연계 모드로 검증 가능.
- [x] 캔버스 단계 **3**(최소): **`settlement.ledger_closed`** 저장·`eventType` 조회.
- [ ] 캔버스 단계 **6**: 운영 집계 또는 export API 1종 이상.
- [ ] 인증: 프로덕션 경로에서 **Bearer/mTLS·IdP** 기반 접근 통제(현재 **`BLUESAFE_AUTH` 헤더 MVP**).
- [x] `docs/Backend2_API_Spec_v2.md` **§1.1·§15–§17**(로드맵·유저플로우·모듈 표)를 v3·v4 기준으로 개정하여 **문서 간 모순 제거**(§18 Changelog 본문과 별개 구간).

---

## 11. Open ADRs (v4 착수 전·중 결정)

1. Tx 큐: **DB 폴링만**으로 v4-B를 끝낼지, **SQS/Redis**를 도입할 시점.
2. 정산 이벤트: **ledger 기준** vs **달력 기준** vs 혼합.
3. 집행: **동기 submit**(Backend2가 rippled에 `submit` 대리) vs **비동기 서명 큐**(권장 쪽 명시).
4. 공개 ID(`ctr_*`) 유지 기간과 UUID 병행 정책.
5. Reputation: **웹훅 전용** vs **동일 프로세스 내 모듈**.

---

## 12. Changelog (v3 → v4, planned)

- v2 **§1.1·§15–§17** 및 Document Info의 v3/v4 포인터를 **v3·v4와 동기화**(로드맵 “현재” 열에 V3-A/B/C/D 반영, “다음”에 V4-A~F 매핑). v2 Baseline 참조 **§19→§13** 오기 정정.
- v4 문서 신설: v3 **부분 완료** 상태를 기준선으로 삼고 **온체인·정산·큐·인증·리포트**를 다음 게이트로 승격.
- v3-E(EscrowCreate)를 v4-C에 **흡수**하여 “선택 페이즈”가 아닌 **릴리스 게이트** 후보로 명시.
- 캔버스 패키지 **D**(XLS-70/80, SignerListSet)를 v4-F 및 P2 훅과 연결.
- **(코드, v4.0)** CI Postgres 스모크, `/health?deep=1`, Escrows `marker`, **`delayed_jobs` + tx policy claim**, **`subscribe` `ledger` + `settlement.ledger_closed`**, **`PATCH .../escrow-anchor`**, **`GET /v1/events?eventType=`**, **`BLUESAFE_AUTH`**, `subscribe-soak` 런북/스크립트.

---

## 13. Code landed (v4.0 — partial)

| 항목 | 위치 | 비고 |
| --- | --- | --- |
| V4-A CI | `.github/workflows/ci.yml` | `main`/`master` push·PR |
| V4-F readiness | `GET /health?deep=1`, `HEALTH_DEEP_DEFAULT` | `pingStorage`, `xrplService.pingRippled` (`server_info`) |
| V4-E marker | `GET /v1/xrpl/accounts/:account/escrows?marker=` | `accountEscrowsQuerySchema`, rippled `marker` 전달 |
| V4-B | `005_v4_delayed_jobs.sql`, `xrpl-tx-policy.worker.ts` | stale 트랙 → `delayed_jobs` → claim 후 `tx`/`account_tx`; 미발견 N회 시 `manual_review` + 감사 |
| V4-D (최소) | `xrpl-subscribe.worker.ts` | `streams: ["ledger"]` + `settlement.ledger_closed` 이벤트 |
| V4-C (앵커) | `PATCH /v1/contracts/:contractId/escrow-anchor` | v2 §9.1 |
| V4-F (MVP RBAC) | `src/auth.ts`, `BLUESAFE_AUTH` | 역할·스코프 헤더; Bearer/mTLS는 후속 |

---

*End of BlueSafe Backend2 API Spec v4 (planning)*
