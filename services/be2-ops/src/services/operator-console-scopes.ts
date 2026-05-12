import type { Request } from "express";

/** Fine-grained operator console capabilities (V8-D). Verifier/auditor routes are unchanged. */
export type OperatorConsoleScope =
  | "all"
  | "export"
  | "purge"
  | "registry"
  | "sla"
  | "outbox"
  | "evidence"
  | "dispatch"
  | "settlements"
  | "disputes";

const KNOWN: ReadonlySet<string> = new Set([
  "all",
  "export",
  "purge",
  "registry",
  "sla",
  "outbox",
  "evidence",
  "dispatch",
  "settlements",
  "disputes",
]);

/** Parse `X-Bluesafe-Operator-Scopes` (comma-separated, case-insensitive). Missing header → implicit full (`all`). */
export function parseOperatorConsoleScopes(req: Request): Set<OperatorConsoleScope> | "all" | "none" {
  const raw = req.header("x-bluesafe-operator-scopes")?.trim();
  if (!raw) return "all";
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set<OperatorConsoleScope>();
  for (const p of parts) {
    if (KNOWN.has(p)) out.add(p as OperatorConsoleScope);
  }
  if (out.size === 0) return "none";
  return out;
}

export function operatorHasConsoleScope(
  granted: Set<OperatorConsoleScope> | "all" | "none",
  required: OperatorConsoleScope,
): boolean {
  if (granted === "all") return true;
  if (granted === "none") return false;
  return granted.has("all") || granted.has(required);
}
