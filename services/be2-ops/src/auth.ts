import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import {
  operatorHasConsoleScope,
  parseOperatorConsoleScopes,
  type OperatorConsoleScope,
} from "./services/operator-console-scopes.js";

/**
 * Optional transport auth for `/v1` (independent of `BLUESAFE_AUTH` role headers).
 * When `BLUESAFE_V1_BEARER_TOKEN` and/or `BLUESAFE_MTLS_CLIENT_CERT_SUBJECT_HEADER` is set, requests must satisfy it.
 */
export function v1ApiTransportGuard(req: Request, res: Response, next: NextFunction): void {
  const bearer = config.api.v1BearerToken.trim();
  const mtlsHeader = config.api.mtlsClientCertSubjectHeader.trim();
  if (!bearer && !mtlsHeader) {
    return next();
  }
  let bearerOk = false;
  if (bearer) {
    const h = req.headers.authorization;
    bearerOk = h === `Bearer ${bearer}`;
  }
  let mtlsOk = false;
  if (mtlsHeader) {
    const v = req.header(mtlsHeader)?.trim();
    mtlsOk = Boolean(v && v.length > 0);
  }
  if (bearer && mtlsHeader) {
    if (bearerOk || mtlsOk) return next();
  } else if (bearer) {
    if (bearerOk) return next();
  } else if (mtlsOk) {
    return next();
  }
  res.status(401).json({
    errorCode: "B2_UNAUTHORIZED",
    message: "Bearer API token or mTLS proxy subject header required for /v1",
  });
}

export type BluesafeRole = "tenant" | "landlord" | "operator" | "verifier" | "auditor";

export interface BluesafeAuth {
  role: BluesafeRole;
  tenantId?: string;
  landlordId?: string;
}

const ROLES: BluesafeRole[] = ["tenant", "landlord", "operator", "verifier", "auditor"];

function parseRole(raw: string | undefined): BluesafeRole | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase().trim() as BluesafeRole;
  return ROLES.includes(r) ? r : undefined;
}

/** When `BLUESAFE_AUTH=1`, `/v1/*` requires `X-Bluesafe-Role` (and scope headers for tenant/landlord). */
export function bluesafeAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!config.auth.enabled) {
    return next();
  }
  const role = parseRole(req.header("x-bluesafe-role"));
  if (!role) {
    res.status(401).json({
      errorCode: "B2_UNAUTHORIZED",
      message: "Missing or invalid X-Bluesafe-Role (tenant|landlord|operator|verifier|auditor)",
    });
    return;
  }
  const tenantId = req.header("x-bluesafe-tenant-id")?.trim() || undefined;
  const landlordId = req.header("x-bluesafe-landlord-id")?.trim() || undefined;
  if (role === "tenant" && !tenantId) {
    res.status(401).json({
      errorCode: "B2_UNAUTHORIZED",
      message: "X-Bluesafe-Tenant-Id is required when role is tenant",
    });
    return;
  }
  if (role === "landlord" && !landlordId) {
    res.status(401).json({
      errorCode: "B2_UNAUTHORIZED",
      message: "X-Bluesafe-Landlord-Id is required when role is landlord",
    });
    return;
  }
  req.bluesafeAuth = { role, tenantId, landlordId };
  next();
}

/** V6-E: `auditor` may only use read-only HTTP methods on `/v1`. */
export function blockAuditorWriteOperations(req: Request, res: Response, next: NextFunction): void {
  if (!config.auth.enabled) {
    return next();
  }
  if (req.bluesafeAuth?.role !== "auditor") {
    return next();
  }
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD") {
    return next();
  }
  res.status(403).json({
    errorCode: "B2_FORBIDDEN",
    message: "Auditor role is read-only (GET/HEAD only on /v1)",
  });
}

export function requireRoles(...allowed: BluesafeRole[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.auth.enabled) {
      return next();
    }
    const role = req.bluesafeAuth?.role;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({
        errorCode: "B2_FORBIDDEN",
        message: `Role not allowed for this operation (need one of: ${allowed.join(", ")})`,
      });
      return;
    }
    next();
  };
}

/**
 * V8-D: when `BLUESAFE_OPERATOR_CONSOLE_SCOPES=1` and auth on, `operator` must carry a matching
 * `X-Bluesafe-Operator-Scopes` entry unless the header is omitted (then treat as full `all` for compatibility).
 * Verifier/auditor/other roles bypass this middleware.
 */
export function requireOperatorScopes(
  ...required: OperatorConsoleScope[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.auth.enabled || !config.auth.operatorConsoleScopesEnabled) {
      return next();
    }
    if (req.bluesafeAuth?.role !== "operator") {
      return next();
    }
    const granted = parseOperatorConsoleScopes(req);
    for (const r of required) {
      if (!operatorHasConsoleScope(granted, r)) {
        res.status(403).json({
          errorCode: "B2_FORBIDDEN",
          message: `Operator console scope '${r}' required (send X-Bluesafe-Operator-Scopes including '${r}' or 'all')`,
        });
        return;
      }
    }
    next();
  };
}
