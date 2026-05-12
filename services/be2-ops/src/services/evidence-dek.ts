import { config } from "../config.js";
import { getEvidenceEncryptionKey } from "./evidence-crypto.js";
import { recordEvidenceDekResolution, recordKmsHttpUnwrapMs } from "./kms-dek-metrics.js";

/**
 * Resolve 32-byte AES data key for evidence encrypt/decrypt.
 * Priority: `EVIDENCE_ENCRYPTION_KEY` → stub DEK → HTTP unwrap sidecar.
 */
export async function resolveEvidenceDataKey(): Promise<{ key: Buffer; source: string } | undefined> {
  try {
    const envKey = getEvidenceEncryptionKey();
    if (envKey) {
      recordEvidenceDekResolution("env");
      return { key: envKey, source: "env" };
    }
  } catch (e) {
    recordEvidenceDekResolution("env_error");
    throw e;
  }

  const stub = config.evidenceVault.kmsStubDekBase64.trim();
  if (stub) {
    const buf = Buffer.from(stub, "base64");
    if (buf.length !== 32) {
      throw new Error("EVIDENCE_KMS_STUB_DEK_BASE64 must be base64 of exactly 32 bytes");
    }
    recordEvidenceDekResolution("kms_stub");
    return { key: buf, source: "kms_stub" };
  }

  const httpUrl = config.evidenceVault.kmsHttpUnwrapUrl.trim();
  if (httpUrl) {
    const wrapped = config.evidenceVault.kmsWrappedDekBase64.trim();
    if (!wrapped) {
      throw new Error("EVIDENCE_KMS_WRAPPED_DEK_BASE64 is required when EVIDENCE_KMS_HTTP_UNWRAP_URL is set");
    }
    const t0 = Date.now();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const bearer = config.evidenceVault.kmsHttpUnwrapBearer.trim();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const res = await fetch(httpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ ciphertext: wrapped }),
      signal: AbortSignal.timeout(config.evidenceVault.kmsHttpUnwrapTimeoutMs),
    });
    recordKmsHttpUnwrapMs(Date.now() - t0);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`KMS unwrap HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const body = (await res.json()) as { plaintextKeyBase64?: string };
    if (!body.plaintextKeyBase64) {
      throw new Error("KMS unwrap response missing plaintextKeyBase64");
    }
    const key = Buffer.from(body.plaintextKeyBase64, "base64");
    if (key.length !== 32) {
      throw new Error("KMS unwrap returned key that is not 32 bytes after base64 decode");
    }
    recordEvidenceDekResolution("kms_http");
    return { key, source: "kms_http" };
  }

  recordEvidenceDekResolution("none");
  return undefined;
}
