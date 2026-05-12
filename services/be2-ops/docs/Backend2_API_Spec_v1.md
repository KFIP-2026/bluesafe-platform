# BlueSafe Backend2 API Spec v1

## 1. Document Info
- Version: `v1.0`
- Owner: `Backend2`
- Scope: `Evidence Vault`, `Dispute Case Engine`, `XRPL State Watcher`, `Tx Outcome Classifier`, `Notification Hub`, `Audit Trail`
- Status: `Draft for implementation`
- **구현·진척 추적:** API·런타임·로드맵은 `docs/Backend2_API_Spec_v2.md`(normative), `docs/Backend2_API_Spec_v3.md`, `docs/Backend2_API_Spec_v4.md`, **`docs/Backend2_API_Spec_v5.md`(v4 이후 단계)**, **`docs/Backend2_API_Spec_v6.md`**, **`docs/Backend2_API_Spec_v7.md`(v6 이후 운영·프로토콜 정합·SLO)** 및 `bluesafe-backend2-plan.canvas.tsx`를 본다. v1은 W1 설계 계약(도메인·원칙)의 기준선으로 유지한다.

## 2. Purpose
이 문서는 Backend2의 W1 산출물(`ADR + API 초안`)을 바로 구현 가능한 수준으로 고정하기 위한 통합 명세다.

핵심 목표:
- 계약/분쟁 증빙의 `IPFS CID` 기반 무결성 보장
- XRPL 트랜잭션 상태(`validated`) 기준의 일관된 상태 전이
- `tes/tec/tem/ter` 기반 실패 분류와 재시도 정책 표준화
- 운영사 콘솔에서 케이스 이력을 완전 추적 가능하게 설계

## 3. Official Docs Mapping

### 3.1 Core XRPL
- `@xrpl.js`
- `@xrpl_http/wss`
- `@xrpl_publicapimethods`
  - `tx`
  - `account_tx`
  - `account_objects`
  - `subscribe`

### 3.2 Escrow/Execution
- `@xrpl_escrowcreate`
- `@xrpl_escrowfinish`
- `@xrpl_escrowcancel`
- `@xrpl_signerlistset`

### 3.3 Failure Classification
- `@xrpl_teccodes`
- `@xrpl_errorcodes`
- `@xrpl_flags`

### 3.4 Evidence/Metadata
- `@xrpl_meta`
- `@xrpl_nftoken`
- `@xrpl_xls20`

## 4. Architecture Boundaries

### 4.1 In Scope (Backend2)
- Evidence upload/verify/versioning
- Dispute case lifecycle and verifier mock decision
- XRPL tx status polling/subscription and normalized state update
- Tx outcome classification and retry/final-fail policy
- Event emission and notification trigger
- Audit log write/read API

### 4.2 Out of Scope (Handled by other roles)
- Escrow transaction creation/signing implementation details (Blockchain Lead)
- Main contract/orchestration and full ledger strategy
- Mobile/console UI rendering

## 5. Domain Model (W1 Fixed)

### 5.1 Contract
- `id`
- `tenantId`
- `landlordId`
- `status` (`draft`, `escrow_pending`, `escrow_validated`, `active`, `closed`, `cancelled`)
- `escrowCreateTxHash`
- `createdAt`, `updatedAt`

### 5.2 EvidenceFile
- `id`
- `contractId`
- `disputeId` (nullable)
- `uploaderId`
- `category` (`contract_pdf`, `utility_bill`, `photo`, `receipt`, `other`)
- `cid`
- `sha256`
- `mimeType`
- `sizeBytes`
- `version`
- `isEncrypted`
- `createdAt`

### 5.3 DisputeCase
- `id`
- `contractId`
- `raisedBy` (`tenant`, `landlord`, `operator`)
- `reasonCode`
- `status` (`filed`, `under_review`, `decided`, `execution_pending`, `executed`, `closed`, `rejected`)
- `evidenceBundleId`
- `createdAt`, `updatedAt`

### 5.4 CaseDecision
- `id`
- `disputeId`
- `decision` (`finish_to_tenant`, `finish_to_landlord`, `cancel_to_owner`, `partial_manual`)
- `decidedBy` (`verifier_mock`)
- `memo`
- `createdAt`

### 5.5 XrplTransaction
- `id`
- `txHash`
- `txType` (`EscrowCreate`, `EscrowFinish`, `EscrowCancel`, `Payment`, ...)
- `network` (`testnet`, `mainnet`)
- `validated` (boolean)
- `ledgerIndex` (nullable)
- `resultCode` (nullable)
- `outcomeClass` (`success`, `retryable`, `final_fail`, `manual_review`)
- `retries`
- `lastCheckedAt`

### 5.6 NotificationEvent
- `id`
- `eventType`
- `recipientId`
- `channel` (`push`, `email`, `inapp`)
- `status` (`queued`, `sent`, `failed`, `retry_scheduled`)
- `payload`
- `createdAt`

### 5.7 AuditLog
- `id`
- `entityType`
- `entityId`
- `action`
- `actorId`
- `before`
- `after`
- `metadata`
- `createdAt`

## 6. State Machines (W1 Fixed)

### 6.1 Contract State
- `draft -> escrow_pending`
- `escrow_pending -> escrow_validated | cancelled`
- `escrow_validated -> active`
- `active -> closed | cancelled`

### 6.2 Dispute State
- `filed -> under_review`
- `under_review -> decided | rejected`
- `decided -> execution_pending`
- `execution_pending -> executed | rejected`
- `executed -> closed`

### 6.3 Tx Tracking State
- `created -> submitted -> pending_validation`
- `pending_validation -> validated_success`
- `pending_validation -> validated_fail`
- `pending_validation -> retry_scheduled`
- `retry_scheduled -> submitted`

## 7. Tx Outcome Classifier Policy

### 7.1 Minimum Classification
- `tes*` -> `success`
- `tec*` -> `manual_review` (validated but business-fail)
- `tem*` -> `final_fail` (invalid request/format)
- `ter*` -> `retryable`

### 7.2 Retry Rules
- Max retries: `3`
- Backoff: `10s`, `30s`, `90s`
- Retry targets: only `retryable`
- `manual_review` and `final_fail` are never auto-retried

### 7.3 Fallback Rules
- `pending_validation` over timeout (`120s`) -> trigger `account_tx` backfill check
- Not found in both `tx` and `account_tx` after retry budget -> `manual_review`

## 8. Event Contract (W1 Fixed)

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
- `evidence.uploaded`
- `evidence.verified`
- `escrow.tx_submitted`
- `escrow.tx_validated`
- `escrow.tx_failed`
- `dispute.filed`
- `dispute.decision_recorded`
- `dispute.execution_requested`
- `notification.requested`
- `notification.sent`
- `notification.failed`

## 9. API Spec v1

Base path: `/v1`

### 9.1 Evidence Vault

#### POST `/v1/evidences`
증빙 파일 업로드 + CID/해시 저장

Request (multipart):
- `file`
- `contractId`
- `disputeId` (optional)
- `category`

Response `201`:
```json
{
  "evidenceId": "evd_001",
  "cid": "bafy...",
  "sha256": "abc123...",
  "version": 1,
  "createdAt": "2026-05-09T01:00:00Z"
}
```

#### POST `/v1/evidences/verify`
CID 무결성 검증

Request:
```json
{
  "cid": "bafy...",
  "expectedSha256": "abc123..."
}
```

Response `200`:
```json
{
  "verified": true,
  "cid": "bafy...",
  "actualSha256": "abc123..."
}
```

#### GET `/v1/evidences/{evidenceId}`
증빙 메타 조회

### 9.2 Dispute Case Engine

#### POST `/v1/disputes`
분쟁 케이스 생성

Request:
```json
{
  "contractId": "ctr_001",
  "raisedBy": "tenant",
  "reasonCode": "UTILITY_OVERCHARGE",
  "evidenceIds": ["evd_001", "evd_002"]
}
```

Response `201`:
```json
{
  "disputeId": "dsp_001",
  "status": "filed",
  "createdAt": "2026-05-09T01:00:00Z"
}
```

#### POST `/v1/disputes/{disputeId}/decision`
Verifier mock 판정 기록

Request:
```json
{
  "decision": "cancel_to_owner",
  "memo": "Mock majority decision"
}
```

Response `200`:
```json
{
  "disputeId": "dsp_001",
  "status": "decided",
  "decisionId": "dcs_001"
}
```

#### POST `/v1/disputes/{disputeId}/execution`
EscrowFinish/EscrowCancel 집행 요청

Request:
```json
{
  "txType": "EscrowCancel",
  "owner": "rOwner...",
  "offerSequence": 10
}
```

Response `202`:
```json
{
  "requestId": "exec_001",
  "status": "execution_pending"
}
```

### 9.3 XRPL State Watcher

#### POST `/v1/xrpl/track`
tx 추적 등록

Request:
```json
{
  "txHash": "ABCDEF...",
  "txType": "EscrowCreate",
  "network": "testnet"
}
```

Response `202`:
```json
{
  "txHash": "ABCDEF...",
  "trackingStatus": "pending_validation"
}
```

#### GET `/v1/xrpl/transactions/{txHash}`
정규화된 트랜잭션 상태 조회

Response `200`:
```json
{
  "txHash": "ABCDEF...",
  "validated": true,
  "resultCode": "tesSUCCESS",
  "outcomeClass": "success",
  "ledgerIndex": 123456
}
```

#### POST `/v1/xrpl/backfill/account-tx`
계정 기준 누락 tx 보정 실행 (internal or operator)

### 9.4 Notification/Audit

#### POST `/v1/notifications`
알림 발송 요청

#### GET `/v1/audits`
감사로그 조회 (`entityType`, `entityId`, `from`, `to`)

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

## 11. Security Requirements
- Evidence object encryption at rest (KMS-backed key envelope recommended)
- RBAC required: `tenant`, `landlord`, `operator`, `verifier`
- Evidence download and dispute decision must write audit logs
- PII must not be stored in XRPL memo directly

## 12. W1/W2 Definition of Done

### 12.1 W1 Done
- Domain model finalized and reviewed
- State machines finalized
- Event types and payload schema fixed
- API endpoints and error model fixed
- Tx outcome policy fixed (`tes/tec/tem/ter`)

### 12.2 W2 Done
- Evidence upload/verify APIs implemented
- CID and SHA-256 integrity checks passing
- Versioning works for repeated uploads
- Audit log emitted for upload/verify/download
- Test coverage for success/failure/permission cases

## 13. Open Decisions (To lock in ADR)
- Final pinning provider selection and retention policy
- Encryption boundary (client-side vs server-side encryption)
- Dispute evidence max file size and allowed MIME list
- Notification provider and retry dead-letter strategy
- Mainnet activation gate criteria

