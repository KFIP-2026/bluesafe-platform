import crypto from "node:crypto";
import { config } from "../config.js";

export const EVIDENCE_ENCRYPTION_SCHEME = "aes-256-gcm-v1" as const;

/** Returns undefined when no key configured (store plaintext). Host KMS: inject 32-byte key via env/secret store. */
export function getEvidenceEncryptionKey(): Buffer | undefined {
  const raw = config.evidenceVault.encryptionKeyBase64.trim();
  if (!raw) return undefined;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("EVIDENCE_ENCRYPTION_KEY must be base64 encoding of exactly 32 bytes");
  }
  return buf;
}

/**
 * Layout: 12-byte IV | ciphertext | 16-byte GCM auth tag (Node cipher.final includes tag handling via setAuthTag on decrypt).
 */
export function decryptEvidenceBuffer(payload: Buffer, key: Buffer): Buffer {
  if (payload.length < 12 + 16) throw new Error("ciphertext too short");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(payload.length - 16);
  const enc = payload.subarray(12, payload.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function encryptEvidenceBuffer(plaintext: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]);
}
