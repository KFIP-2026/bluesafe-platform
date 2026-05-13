import { Injectable } from '@nestjs/common';

type DemoSessionRecord = {
  sessionId: string;
  state: Record<string, unknown>;
  updatedAt: string;
};

@Injectable()
export class DemoSessionService {
  private readonly sessions = new Map<string, DemoSessionRecord>();

  get(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  save(sessionId: string, nextState: Record<string, unknown>) {
    const existing = this.sessions.get(sessionId);
    const state = mergeState(existing?.state ?? {}, nextState);
    const record = {
      sessionId,
      state,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, record);
    return record;
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
    return { sessionId, cleared: true };
  }
}

function mergeState(
  existing: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  return {
    ...existing,
    ...next,
    contractDraft: mergeObject(existing.contractDraft, next.contractDraft),
    chainActions: mergeObject(existing.chainActions, next.chainActions),
    settlements: mergeArray(existing.settlements, next.settlements),
    backendEvents: mergeUnique(existing.backendEvents, next.backendEvents),
  };
}

function mergeObject(left: unknown, right: unknown) {
  return {
    ...(isRecord(left) ? left : {}),
    ...(isRecord(right) ? right : {}),
  };
}

function mergeArray(left: unknown, right: unknown) {
  return Array.isArray(right) && right.length > 0 ? right : Array.isArray(left) ? left : [];
}

function mergeUnique(left: unknown, right: unknown) {
  const values = [
    ...(Array.isArray(right) ? right : []),
    ...(Array.isArray(left) ? left : []),
  ].filter((value): value is string => typeof value === 'string');
  return [...new Set(values)].slice(0, 12);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
