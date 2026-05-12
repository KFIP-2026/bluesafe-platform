import { createHmac, timingSafeEqual } from "node:crypto";

export interface ExportArtifactTokenPayload {
  jobId: string;
  exp: number;
}

/** HMAC-SHA256 signed base64url payload; `exp` is Unix seconds. */
export function signExportArtifactToken(secret: string, jobId: string, expUnixSec: number): string {
  const payloadJson = JSON.stringify({ jobId, exp: expUnixSec } satisfies ExportArtifactTokenPayload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyExportArtifactToken(secret: string, token: string): ExportArtifactTokenPayload | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payloadB64 = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(sig, "utf8");
    b = Buffer.from(expected, "utf8");
  } catch {
    return null;
  }
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  if (typeof rec.jobId !== "string" || typeof rec.exp !== "number") return null;
  if (rec.exp < Math.floor(Date.now() / 1000)) return null;
  return { jobId: rec.jobId, exp: rec.exp };
}
