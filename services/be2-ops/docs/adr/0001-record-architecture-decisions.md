# ADR 0001: Record architecture decisions

## Status

Accepted

## Context

Backend2 spans XRPL, IPFS-style pinning, disputes, and operations. Rationale otherwise lives only in chat or code comments.

## Decision

Maintain numbered ADRs under `docs/adr/` for cross-cutting choices (storage, evidence, auth). API contracts remain in `Backend2_API_Spec_v*.md`.

## Consequences

- Small overhead when changing boundaries; easier onboarding and audits.
