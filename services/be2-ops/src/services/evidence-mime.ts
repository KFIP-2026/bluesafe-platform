import type { EvidenceFile } from "../types.js";

const PDF = "application/pdf";
const JPEG = "image/jpeg";
const PNG = "image/png";
const WEBP = "image/webp";
const PLAIN = "text/plain";
const MARKDOWN = "text/markdown";
const OCTET = "application/octet-stream";

const byCategory: Record<EvidenceFile["category"], readonly string[]> = {
  contract_pdf: [PDF],
  utility_bill: [PDF, JPEG, PNG],
  photo: [JPEG, PNG, WEBP],
  receipt: [PDF, JPEG, PNG],
  other: [PDF, JPEG, PNG, WEBP, PLAIN, MARKDOWN, OCTET],
};

export function assertMimeAllowedForEvidenceCategory(mimeType: string, category: EvidenceFile["category"]): void {
  const normalized = (mimeType || OCTET).split(";")[0]!.trim().toLowerCase();
  const allowed = byCategory[category];
  if (allowed.includes(normalized)) return;
  throw new Error(`MIME type "${normalized}" is not allowed for evidence category "${category}"`);
}
