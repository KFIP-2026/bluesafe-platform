# BlueSafe Backend2 API Spec v5

## 1. Document Info

- Version: `v5.0`
- Owner: `Backend2`
- Document type: **다음 구현 로드맵(spec)** — v1 설계 원칙·v2 **현행 API(§9 normative)**·v3 구현 게이트·v4 성숙도 게이트를 계승하고, **v4 §10에서 미완([ ])인 항목**과 **유저플로 2·3·4·6·7**을 메우는 **개발 단계**를 한 문서에 고정한다.
- Normative (엔드포인트·요청/응답 세부): `docs/Backend2_API_Spec_v2.md` — v5에서 **신규 공개 API**를 확정하면 v2 §9에 **역병합**하거나, 본 문서 **§6** + ADR로 임시 고정 후 다음 v2 개정에서 합류한다.
- Design baseline: `docs/Backend2_API_Spec_v1.md`
- Prior roadmap: `docs/Backend2_API_Spec_v3.md`, `docs/Backend2_API_Spec_v4.md`. **후속 로드맵:** `docs/Backend2_API_Spec_v6.md` (v5 미완·온체인·감사·알림 심화), `docs/Backend2_API_Spec_v7.md` (v6 이후 SLO·프로토콜 정합·규제 친화 export·P2 표준).
- Alignment: `bluesafe-backend2-plan.canvas.tsx` (유저플로·P0–P2·8주 가이드)
- Status: `Planning — V5-A/B/D(MVP)/F partial in code (2026-05-09); normative API surface still v2 §9`
- **(코드, v4 이후 착지 요약)** `subscribe` 옵션 `transactions` 스트림·rate cap, `GET /internal/prometheus`, outcome/Prometheus 메트릭, `POST /v1/notifications/dispatch`, 이메일/푸시 **웹훅**·재시도 env, 증빙 `GET …/content`·복호화·`retain_until` **운영자 retention 배치**, 분쟁 SLA 필드·투표 테이블·에스컬레이션·`GET /v1/operator/stats/summary` 등 — **본 v5 게이트에 포함되지 않은 “이미 착지한 P0 보강”**으로 취급하고, v2 §9·env 표 동기화는 별 작업으로 남긴다.

---

## 2. Purpose of v5

v4가 **운영 준비·온체인 진실·정산 스트림·큐·리포트·보안**을 게이트로 쪼갰다면, v5는 **제품 유저플로를 끝까지 연결**하는 단계다.

1. **월 정산 도메인**(캔버스 단계 **4**, P0): `settlement.ledger_closed`를 넘어, **기간(월)별 엔티티·상태머신·집계 저장**과 **이벤트 → 정산 상태 갱신** 로직을 구현한다.
2. **알림 허브 제품화**(P0): 도메인 규칙(정산 확정·지급 예정·분쟁·만료·환급)에 맞춘 **자동 enqueue**와 실제 운영 수준의 **provider·템플릿·SLA**(웹훅을 넘어선 연동은 ADR).
3. **온체인 집행 라인**(캔버스 단계 **5·6**, v4 미완): **EscrowFinish / EscrowCancel** 실제 ledger `txHash`와 트랙·분쟁 상태의 **1:1 검증**; 합성 해시 MVP **교체 또는 병행 플래그**.
4. **운영 콘솔·리포트**(P1, v4 미완): 기간·테넌트·정산·분쟁·XRPL **통합 집계**, **export**(CSV/NDJSON), RBAC **세분 권한**.
5. **증빙·감사 운영 고도화**: Pinata **핀 실패 재시도·unpin**, **KMS 연동**(env 키 외), 감사 **대량 조회·보관·export·p95** 목표.
6. **P2 Reputation 브릿지**: 판정·종료 이벤트를 **SBT/외부 레퍼러스**로 넘기는 **스키마·아웃바운드 어댑터**(온체인 민팅 전체는 별 마일스톤).

공식 XRPL·Escrow 레퍼런스 태그 세트는 **v2 §3**을 normative로 따른다(v5에서 URL 목록을 중복하지 않음).

---

## 3. Relationship to v1–v4

| 문서 | v5에서의 역할 |
| --- | --- |
| **v1** | validated·`tes/tec/tem/ter`·감사 원칙 — **변경 없음** |
| **v2** | `/v1/...` 계약 — v5 구현 후 **§9·env·§1.1** 업데이트 대상 |
| **v3** | 영속화·subscribe·policy·콘솔 목록 등 — **대부분 완료**; 외부 알림 provider 등 일부는 v5로 이월 |
| **v4** | §10 DoD의 **[x]**는 v5 전제선, **[ ]**는 v5 **필수 과제**로 승격 |

---

## 4. v5 Scope (In / Out)

### 4.1 In scope

1. **정산(월) 도메인**: 테이블(또는 동등 모델)·상태 전이·API·이벤트 소비·(선택) 배치 크론.
2. **알림**: 도메인 이벤트 구독 → 큐 row 생성·재시도·DLQ 운영 규칙 문서화.
3. **집행**: 실 ledger 연계 모드·ADR·하위호환(합성 경로 제거 또는 플래그).
4. **리포트·export·RBAC 심화**.
5. **증빙·감사**: 핀/unpin·KMS·감사 성능.
6. **Reputation 훅**(최소: 이벤트 페이로드 + 웹훅 또는 내부 모듈 인터페이스).

### 4.2 Out of scope (v5.x 또는 별도 서비스)

- 운영 콘솔 **UI** 제품 전체.
- 메인넷 **비즈니스 승인** 판단(플래그·ADR만).
- Reputation **온체인 민팅** 전체 자동화(훅만 v5, 민팅은 P2 마이크로서비스 가능).

---

## 5. Phased Delivery (v5 내부 페이즈)

캔버스·P0 우선순위와 정렬한 **권장 구현 순서**. 병렬 가능한 항목은 팀에 맞게 조정한다.

| Phase | 목표 | 산출물 | 유저플로 / 모듈 |
| --- | --- | --- | --- |
| **V5-A** | 월 정산 도메인 | `settlements`(가칭) 스키마·상태머신·`GET`(목록/단건)·이벤트 핸들러·감사 | 단계 **3·4** |
| **V5-B** | 알림 제품화 | 정산/분쟁/만료/환급 **자동 dispatch** 규칙·템플릿 버전·provider SLA 런북 | P0 Notification |
| **V5-C** | 온체인 집행 | 실 `EscrowFinish`/`Cancel` 트랙·검증·분쟁 `execution_pending` 연동 강화 | 단계 **5·6** |
| **V5-D** | 콘솔·리포트 | 집계 API·NDJSON 감사 export·(후속) CSV·세분 RBAC | P1 Operator, 단계 **7** |
| **V5-E** | 증빙·감사 규모 | Pinata 재시도·unpin 잡·KMS·감사 페이지네이션·p95 | P0 Evidence, P1 Audit |
| **V5-F** | Reputation 브릿지 | 아웃바운드 이벤트 스키마·멱등 키·어댑터(웹훅 권장) | P2 |

---

## 6. API / Domain Deltas (v5 예고)

`/v1/...` 호환을 기본으로 한다. 하위호환을 깨면 ADR + v2 Changelog.

| 기능 | 방향 |
| --- | --- |
| 정산 | `GET /v1/settlements`·`GET /v1/settlements/:id` (예시) — 기간·계약·상태 필터; v5-A에서 경로·필드 확정 |
| 정산 상태 | `settlement.*` 이벤트 수신 시 엔티티 갱신 + (V5-B) 알림 row 생성 |
| 집행 | `POST …/execution` 또는 트랙 등록 시 **실 해시 모드** 플래그·검증 단계 명문화 |
| 리포트 | `GET /v1/reports/summary?from&to&tenantId=…` — `global`(전체 스냅샷) + `scoped`(기간·테넌트 범위 집계); `GET /v1/reports/audits.ndjson` — 감사 NDJSON 스트리밍 export (`limit` 상한) |
| Export | `GET /v1/reports/audits.ndjson` 또는 비동기 export 잡 — 권한·용량 상한 ADR |
| 인증 | v4-F 잔여: **Bearer/mTLS·IdP** — v5-D와 병행 가능 |
| Reputation | `POST /internal/reputation-events` 또는 메시지 큐 — **멱등 키** 필수 |

---

## 7. User Flow Checklist (Backend2 확정안 대비)

| 단계 | 설명 | v5 목표 |
| --- | --- | --- |
| 1 | 계약 등록·증빙·CID | v5-E: 핀·KMS·운영 품질; v2 동기화 |
| 2 | Escrow 생성·validated | v5-C: submit~앵커 **E2E 규약**(역할 분리 문서화 포함) |
| 3 | 상태 동기화 | v4 기반 유지 + v5-A: **누락 감지 지표**(정산 관점) |
| 4 | 월 정산 | **V5-A 핵심** |
| 5 | 분쟁 | v5-B: SLA·타임아웃·자동 알림; 검증자 정책 제품 규칙 고정 |
| 6 | 판정/집행 | **V5-C** |
| 7 | 종료/리포트 | **V5-D** |

---

## 8. Definition of Done — v5

v4 §10의 미완을 흡수·구체화한다.

- [x] **V5-A (MVP)**: 월(UTC 달력) **정산 엔티티** `settlements` 테이블·상태(`collecting`→`accrued`→`confirmed`→`archived`)·`GET /v1/settlements`·`GET /v1/settlements/:id`·`PATCH /v1/settlements/:id/status`(operator); `settlement.ledger_closed` 이후 **`touchSettlementsOnLedgerClose`** + **`settlement.period_touched`** 이벤트( `active` / `escrow_validated` 계약만 터치).
- [x] **V5-B (MVP)**: `confirmed` 전환 시 **테넌트·랜드로드**에 대해 `settlement.confirmed` 알림 **채널별 큐 row** 자동 생성(`SETTLEMENT_AUTO_NOTIFY_ON_CONFIRMED`, 기본 on). (운영 런북·템플릿 버전 관리는 후속.)
- [ ] **V5-C**: 테스트넷에서 submit 포함 E2E·실 ledger 집행 검증.
- [x] **V5-D (MVP)**: `GET /v1/reports/summary`(전역 `global` + 창 `scoped` 집계) + `GET /v1/reports/audits.ndjson`(페이지네이션 스트리밍·`limit`≤100k). CSV·비동기 export·RBAC 세분은 후속.
- [ ] **V5-E**: Pinata 재시도·unpin·감사 p95.
- [x] **V5-F (stub)**: `POST /internal/reputation-events` — 멱등 키·subject·payload 수신 시 감사 + `reputation.outbound_queued` 이벤트(옵션 `METRICS_SCRAPE_TOKEN` Bearer). 온체인 민팅 없음.
- [ ] **v2 동기화**: 신규 엔드포인트·env를 `Backend2_API_Spec_v2.md` §9·env 표에 반영.

### V5 구현 시 참고 (XRPL 태그)

Escrow·원장 시간·`subscribe`·검증 결과는 **v2 §3** normative 링크(`@xrpl.js`, `@xrpl_escrow*`, `@xrpl_publicapimethods`, `@xrpl_teccodes`, `@xrpl_errorcodes`, SignerList·XLS 훅 등)를 따른다. 정산 월 경계는 본 MVP에서 **Ripple `ledger_time`(Ripple epoch) → UTC 달력 월**으로 변환한다(`src/services/settlement-ledger.ts`).

---

## 9. Open ADRs (v5 착수 전·중)

v4 §11을 계승하고 v5에서만 결정할 항목을 추가한다.

1. 정산 주기: **달력 월** vs **ledger 기간** vs 혼합.
2. 정산·알림: **동기 이벤트 핸들러** vs **Outbox + 워커**.
3. 집행: Backend2 **submit 대리** vs **외부 서명 큐만** (v1 §4.2 정렬).
4. Export: **동기 스트리밍** vs **비동기 잡 + 다운로드 URL**.
5. Reputation: **전용 웹훅** vs **공용 이벤트 버스 토픽**.

---

## 10. Changelog (v4 → v5)

- **v5.0 (문서)**: v4 §10 미완·유저플로 4·6·7·P1/P2를 **V5-A~F**로 재편; normative는 v2 유지 원칙 명시.
- **(코드, v4 문서 이후)** Prometheus·subscribe rate·알림 dispatch/웹훅·증빙 content·retention·분쟁 투표/SLA 등은 **v5 이전에 착지** — v2 §9에 아직 전부 반영되지 않았을 수 있음.

---

## 11. Pointer updates (sibling specs)

다음 문서의 **Document Info**에 `docs/Backend2_API_Spec_v5.md` 링크를 추가한다(본 v5 작성과 동시 또는 직후 PR).

- `docs/Backend2_API_Spec_v1.md` §1
- `docs/Backend2_API_Spec_v2.md` §1
- `docs/Backend2_API_Spec_v3.md` §1
- `docs/Backend2_API_Spec_v4.md` §1

---

*End of BlueSafe Backend2 API Spec v5 (planning)*
