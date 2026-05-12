# BlueSafe Backend2 API Spec v8

## 1. Document Info

- Version: `v8.0` (planning)
- Owner: `Backend2`
- Document type: **차기 구현·운영·규제 성숙도 로드맵(spec)** — v1 원칙·v2 **현행 API(§9 normative)**·v3–v7 착지분을 전제로, **v7에서 의도적으로 남긴 갭**(Outbox·키 경계·법무 보존·네이티브 알림·SBT 온체인 등)과 **프로덕션 운영 계약**을 **v8 범위**로 고정한다.
- Normative (엔드포인트·요청/응답 세부): `docs/Backend2_API_Spec_v2.md` — v8에서 추가·변경하는 공개 API는 **§9 역병합** 또는 본 문서 **§8** + ADR로 임시 고정 후 v2 개정에서 합류한다.
- Design baseline: `docs/Backend2_API_Spec_v1.md`
- Prior roadmap: `docs/Backend2_API_Spec_v3.md` … `docs/Backend2_API_Spec_v7.md`
- Alignment: `bluesafe-backend2-plan.canvas.tsx` (유저플로·P0–P2)
- Status: `In progress — V8-A–F 1차 완료 (2026-05-09); 후속 하드닝·IdP·체인 어댑터는 운영 PR로 분리`
- **(v7 전제)** v7에서 반영된 것(요약): Escrow 필드 ingest·매핑 ADR, subscribe SLO·알럿·런북 1차, 정산 금액·통화·배치·이벤트, 검증자 레지스트리·SLA 자동 에스컬레이트(옵션), export 서명 URL 경로, reputation **v2** 스키마·XLS allowlist. **v8이 메우는 것**은 아래 **§2·§5·§7·§10**.

---

## 2. Purpose of v8

v7이 **레저 정합·SLO·정산 표면·분쟁 운영 DB·규제 친화 export·평판 스키마 버전**까지 “단일 진실 + 운영 계약”의 **1차 완성선**에 올랐다면, v8은 **프로덕션에서 깨지지 않는 경계**와 **법무·보안·키 관리가 요구하는 하드닝**을 닫는 단계다.

1. **알림·도메인 이벤트: Outbox / 멱등 소비 (유저플로 4·5·6)** — 동기 `saveNotification` 대비 **durable outbox**(또는 동등한 at-least-once + 소비 멱등) 채택, 워커 HA·DLQ·재처리 API.
2. **지갑·키·서명 경계 (유저플로 2·6)** — Backend2가 서명하는 범위 vs 외부 지갑·HSM·MPC를 ADR로 고정; **합성 `txHash` 폐기 일정** 또는 환경별 비활성 기본값 전환.
3. **증빙·감사: 보존 등급·법무 메타 (유저플로 1·7)** — `legal_hold` / 보존 클래스 / 지역·테넌트 정책 메타데이터; **다중 게이트웨이·재핀** 정책; 감사 **커서·대용량** 안정 API.
4. **운영 콘솔·RBAC (P1)** — 역할 세분(export·purge·registry·SLA 스캔 등), 테넌트 격리 강화, **IdP / OIDC**(선택)와 헤더 기반 RBAC의 이행 경로.
5. **XRPL 제품 플로우 마감 (유저플로 2·3·6)** — **조건부 에스크로**(Condition/Fulfillment) 지원 여부 결정 및 구현; Clio/전용 노드·**DR 드릴** 런북을 코드·메트릭과 연결.
6. **P2 평판: 오프체인 → 온체인 어댑터 경계** — `bluesafe.reputation.v2` 이후 **SBT/레지스트리 어댑터** 인터페이스(본 레포는 훅·큐·재시도; 민팅은 별 서비스 가능하되 **계약은 명시**).

---

## 3. Relationship to v1–v7

| 문서 | v8에서의 역할 |
| --- | --- |
| **v1** | `validated`, 감사 불변성 — **변경 없음** |
| **v2** | `/v1/...` normative — v8 신규 API·env **§9·env 표 역병합** |
| **v3–v6** | 영속화·subscribe·정책·집행·감사 export — **유지** |
| **v7** | Escrow 정합·SLO·정산 금액·분쟁 레지스트리·artifact URL·reputation v2 — **전제**; v8은 **Outbox·키·법무·RBAC·SBT 경계** |

---

## 4. User Flow (확정안) — v8에서 닫을 갭

| 단계 | 확정안(요약) | v8 목표 |
| --- | --- | --- |
| **1** | 계약서/증빙 → CID | **보존 등급·legal hold** 스키마·API; 클라이언트 측 암호화 옵션 운영 가이드; **재핀·다중 게이트웨이** |
| **2** | Escrow 제출·validated | **표준 submit 플로**(서명 주체 ADR); 조건부 에스크로 **지원/비지원** 결정 및 필드 정합 |
| **3** | subscribe + `account_tx` | **DR 드릴** 자동화·Clio/전용 노드 ADR 이행; SLO **승인 Alertmanager** 워크플로 연계(운영 프로세스 + 코드 훅) |
| **4** | 정산·알림 | **Outbox** 또는 동등 패턴; 소비 멱등·모니터링; 월 정산 **대사(reconciliation)** API(선택) |
| **5** | 분쟁·검증 | 검증자 레지스트리와 **SignerList / 외부 거버넌스** 연계 **어댑터**(옵션); 상태 전이 **정책 엔진**(설정 기반) |
| **6** | 집행·결과 분기 | 합성 해시 **제거 로드맵**; 실패 시 **환급·분쟁 큐**와 알림 **동일 outbox** |
| **7** | 감사·리포트 | 감사 **커서 API**·**CSV** export 패리티; artifact **감사(누가 URL 발급했는지)**; purge **2인 승인**(옵션) |

---

## 5. 기능 도출 (P0–P2) — v8 목표

| 구분 | v7까지(요약) | v8 목표 |
| --- | --- | --- |
| **P0 XRPL Watcher** | SLO·알럿·런북 1차 | **토폴로지·DR** 코드/런북 완결; 누락 **자동 복구** 정책(한계 내) |
| **P0 Tx Classifier** | 분류·메트릭·정책 | 외부 큐 연동(선택)·**승인 규칙** 운영 표준 완성 |
| **P0 Evidence** | IPFS·KMS·retention API | **보존 클래스**·legal hold·재핀·게이트웨이 헬스 |
| **P0 Dispute** | 레지스트리·SLA 자동 에스컬레이트(옵션) | **정책 엔진**·외부 서명 연계 **어댑터** |
| **P0 Notification** | 큐·웹훅·도메인 매트릭스 | **Outbox**·DLQ·템플릿 버전·(선택) **FCM/APNs/Email** 네이티브 provider 인터페이스 |
| **P1 Operator** | 목록·통계·export·registry | **RBAC 세분**·통합 대시보드 **쿼리 API**·테넌트 격리 |
| **P1 Audit** | NDJSON·비동기 잡·artifact URL | **커서**·대용량 **스트리밍 안정성**·보관 등급 |
| **P2 Reputation** | v2 웹훅·XLS allowlist | **SBT/레지스트리 어댑터 계약**·재시도·dead letter |

---

## 6. Phased Delivery (v8 내부 페이즈)

권장 순서: **Outbox·알림 하드닝 → 키/지갑 ADR 및 합성 해시 로드맵 → 증빙·감사 법무 메타 → 운영 RBAC·IdP 훅 → XRPL DR·토폴로지 → P2 SBT 어댑터**.

| Phase | 목표 | 산출물 | 유저플로 / 레이어 |
| --- | --- | --- | --- |
| **V8-A** | 알림 Outbox·DLQ | 스키마·워커·ADR·런북 | **4·5·6**, P0 Notification |
| **V8-B** | 키·서명·합성 해시 | ADR·환경 기본값·집행 API 정리 | **2·6** |
| **V8-C** | 증빙·감사 법무·규모 | 보존 클래스·커서 감사·CSV | **1·7**, P1 Audit |
| **V8-D** | 운영·RBAC | 역할 세분·(선택) OIDC 문서·미들웨어 훅 | **P1** Console |
| **V8-E** | XRPL 운영 완결 | DR 런북·토폴로지 메타·health; 조건부 에스크로 **비지원** ADR `0013` | **2·3·6** |
| **V8-F** | 평판 온체인 경계 | SBT 어댑터 인터페이스·ADR | **P2** |

---

## 7. API / Domain Deltas (v8 예고)

하위호환을 깨면 ADR + v2 Changelog.

| 기능 | 방향 |
| --- | --- |
| 알림 | `notification_outbox` + `NOTIFICATION_DOMAIN_OUTBOX` + fan-out worker; operator outbox list/retry (**V8-A**). 템플릿/DLQ UI·외부 큐는 후속. |
| 집행 | **`BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict`** 시 합성 `txHash` 비사용; `GET /v1/operator/runtime/execution-policy`; ADR `0011` (**V8-B**). 완전 제거·HSM은 후속. |
| 증빙 | `retention_class`, `legal_hold_until`, `jurisdiction`; **`PATCH /v1/operator/evidences/:evidenceId/metadata`**; purge 보호 규칙 ADR `0012` (**V8-C**). |
| 감사 | `GET /v1/audits` **cursor** (`?cursor=` + `limit`); **`GET /v1/reports/audits.csv`** = NDJSON과 동일 RBAC·필터 (**V8-C**); 대용량 **압축** 옵션은 후속. |
| 인증 | OIDC bearer 검증(옵션); **`BLUESAFE_OPERATOR_CONSOLE_SCOPES`** + **`X-Bluesafe-Operator-Scopes`**; **`GET /v1/operator/runtime/auth-providers`** (**V8-D**). |
| XRPL | **`BLUESAFE_XRPL_TOPOLOGY`**, **`BLUESAFE_XRPL_DR_RUNBOOK_URL`**; **`GET /v1/operator/runtime/xrpl-operations`**; 조건부 에스크로 **비지원** ADR `0013` (**V8-E**). |
| 평판 | **`GET/POST /internal/reputation-delivery`** DLQ·재시도; SBT **`SbtAdapterJob`** 계약 ADR `0014`; **`docs/reputation-v2-consumer-guide.md`** (**V8-F**). |

---

## 8. Scope (In / Out)

### 8.1 In scope

1. **Outbox 패턴** 및 알림·도메인 이벤트의 **운영 HA** 수준 정의.
2. **키·지갑·합성 해시** 정책의 코드·문서 일치.
3. **법무·보존** 메타데이터와 감사 **대용량·커서** 표면.
4. **RBAC** 심화 및 (선택) **IdP** 연동 훅.
5. **XRPL DR·토폴로지** 및 조건부 에스크로 **결정 + 구현 또는 ADR “비지원”**.
6. **P2 SBT** — 본 레포는 **어댑터·계약·재시도**; 민팅 체인 서비스는 연동 문서로 경계.

### 8.2 Out of scope

- 콘솔 **프론트엔드** 전체 제품.
- 특정 국가 **법규 구현체** 전부(메타데이터·훅·문서화만).
- **메인넷 비즈니스 승인** 체크리스트 전부(플래그·ADR).

---

## 9. Definition of Done — v8

- [x] **V8-A**: Outbox **스키마·워커·멱등 소비**·DLQ(`dead`)·operator 조회/재시도; ADR `0010`; env `NOTIFICATION_DOMAIN_OUTBOX` 등.
- [x] **V8-B**: 키/지갑 ADR `0011`; **`BLUESAFE_EXECUTION_DEPLOYMENT_TIER`**(`strict` 시 합성 해시 경로 차단); 집행 정책 **`GET /v1/operator/runtime/execution-policy`** + deep `/health`의 `executionPolicy`; v2 env 표 보강.
- [x] **V8-C**: 증빙 **보존 클래스**·legal hold·`jurisdiction`; **`PATCH /v1/operator/evidences/:evidenceId/metadata`**; 감사 **`GET /v1/audits` cursor**; **`GET /v1/reports/audits.csv`**(NDJSON과 동일 RBAC); ADR `0012`.
- [x] **V8-D**: Operator **`BLUESAFE_OPERATOR_CONSOLE_SCOPES`** + **`X-Bluesafe-Operator-Scopes`**; 민감 라우트 스코프 게이트; **`GET /v1/operator/runtime/auth-providers`**; `BLUESAFE_OIDC_ISSUER_URL` 노출(검증은 후속).
- [x] **V8-E**: **`BLUESAFE_XRPL_TOPOLOGY`** / DR runbook URL; **`GET /v1/operator/runtime/xrpl-operations`**; deep **`/health`** → `xrplOperations`; 조건부 에스크로 **비지원** ADR `0013`; 런북 `docs/runbooks/v8-xrpl-dr-topology.md`.
- [x] **V8-F**: reputation **DLQ** 내부 API; **`docs/reputation-v2-consumer-guide.md`**; SBT 어댑터 **job 타입** + ADR `0014`.

---

## 10. Open ADRs (v8 착수 전·중)

1. Outbox **스키마**(DB 테이블 vs 외부 큐) 및 **워커 HA**(리더 선출 vs `SKIP LOCKED` 단일 DB).
2. **합성 execution txHash** 제거 타임라인 vs 환경 플래그 유지 기간(v7 §11 연장).
3. **조건부 에스크로** — BlueSafe 제품이 채택하는지 여부; 채택 시 필드·검증·UI(콘솔) 계약.
4. **IdP** — OIDC만 vs mTLS 종단 추가; 감사 artifact URL과 **통합 인증**.
5. **SBT** — 오프체인 레지스트리 vs 온체인 민팅 서비스 **책임 분리 SLA**.

---

## 11. Changelog (v7 → v8)

- **v8.0 (문서)**: v7 구현·ADR(`0005`–`0009`)을 전제로, **Outbox·키·법무·RBAC·DR·SBT 경계**를 다음 성숙도 묶음으로 승격.
- **(코드)**: v8 구현 착수 시 §12 Implementation log에 일자별 기록.

---

## 12. Implementation log (v8 code, repo)

| 날짜(대략) | 항목 |
| --- | --- |
| 2026-05-09 | **V8-B (1차):** `BLUESAFE_EXECUTION_DEPLOYMENT_TIER` + `syntheticExecutionPathEffective()`; `GET /v1/operator/runtime/execution-policy`; deep `/health` → `executionPolicy`; ADR `docs/adr/0011-v8-execution-keys-synthetic-hash.md`. |
| 2026-05-09 | **V8-D/E/F (1차):** operator console scopes + `auth-providers`; XRPL topology/DR + `xrpl-operations` + health `xrplOperations`; conditional escrow ADR `0013`; reputation DLQ internal routes + consumer guide + SBT contract ADR `0014`; runbook `docs/runbooks/v8-xrpl-dr-topology.md`. |

---

## 13. Pointer updates (sibling specs)

다음 문서 **Document Info**에 `docs/Backend2_API_Spec_v8.md` 링크를 추가한다(v8 작성과 동시 또는 직후 PR).

- `docs/Backend2_API_Spec_v2.md` §1 — **v8 초안 시 병행 권장**
- `docs/Backend2_API_Spec_v7.md` §1 — **다음 로드맵(v8) 안내용 링크 권장**

---

*End of BlueSafe Backend2 API Spec v8 (planning)*
