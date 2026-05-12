# BlueSafe Backend2

XRPL escrow·분쟁·정산·증빙·알림·감사를 다루는 **Backend2** API 서버(TypeScript / Express).  
**규범(normative) API**는 [Backend2 API Spec v2](docs/Backend2_API_Spec_v2.md)이며, v1·v3–v8 문서는 원칙·로드맵·성숙도 단계별 보강을 담는다.

---

## 문서 지도 (v1 → v8)

| 문서 | 역할 |
| --- | --- |
| [Backend2 API Spec v1](docs/Backend2_API_Spec_v1.md) | 설계 원칙·도메인·감사 불변성 등 초기 고정 |
| [Backend2 API Spec v2](docs/Backend2_API_Spec_v2.md) | **현행 `/v1` API·에러·환경 변수** (팀 온보딩의 1차 진입점) |
| [Backend2 API Spec v3](docs/Backend2_API_Spec_v3.md) | 영속화·알림·구독 등 v3 궤적 |
| [Backend2 API Spec v4](docs/Backend2_API_Spec_v4.md) | subscribe·ledger·지연 작업·헬스 등 v4 궤적 |
| [Backend2 API Spec v5](docs/Backend2_API_Spec_v5.md) | 정산·내부 훅 등 v5 궤적 |
| [Backend2 API Spec v6](docs/Backend2_API_Spec_v6.md) | 운영·export·평판 브리지 등 v6 궤적 |
| [Backend2 API Spec v7](docs/Backend2_API_Spec_v7.md) | Escrow 정합·SLO·정산 금액·레지스트리·reputation v2 등 v7 궤적 |
| [Backend2 API Spec v8](docs/Backend2_API_Spec_v8.md) | Outbox·키 경계·법무 메타·RBAC·XRPL 운영·SBT 경계 등 v8 로드맵·완료 기준 |

ADR 요약은 [docs/adr/](docs/adr/) 디렉터리를 참고한다.

---

## 유저플로 (Backend2 확정안)

엔드투엔드 관점에서 제품이 약속하는 사용자·운영 흐름이다. 세부 HTTP·필드는 **v2 스펙**과 구현(`src/index.ts` 등)이 근거가 된다.

1. **계약 등록** — 계약서/증빙 업로드 → **CID 생성·검증** (Evidence Vault, IPFS mock 또는 Pinata).
2. **Escrow 생성** — 트랜잭션 제출 후 **tx 조회에서 `validated=true`** 확인 (트랙·정합).
3. **상태 동기화** — **`subscribe` + `account_tx`** 기반 실시간·백필 동기화 (워커·멱등 ingest).
4. **월 정산** — 이벤트 수신 후 **정산 상태 갱신 + 알림** (ledger touch·settlement·notification / domain outbox 옵션).
5. **분쟁 접수** — **증빙 CID 묶음** 저장 + **케이스 상태머신** 시작 (Dispute 엔진).
6. **판정·집행** — **EscrowFinish / EscrowCancel** 실행 후 **tes / tec / tem / ter** 분기 처리 (분류기·정책 워커·집행 정책).
7. **종료·리포트** — 케이스 종료, **감사 로그·운영 리포트** (감사 API, NDJSON/CSV, export job·artifact 등).

---

## 기능 도출 (Backend2)

구현·문서·운영 경계를 한 줄씩 묶은 역할 분해다. P0는 제품 신뢰의 코어, P1은 운영·규제 친화, P2는 외부 체인·평판 브리지다.

| 구분 | 내용 |
| --- | --- |
| **P0 XRPL State Watcher** | `subscribe`, `tx`, `account_tx`, `account_objects` 기반 상태 추적 (런북·SLO·헬스는 v7·v8 문서·`docs/runbooks/` 참고). |
| **P0 Tx Outcome Classifier** | tes/tec/tem/ter 분류, 재시도·실패 종결 정책 (`delayed_jobs`·policy 워커). |
| **P0 Evidence Vault** | IPFS 업로드, CID 검증, 증빙 버전 추적 (선택 암호화·보존 클래스·legal hold 등 v8-C). |
| **P0 Dispute Case Engine** | 접수 → 검토 → 판정 → 집행 요청 상태머신 + Verifier mock(쿼럼·SLA 옵션). |
| **P0 Notification Hub** | 정산·분쟁·만료·환급 등 이벤트 발송 + 재전송 (큐·DLQ·**선택 Outbox** v8-A). |
| **P1 Operator Console API** | 계약·분쟁·정산 조회, 필터, 통계, RBAC (헤더 역할 + **선택 operator 콘솔 스코프** v8-D). |
| **P1 Audit Trail** | 판정·상태 변경·알림 등 **불변 감사 로그** (커서·CSV·비동기 export 등 v8-C). |
| **P2 Reputation Event Bridge** | 판정 결과를 **reputation v2** 이벤트로 전달; SBT·온체인은 **어댑터·외부 서비스** 경계(v8-F, `docs/reputation-v2-consumer-guide.md`). |

---

## 빠른 시작

```bash
npm install
npm run build
npm run smoke   # 기본 포트 3100, SMOKE_PORT 로 변경 가능
npm run dev     # tsx 로 로컬 실행
```

- **환경 변수·RBAC·Transport** — [Backend2 API Spec v2 §11](docs/Backend2_API_Spec_v2.md) (및 표 끝부 env 표).
- **프로덕션 Postgres** — `DATABASE_URL` 설정 시 `db/migrations/*.sql` 적용 후 `npm start` (인메모리는 개발·스모크용).

---

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run build` | `tsc` 컴파일 → `dist/` |
| `npm run start` | `node dist/index.js` |
| `npm run dev` | `tsx src/index.ts` |
| `npm run smoke` | `scripts/smoke-test.mjs` — 핵심 API 스모크 |
| `npm run subscribe-soak` | subscribe 헬스 반복 (별도 런북 참고) |

---

## 라이선스

ISC ( [package.json](package.json) )

---

*이 README는 저장소의 **진입 설명**용이다. API 계약·에러 코드·환경 변수의 단일 근거는 항상 [Backend2 API Spec v2](docs/Backend2_API_Spec_v2.md)를 따른다.*
