# ADR 0002: Repository implementation and storage

## Status

Accepted

## Context

The service must run locally without Postgres while production uses SQL migrations.

## Decision

- **`AppRepository`** abstracts persistence; **`MemoryRepository`** backs local/smoke flows; **`PostgresRepository`** runs `db/migrations/*.sql` at boot when `DATABASE_URL` is set.
- Domain types stay storage-agnostic; Postgres column names map in the repository layer only.

## Consequences

- Features that need new fields require both memory and Postgres paths (and a migration when using SQL).
