# BlueSafe Backend2 API Spec v6

## 1. Document Info

- Version: `v6.0`
- Owner: `Backend2`
- Document type: **다음 구현 로드맵(spec)** — v1 원칙·v2 **현행 API(§9 normative)**·v3–v4 구현·**v5 페이즈 착지분**을 전제로, **v5에서 열린 게이트(V5-C·V5-E·v2 동기화·알림/정산 심화)**와 **유저플로 1·2·4·6·7의 제품 수준 마감**, **P1/P2 심화**를 **v6 범위**로 고정한다.
- Normative (엔드포인트·요청/응답 세부): `docs/Backend2_API_Spec_v2.md` — v6에서 추가·변경하는 공개 API는 **§9 역병합** 또는 본 문서 **§6** + ADR로 임시 고정 후 v2 개정에서 합류한다.
- Design baseline: `docs/Backend2_API_Spec_v1.md`
- Prior roadmap: `docs/Backend2_API_Spec_v3.md`, `docs/Backend2_API_Spec_v4.md`, `docs/Backend2_API_Spec_v5.md`
- Next roadmap: `docs/Backend2_API_Spec_v7.md` (v6 이후 운영·프로토콜 정합·SLO·정산 단일화·분쟁 운영·규제 친화 export·P2 표준)
- Alignment: `bluesafe-backend2-plan.canvas.tsx` (유저플로·P0–P2)
- Status: `In progress — v6 extended in code (KMS paths, audit p95 metrics, async export jobs, domain expiry/refund matrix, optional Bearer/mTLS, optional execution submit, Alertmanager examples); see §9`
- **(코드, v5 기준 스냅샷)** 이미 착지: `settlements`·원장 close 터치·`settlement.period_touched`·정산 목록/상태 API·`confirmed` 시 알림 자동 enqueue·`GET /v1/reports/summary`·`GET /v1/reports/audits.ndjson`·XRPL subscribe/backfill/classifier·증빙 업로드·CID·복호화 다운로드·분쟁 상태머신·투표·집행 트랙(MVP)·내부 reputation 스텁 등. **v6가 메우는 것**은 아래 **§2·§5·§8**.

---

## 2. Purpose of v6

v5가 **유저플로를 끝까지 잇는 MVP**(정산 엔티티·일부 알림·리포트 NDJSON·집행 합성 경로 유지)에 초점을 맞췄다면, v6는 다음을 목표로 한다.

1. **온체인 진실 완료 (유저플로 2·6)**: 백엔드/운영 파이프에서의 **실제 `EscrowCreate`/`EscrowFinish`/`EscrowCancel` submit·서명·검증**과 계약·분쟁·`xrpl_txs`의 **1:1 ledger `txHash`**; 합성 해시 **플래그·폐기 경로**를 ADR로 고정.
2. **정산·알림 제품화 (유저플로 4)**: 월(또는 채택 주기)별 **금액·집계·상태 전이 규칙**·`지급 예정` 등 이벤트 매트릭스·**Outbox/워커** 여부 결정; `settlement.*` 외 **만료·환급·분쟁 SLA**까지 자동 enqueue.
3. **상태 동기화 신뢰도 (유저플로 3)**: subscribe·`account_tx`·백필 위에 **누락 감지 지표**(기대 클로즈 vs 실제 터치·정산 행)·soak **SLO·알럿**·(선택) 전용 노드/레이트 정책 문서화.
4. **증빙·감사 운영 (유저플로 1·7, P0/P1)**: Pinata **핀 실패 재시도·unpin**·**KMS**·감사 **대량·p95·비동기 export**·보존/파기 배치와 `retain_until` 연동.
5. **운영 콘솔·보안 (P1)**: **RBAC 세분**·Bearer/mTLS·`GET /v1/reports/*` 확장(CSV·잡 기반 export)·테넌트·정산·XRPL 통합 대시보드용 집계.
6. **평판 레일 (P2)**: `POST /internal/reputation-events` 스텁을 넘어 **도메인 이벤트 구독 → 멱등 아웃바운드**(웹훅/큐)·스키마 버전.

공식 XRPL·Escrow 레퍼런스는 **v2 §3**을 normative로 따른다(v6에서 URL 목록을 중복하지 않음).

---

## 3. Relationship to v1–v5

| 문서 | v6에서의 역할 |
| --- | --- |
| **v1** | validated·`tes/tec/tem/ter`·감사 — **불변 전제** |
| **v2** | `/v1/...` normative — v5·v6 신규 API·env **§9·env 표 역병합**(v6 **필수 과제**) |
| **v3–v4** | 영속화·subscribe·policy·헬스 등 — **유지**; v6는 그 위 **운영 SLO·보안** |
| **v5** | V5-A/B/D(MVP)/F(stub) **완료분은 전제**; **V5-C·V5-E·v2 동기화·알림/정산 심화**는 v6로 이관 |

---

## 4. User Flow (Backend2 확정안) — v6 매핑

| 단계 | 설명 | v5 상태(요약) | v6 목표 |
| --- | --- | --- | --- |
| **1** | 계약 등록: 계약서/증빙 업로드 → CID 생성/검증 | 업로드·버전·검증·다운로드·retention API | **핀 재시도·unpin·KMS·운영 런북** |
| **2** | Escrow 생성: submit 후 `validated=true` | 앵커·live 검증·외부 submit 전제 | **백엔드/운영 E2E submit 규약**·트랜잭션 소유권 문서화 |
| **3** | 상태 동기화: subscribe + `account_tx` | 구현됨 | **누락 감지 메트릭·SLO·알럿**·transactions 스트림 운영 한계 명시 |
| **4** | 월 정산: 이벤트 → 상태 갱신 + 알림 | 터치·행·`confirmed` 알림 MVP | **주기·금액·집계·추가 이벤트 타입**·Outbox 검토 |
| **5** | 분쟁 접수: CID 묶음 + 상태머신 | 구현됨 | **검증자 N·쿼럼·타임아웃 자동 전이·알림** 규격 고정 |
| **6** | 판정/집행: Finish/Cancel + tes/tec/tem/ter | 분류·트랙·합성 해시 MVP | **실 ledger 해시 1:1·검증**·합성 경로 제거/플래그 |
| **7** | 종료/리포트: 감사·운영 리포트 | summary·NDJSON export MVP | **CSV/비동기 export·RBAC·감사 p95** |

---

## 5. 기능 도출 (P0–P2) — v6 매핑

| 구분 | v5에서의 상태(요약) | v6 목표 |
| --- | --- | --- |
| **P0 XRPL State Watcher** | subscribe·accounts·`account_tx`·백필·옵션 transactions·rate cap | soak **수치 목표**·누락 지표·(선택) 전용 노드 |
| **P0 Tx Outcome Classifier** | 분류·policy 큐·Prometheus | Alertmanager 연동·(규모 시) 외부 큐 ADR |
| **P0 Evidence Vault** | IPFS·CID·버전·복호화 | **핀 SLA·KMS·unpin** |
| **P0 Dispute Case Engine** | 상태머신·투표·SLA 필드 | **쿼럼·타임아웃 자동화**·에스컬레이션 알림 |
| **P0 Notification Hub** | 큐·웹훅·라우팅·정산 confirmed 자동 enqueue | **FCM/APNs/이메일 네이티브**·만료·환급·분쟁 전 구간 템플릿 |
| **P1 Operator Console API** | 목록·필터·통계·정산·리포트 MVP | **RBAC 세분**·집계 확장·export 잡 |
| **P1 Audit Trail** | append·조회·NDJSON 스트림 | **p95·대량·보관·비동기 export** |
| **P2 Reputation Event Bridge** | internal stub | **실 어댑터·스키마·멱등 운영** |

---

## 6. v6 Scope (In / Out)

### 6.1 In scope

1. **V5-C 완료**: 실 네트워크 집행·트랙·분쟁 상태·`validated` **단일 진실**.
2. **V5-E 완료**: 증빙 핀/언핀·KMS·감사 성능·보존 정책.
3. **알림·정산 도메인 심화**: 이벤트 타입 매트릭스·템플릿 버전·재전송 SLA.
4. **운영·보안**: RBAC 세분·인증 강화·리포트 export 고도화·v2 동기화.
5. **P2 브릿지(선택 페이즈)**: 아웃바운드 실연동(온체인 민팅 전체는 별 서비스 가능).

### 6.2 Out of scope

- 운영 콘솔 **프론트엔드** 제품 전체.
- 메인넷 **비즈니스 승인** 체크리스트(플래그·ADR만).
- 단일 PR에 **담기 어려운 규제 대응**(데이터 주권 전용 리전 등) — 별 로드맵.

---

## 7. Phased Delivery (v6 내부 페이즈)

권장 순서: **온체인 진실 → 증빙/감사 → 알림/정산 → 콘솔·보안 → 평판**.

| Phase | 목표 | 산출물 | 유저플로 / 모듈 |
| --- | --- | --- | --- |
| **V6-A** | 온체인 집행 완료 | 실 submit 경로·`txHash` 검증·합성 제거/플래그·ADR | **2·6**, P0 Classifier·Watcher |
| **V6-B** | 증빙·감사 규모 | Pinata 재시도·unpin·KMS·감사 p95·(비동기) export | **1·7**, P0 Vault, P1 Audit |
| **V6-C** | 알림·정산 제품화 | 이벤트 매트릭스·템플릿·만료/환급/SLA·정산 금액/배치(선택) | **4·5**, P0 Notification·Dispute |
| **V6-D** | 동기화 신뢰도 | 누락 감지 메트릭·SLO·알럿·런북 | **3** |
| **V6-E** | 콘솔·보안·리포트 | RBAC 세분·Bearer/mTLS·CSV/잡 export·v2 §9 동기화 | **7**, P1 Operator |
| **V6-F** | 평판 브릿지 | 도메인 → 아웃바운드 실연동·멱등·모니터링 | **P2** |

---

## 8. API / Domain Deltas (v6 예고)

하위호환을 깨면 ADR + v2 Changelog.

| 기능 | 방향 |
| --- | --- |
| 집행 | **`BLUESAFE_SYNTHETIC_EXECUTION_HASH=0`** + body **`txHash`** → ledger 연동; 기본은 합성 유지. 실 submit·HSM은 ADR |
| 정산 | 금액·통화·배치 확정 API 또는 이벤트만 — **ADR 후 경로 확정** |
| 알림 | 채널별 provider 설정·템플릿 버전·DLQ 대시보드 필드 |
| 리포트 | `reports/summary` 확장 필드·`reports/export-jobs` 등 비동기(선택) |
| 감사 | 커서 기반 대량 API·보내기 잡 |
| 인증 | 역할·스코프 세분·mTLS/Bearer |
| 평판 | 내부 스텁 → **서명된 웹훅** 또는 메시지 큐 |

---

## 9. Definition of Done — v6

- [x] **V6-A (extended)**: 기존 **선택 `txHash` / 합성** + **`BLUESAFE_EXECUTION_SUBMIT_ENABLED=1`** + **`BLUESAFE_EXECUTION_SUBMIT_SEED`** + XRPL live 시 **백엔드 `submitAndWait` 집행**(지갑 주소=요청 `owner` 일치 필수). HSM·운영 키 분리는 ADR.
- [x] **V6-B (extended)**: 기존 Pinata 재시도·unpin + **KMS DEK 경로**: `EVIDENCE_KMS_STUB_DEK_BASE64` 또는 **`EVIDENCE_KMS_HTTP_UNWRAP_URL`**(+`EVIDENCE_KMS_WRAPPED_DEK_BASE64`)로 암호화 키 해석; **`bluesafe_evidence_dek_resolution_total`**, **`bluesafe_kms_http_unwrap_avg_ms`**. **감사 목록 p50/p95 샘플** Prometheus + **`POST /v1/reports/export-jobs`** 비동기 NDJSON 잡(워커). **AWS SDK 직접 Decrypt**는 후속(HTTP sidecar로 대체 가능).
- [x] **V6-C (extended)**: 기존 매트릭스 + **`contract.lifecycle_closed`**, **`refund.contract_cancelled`**, **`dispute.escalated`**, **`dispute.review_deadline_expired`**(`POST /v1/operator/disputes/review-sla-scan`), **`refund.dispute_execution_failed`** / **`dispute.execution_completed`**(집행 트랙 검증 후 reconcile).
- [x] **V6-D (extended)**: 기존 settlement 메트릭 + **Alertmanager 예시 규칙** `docs/prometheus/bluesafe-alerts.example.yml`·런북 `docs/runbooks/alertmanager-bluesafe.md`. 프로비저닝은 배포팀.
- [x] **V6-E (extended)**: 기존 `auditor` + **`BLUESAFE_V1_BEARER_TOKEN`** 및/또는 **`BLUESAFE_MTLS_CLIENT_CERT_SUBJECT_HEADER`**(리버스 프록시가 채운 주체 헤더 비어있지 않음)로 **`/v1` 앞단 보강**.
- [x] **V6-F**: 이전과 동일(웹훅 아웃바운드).

---

## 10. Open ADRs (v6 착수 전·중)

v5 §9를 계승·갱신한다.

1. 정산 주기: **달력 월** vs **ledger 기간** vs 혼합 — v6에서 **단일 선택** 또는 혼합 시 **변환 규칙** 문서화.
2. 집행 키: HSM·KMS·외부 signer — **책임 경계**(Backend2 vs Blockchain Lead).
3. Export: 동기 NDJSON 한계 도달 시 **비동기 잡 + 서명 URL** 전환 시점.
4. 알림: **동기 핸들러** vs **Outbox + 워커** — v6-C 전에 결정.
5. 평판: **전용 웹훅** vs **공용 이벤트 버스** — V6-F 전에 결정.

---

## 11. Changelog (v5 → v6)

- **v6.0 (문서)**: v5 미완(V5-C·E·v2 동기화·알림/정산 심화)을 **V6-A~F**로 재편; 유저플로 1–7·P0–P2와 **명시적 매핑** 표 추가.
- **(코드 전제)**: v5-A/B/D(MVP)/F(stub) 구현분은 v6의 **기반선**으로 취급.

---

## 12. Pointer updates (sibling specs)

다음 문서 **Document Info**에 `docs/Backend2_API_Spec_v6.md` 링크를 추가한다(v6 작성과 동시 또는 직후 PR).

- `docs/Backend2_API_Spec_v1.md` §1
- `docs/Backend2_API_Spec_v2.md` §1
- `docs/Backend2_API_Spec_v3.md` §1
- `docs/Backend2_API_Spec_v4.md` §1
- `docs/Backend2_API_Spec_v5.md` §1

---

*End of BlueSafe Backend2 API Spec v6 (planning)*
