import { Buffer } from "node:buffer";

export interface AuditCursorPayload {
  createdAt: string;
  id: string;
}

export function encodeAuditCursor(p: AuditCursorPayload): string {
  return Buffer.from(JSON.stringify({ c: p.createdAt, i: p.id }), "utf8").toString("base64url");
}

export function decodeAuditCursor(raw: string): AuditCursorPayload | null {
  try {
    const o = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { c?: unknown; i?: unknown };
    if (typeof o.c === "string" && typeof o.i === "string" && o.c.length > 0 && o.i.length > 0) {
      return { createdAt: o.c, id: o.i };
    }
  } catch {
    /* invalid */
  }
  return null;
}
