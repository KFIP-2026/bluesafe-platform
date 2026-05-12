# ADR 0008 — Dispute verifier registry and SLA auto-escalation (V7-D)

## Status

Accepted (2026-05-09)

## Context

Verifier votes are per dispute; operators also need a **directory** of verifier identities (governance / SignerList alignment in downstream systems). Review SLA scanning today only emitted `dispute.review_deadline_expired`.

## Decision

1. **Registry**: Table `dispute_verifier_registry` (`verifier_id` unique) with operator `GET`/`POST` under `/v1/operator/dispute-verifier-registry`. Votes remain in `dispute_verifier_votes`.
2. **SLA auto-escalation**: When `DISPUTE_SLA_AUTO_ESCALATE=1`, `POST /v1/operator/disputes/review-sla-scan` sets `escalated_at` on overdue `under_review` disputes that are not yet escalated, emits `dispute.escalated` (payload includes `source: "review_sla_auto"`), writes audit `dispute.escalated`, and enqueues the same domain notifications as manual escalate. When the flag is off, behaviour stays “deadline expired” events only.

## Consequences

- Auto-escalation is **opt-in** to avoid surprising production state transitions.
- Downstream can distinguish manual vs automatic escalation via audit `metadata.source` and event payload.
