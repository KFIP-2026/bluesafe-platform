import type { AuditLog } from "../types.js";

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function auditLogCsvHeader(): string {
  return [
    "id",
    "entityType",
    "entityId",
    "action",
    "actorId",
    "createdAt",
    "beforeJson",
    "afterJson",
    "metadataJson",
  ].join(",");
}

export function auditLogToCsvRow(log: AuditLog): string {
  const beforeJson = log.before != null ? JSON.stringify(log.before) : "";
  const afterJson = log.after != null ? JSON.stringify(log.after) : "";
  const metadataJson = log.metadata != null ? JSON.stringify(log.metadata) : "";
  return [
    csvCell(log.id),
    csvCell(log.entityType),
    csvCell(log.entityId),
    csvCell(log.action),
    csvCell(log.actorId),
    csvCell(log.createdAt),
    csvCell(beforeJson),
    csvCell(afterJson),
    csvCell(metadataJson),
  ].join(",");
}
