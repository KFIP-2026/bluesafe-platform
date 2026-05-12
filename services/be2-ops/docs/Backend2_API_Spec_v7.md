# BlueSafe Backend2 API Spec v7

## 1. Document Info

- Version: `v7.0`
- Owner: `Backend2`
- Document type: **차기 구현·운영 성숙도 로드맵(spec)** — v1 원칙·v2 **현행 API(§9 normative)**·v3–v6 착지분을 전제로, **유저플로 1–7의 프로덕션 완성도**, **XRPL 공식 모델과의 정렬**, **지갑·키·규제 경계**, **P2 평판·자산 표준**을 **v7 범위**로 고정한다.
- Normative (엔드포인트·요청/응답 세부): `docs/Backend2_API_Spec_v2.md` — v7에서 추가·변경하는 공개 API는 **§9 역병합** 또는 본 문서 **§8** + ADR로 임시 고정 후 v2 개정에서 합류한다.
- Design baseline: `docs/Backend2_API_Spec_v1.md`
- Prior roadmap: `docs/Backend2_API_Spec_v3.md` … `docs/Backend2_API_Spec_v6.md`
- Next roadmap: `docs/Backend2_API_Spec_v8.md` (Outbox·키·법무·RBAC·DR·SBT 경계)
- Alignment: `bluesafe-backend2-plan.canvas.tsx` (유저플로·P0–P2)
- Status: `In progress — V7-A 문서·ADR 완료; V7-B watcher 메트릭·알럿·런북 1차 (2026-05-09); V7-C–F 코드·ADR 0007–0009 (2026-05-09)`
- **(코드, v6 기준 전제)** v6에서 확장된 항목: Pinata 재시도·unpin, KMS DEK 경로(stub/HTTP unwrap), 감사 지연 샘플·비동기 export 잡, 도메인 알림 매트릭스(계약 종료/취소·SLA·집행 결과 등), 선택 Bearer/mTLS, 선택 XRPL `submitAndWait` 집행, Alertmanager 예시 규칙 등. **v7이 메우는 것**은 아래 **§2·§5·§7·§10** (온체인·지갑·SLO·표준·평판).

---

## 2. Purpose of v7

v6가 **MVP+운영 옵션**(합성/실해시 병행, 알림·감사·보안 게이트)까지 넓혔다면, v7은 **“한 레저에 대한 단일 진실”과 운영 SLO를 제품 약속으로 고정**하는 단계다.

1. **Escrow 수명주기 정합 (유저플로 2·6)**: [EscrowCreate](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate) → ledger 객체([Escrow](https://js.xrpl.org/interfaces/LedgerEntry.Escrow.html)) → [EscrowFinish](https://js.xrpl.org/interfaces/EscrowFinish.html) / [EscrowCancel](https://js.xrpl.org/interfaces/EscrowCancel.html)의 **Account / Owner / Destination** 역할을 Backend2 도메인 필드와 **1:1 매핑**하고, [xrpl.js `submitAndWait`](https://xrpl.org/docs/references/xrpljs2-migration-guide#transaction-submission) 기반 **재시도·멱등·재연결(disaster recovery)** 런북을 ADR로 고정한다.
2. **상태 동기화 SLO (유저플로 3)**: [subscribe](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe) (`ledger`·선택 `transactions`) + `account_tx` 백필 위에 **누락률·지연 상한·Alertmanager 승인 규칙**을 수치 목표로 채택한다.
3. **정산 금액·주기 단일화 (유저플로 4)**: “달력 월 vs ledger 기간” ADR를 **단일 선택 또는 변환 규칙**으로 닫고, **금액·통화·배치 확정** API 또는 이벤트만 노출할지 확정한다.
4. **분쟁 엔진 운영 완성 (유저플로 5)**: Verifier mock을 넘어 **다자 서명·쿼럼 영속화·SLA 자동 전이**(에스컬레이션은 알림까지 연결된 상태에서 **상태 전이 정책**까지 포함할지 ADR).
5. **종료·리포트·규제 경계 (유저플로 7, P1)**: 비동기 export를 **서명 URL·보관 기간·접근 RBAC**와 묶고, 감사 **보존·파기** 정책을 법무/보안 검토 가능한 수준으로 문서화한다.
6. **평판·자산 표준 (P2)**: [transaction results](https://xrpl.org/docs/references/protocol/transactions/transaction-results)·[tec codes](https://xrpl.org/docs/references/protocol/transactions/transaction-results) 분류와 연계한 **아웃바운드 스키마 버전**; XLS-20/33/70/80·NFT·MPT 등 **사업 레일이 실제로 채택할 토큠 모델**만 선택해 브릿지한다 (전체 온체인 민팅은 별 서비스 가능).

---

## 3. Relationship to v1–v6

| 문서 | v7에서의 역할 |
| --- | --- |
| **v1** | `validated`, `tes/tec/tem/ter`, 감사 불변성 — **변경 없음** |
| **v2** | `/v1/...` normative — v7 신규 API·env **§9·env 표 역병합** |
| **v3–v4** | 영속화·subscribe·policy·헬스 — **유지**; v7은 **SLO·드릴·키 분리** |
| **v5–v6** | 정산·알림·집행·감사·보안 옵션 — **전제**; v7은 **완성도·표준·운영 계약** |

---

## 4. User Flow (Backend2 확정안) — v7 목표

아래는 캔버스·v2와 동일한 **유저플로 확정안**에 대해, **v7에서 닫을 갭**만 기술한다.

| 단계 | 확정안(요약) | v7 목표 |
| --- | --- | --- |
| **1** | 계약서/증빙 업로드 → CID 생성/검증 | **핀 SLA·다중 리전·법무 보존기간**과 연동된 retention; 필요 시 **클라이언트 측 암호화** 옵션 ADR |
| **2** | Escrow 생성: 제출 후 `tx`에서 `validated=true` | **EscrowCreate**를 Backend2 또는 지정 signer가 제출하는 **표준 플로우**; `OfferSequence`·`Owner`·`Destination`와 계약 필드 매핑 표 v2 §3 보강 |
| **3** | subscribe + `account_tx` 실시간/백필 | **SLO 대시보드**(기대 ledger close vs 실제 터치·정산 행), **transactions 스트림** 채택 기준 문서화, [subscription streams](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe) 운영 한계 |
| **4** | 이벤트 수신 → 정산 상태 + 알림 | **금액·통화·배치** 단일 모델; **Outbox** vs 동기 enqueue 최종 선택; idempotent 소비 |
| **5** | 증빙 CID 묶음 + 상태머신 | **실 검증자 레지스트리·다자결·타임아웃 자동 전이** DB 스키마 |
| **6** | EscrowFinish/Cancel + tes/tec/tem/ter | **조건부 에스크로**(Condition/Fulfillment) 지원 여부 결정; [EscrowFinish](https://js.xrpl.org/interfaces/EscrowFinish.html) 필드 정합; 실패 시 **환급·분쟁** 알림과 정책 큐 연동 |
| **7** | 종료·감사·운영 리포트 | **CSV·서명 URL export**; **감사 보관·파기** 배치; 콘솔 집계 API 확장 |

---

## 5. 기능 도출 (P0–P2) — v7 목표

| 구분 | v6까지(요약) | v7 목표 |
| --- | --- | --- |
| **P0 XRPL State Watcher** | subscribe·ledger·`account_tx`·백필·옵션 transactions | **SLO·누락 감지·드릴**; Clio/전용 노드 등 **배포 토폴로지** ADR |
| **P0 Tx Outcome Classifier** | tes/tec/tem/ter·policy·Prometheus | **외부 큐**(선택)·**Alertmanager 승인 규칙** 운영 표준; [transaction results](https://xrpl.org/docs/references/protocol/transactions/transaction-results)와 1:1 매핑 검증 |
| **P0 Evidence Vault** | IPFS·CID·버전·KMS 경로·unpin | **다중 게이트웨이·재핀 정책**; 증빙 **법무 보존 클래스** 메타데이터 |
| **P0 Dispute Case Engine** | 상태머신·mock verifier·SLA 필드·알림 | **영속 검증자·다자결·자동 전이**; 집행과 **SignerListSet**([문서](https://xrpl.org/docs/references/xrpljs2-migration-guide)) 연계 여부 |
| **P0 Notification Hub** | 큐·웹훅·도메인 매트릭스 | **FCM/APNs/Email 네이티브** provider·템플릿 버전·DLQ 운영 UI/API |
| **P1 Operator Console API** | 목록·필터·RBAC·auditor | **통합 대시보드 집계**·테넌트별 격리 강화·감사 export 권한 세분 |
| **P1 Audit Trail** | append·NDJSON·비동기 잡·p95 샘플 | **보관 등급·비동기 대용량·서명 다운로드**·커서 API 안정화 |
| **P2 Reputation Event Bridge** | 웹훅·HMAC·멱등 | **스키마 버전·SBT/레지스트리** 연계; [XRPL meta](https://xrplmeta.org/) 등 메타데이터 소스와의 **책임 경계** |

---

## 6. XRPL 레퍼런스 인덱스 (태그 → 공식·생태계)

Normative URL 중복을 피하기 위해 **v2 §3**을 1차 출처로 두고, v7 작업 시 아래를 **구현 체크리스트**에 연결한다.

| 태그 / 주제 | 권장 진입점 |
| --- | --- |
| **xrpl_http / wss** | [HTTP/WebSocket API](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe), rippled `server_info` |
| **xrpl.js** | [xrpl.js migration / submitAndWait](https://xrpl.org/docs/references/xrpljs2-migration-guide#transaction-submission), [js.xrpl.org](https://js.xrpl.org/) |
| **xrpl_escrow / EscrowCreate** | [EscrowCreate](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate), [EscrowCreate (interface)](https://js.xrpl.org/interfaces/EscrowCreate.html) |
| **xrpl_escrowcancel** | [EscrowCancel](https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel), [EscrowCancel (interface)](https://js.xrpl.org/interfaces/EscrowCancel.html) |
| **xrpl_escrowfinish** | [EscrowFinish](https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish), [EscrowFinish (interface)](https://js.xrpl.org/interfaces/EscrowFinish.html) |
| **xrpl_signerlistset** | [SignerListSet](https://xrpl.org/docs/references/protocol/transactions/types/signerlistset), migration 가이드의 AccountSet/SetRegularKey/SignerListSet 안내 |
| **xrpl_teccodes / xrpl_errorcodes** | [Transaction Results](https://xrpl.org/docs/references/protocol/transactions/transaction-results) |
| **xrpl_meta** | [XRPL Meta](https://xrplmeta.org/) (토큰/NFT 메타데이터 JSON API) |
| **xrpl_xls20 / xrpl_nftoken** | XLS-20 NFT — [XRPL Docs NFT](https://xrpl.org/docs/concepts/tokens/nfts) (구체 경로는 제품 채택 시 v2 §3에 고정) |
| **xrpl_xls33 / xrpl_xls70 / xrpl_xls80** | 레지스트리·Credential·MPT 등 — **사업 채택 후** v2 §3에 허용 목록으로 역병합 (v7 ADR) |
| **xrpl_flags** | [AccountSet flags (js)](https://js.xrpl.org/enums/AccountSetAsfFlags.html), [AccountRoot flags](https://js.xrpl.org/enums/LedgerEntry.AccountRootFlags.html) |
| **xrpl_publicapimethods** | [Public API methods](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/public-api-methods) (ledger, tx, account_tx, account_objects 등) |
| **xrpl핵심기능별샘플코드typescript / python** | 커뮤니티 샘플(노션·GitHub) — **참고용**; 구현 규약은 v2+v7 ADR이 우선 |
| **xrpl_rwasto / XRPL기반서비스설계가이드 / 내부·외부 지갑 가이드라인** | [XRPL Korea Dev Source 허브](http://linktr.ee/rippledevrel), [XRPL 기반 서비스 설계 가이드](https://catalyze-research.notion.site/XRPL-2bc898c680bf8044b0b5f9cac6c52b7f?pvs=74) 등 — **온보딩·키 보관·Web2+Web3 경계** 검토용 (normative 아님) |

---

## 7. Phased Delivery (v7 내부 페이즈)

권장 순서: **레저 정합(Escrow) → SLO/알럿 → 정산 금액·주기 → 분쟁 운영 → 리포트·규제 → 평판·토큰 표준**.

| Phase | 목표 | 산출물 | 유저플로 |
| --- | --- | --- | --- |
| **V7-A** | Escrow 필드·서명자·시퀀스 정합 | ADR + v2 §3 보강 + (선택) SignerList | **2·6** |
| **V7-B** | Watcher SLO·드릴 | 누락 지표·Alertmanager 운영 규칙·런북 | **3** |
| **V7-C** | 정산 금액·배치 | 단일 주기 모델·API/이벤트·Outbox 결정 | **4** |
| **V7-D** | 분쟁 운영 | 검증자 DB·자동 전이·에스컬레이션 정책 | **5** |
| **V7-E** | 리포트·감사·보관 | 서명 URL·CSV·보존 등급 | **7** |
| **V7-F** | 평판·자산 표준 | 스키마 v2·XLS 선택 레일 | **P2** |

---

## 8. API / Domain Deltas (v7 예고)

하위호환을 깨면 ADR + v2 Changelog.

| 기능 | 방향 |
| --- | --- |
| Escrow | `Owner`/`Destination`/`Account`(Finish 발신자) 명시 필드; 조건부 에스크로 옵션 |
| 집행 | 합성 해시 **폐기 일정** 또는 **환경별 완전 비활성** |
| 정산 | 금액·통화·배치 ID·확정 이벤트 |
| 감사 | 커서 API·서명 export·보존 등급 |
| 인증 | IdP 연동·mTLS 종단(프록시 외)·HSM 경로 |
| 평판 | SBT/레지스트리 어댑터·스키마 버전 |

---

## 9. Scope (In / Out)

### 9.1 In scope

1. Escrow **프로토콜 정합**과 **운영 SLO**.
2. 정산 **금액·주기** 단일화 및 API 표면 확정.
3. 분쟁 **운영 등급** 엔진(검증자·자동 전이).
4. 감사·export **규제 친화적** 패키지(보관·파기·서명 URL).
5. P2 **채택 토큈 표준**(XLS subset) 및 reputation 스키마 버전.

### 9.2 Out of scope

- 콘솔 **프론트엔드** 제품 전체.
- **메인넷 비즈니스 승인** 체크리스트 전부(플래그·ADR만).
- 특정 **국가별 규제** 구현(문서화·훅만).

---

## 10. Definition of Done — v7

- [x] **V7-A**: 프로토콜 컬럼·ingest·API + **v2 §3.2.1 매핑 표** + ADR `0005`·`0006`(집행 주체·SignerList 방향).
- [x] **V7-B (1차)**: Prometheus — `bluesafe_xrpl_subscribe_connected`, `bluesafe_xrpl_watcher_last_ledger_close_unixtime`, 간격 평균·샘플 수, `bluesafe_xrpl_backfill_account_tx_live_apply_total`; 예시 알럿 2종(`docs/prometheus/bluesafe-alerts.example.yml`); 런북 `docs/runbooks/v7-subscribe-watcher-slo.md`. (분기 DR 드릴·Clio 전환·“승인” Alertmanager 워크플로는 운영 프로세스로 후속.)
- [x] **V7-C**: 정산 **금액·통화·배치** 단일 모델 + 이벤트/API; Outbox 여부 **최종 결정** 및 코드/문서 일치.
- [x] **V7-D**: 분쟁 **검증자 영속화·다자결·SLA 자동 전이**(또는 “자동 전이 없음”을 ADR로 명시).
- [x] **V7-E**: 감사 **서명 URL export** 또는 동등한 비동기 다운로드; **보존·파기** 정책과 배치.
- [x] **V7-F**: Reputation **스키마 버전**·(선택) XLS 레일 **허용 목록**·외부 레지스트리 연계.

---

## 11. Open ADRs (v7 착수 전·중)

1. Escrow **Finish 발신자**(Destination vs Delegate)와 BlueSafe **집행 주체** 매핑 — 초안: `docs/adr/0006-xrpl-escrow-execution-actor.md`.
2. **합성 txHash** 완전 제거 시점 vs 환경 플래그 유지 기간.
3. 정산 **달력 월 vs ledger 기간** 단일 선택.
4. 알림 **Outbox** 채택 및 워커 HA.
5. 평판 **SBT 체인** vs **오프체인 레지스트리** 책임 경계.
6. **내부 지갑 vs 외부 지갑**(XRPL Korea 가이드라인 참고) — Backend2가 서명하는 범위.

---

## 12. Changelog (v6 → v7)

- **v7.0 (문서)**: v6 확장(집행 submit 옵션·KMS 경로·export 잡·알림 매트릭스·Bearer/mTLS·Alertmanager 예시)을 **전제**로, **프로토콜 정합·SLO·정산 단일화·분쟁 운영·규제 친화 export·P2 표준**을 v7 범위로 승격.
- **(코드)**: V7-A·B·C–F 1차는 §14 및 ADR `0005`–`0009`로 추적.

---

## 13. Pointer updates (sibling specs)

다음 문서 **Document Info**에 `docs/Backend2_API_Spec_v7.md` 링크를 추가한다(v7 작성과 동시 또는 직후 PR).

- `docs/Backend2_API_Spec_v1.md` §1 — **완료**
- `docs/Backend2_API_Spec_v2.md` §1 — **완료**
- `docs/Backend2_API_Spec_v3.md` §1 — **완료**
- `docs/Backend2_API_Spec_v4.md` §1 — **완료**
- `docs/Backend2_API_Spec_v5.md` §1 — **완료**
- `docs/Backend2_API_Spec_v6.md` §1 — **완료**

---

## 14. Implementation log (v7 code, repo)

| 날짜(대략) | 항목 |
| --- | --- |
| 2026-05-09 | **V7-A (1차):** `011_v7_xrpl_escrow_protocol_fields.sql` — `xrpl_txs`에 `escrow_owner`, `escrow_destination`, `escrow_offer_sequence`, `escrow_submitter_account`; `tx` / `account_tx` / validated `transactions` 스트림에서 파싱·저장; `GET /v1/xrpl/transactions/:txHash` 응답 확장; ADR `docs/adr/0005-v7-escrow-xrpl-tx-mapping.md`. |
| 2026-05-09 | **V7-A (나머지):** `Backend2_API_Spec_v2.md` §3.2.1 매핑 표; ADR `docs/adr/0006-xrpl-escrow-execution-actor.md`. |
| 2026-05-09 | **V7-C–F (1차):** Migrations `012_v7_settlement_financials.sql`, `013_v7_dispute_verifier_registry.sql`; settlement financial PATCH + `settlement.financials_attached`; verifier registry operator APIs; `DISPUTE_SLA_AUTO_ESCALATE` + review-sla scan; signed export download `GET /export/artifacts` + `GET /v1/reports/export-jobs/:id/artifact-url`; `GET /v1/operator/evidences/retention-due`; reputation outbound **`bluesafe.reputation.v2`** + `REPUTATION_XLS_ALLOWLIST`; ADR `0007`–`0009`. |

---

*End of BlueSafe Backend2 API Spec v7 (planning)*
