import type { AppRepository } from "../repository/app-repository.js";
import { recordAuditListDurationMs } from "./audit-list-metrics.js";
import { recordExportJobOutcome } from "./export-job-metrics.js";
import { nowIso } from "../utils.js";

const MAX_RESULT_BYTES = 8 * 1024 * 1024;

export function startExportJobWorker(opts: {
  getRepo: () => AppRepository;
  intervalMs: number;
  batchSize: number;
  disabled: boolean;
}): () => void {
  if (opts.disabled) {
    return () => {};
  }
  const t = setInterval(() => {
    void runExportJobTick(opts.getRepo, opts.batchSize).catch((e) => {
      console.error("[export-job-worker]", e);
    });
  }, opts.intervalMs);
  return () => clearInterval(t);
}

async function runExportJobTick(getRepo: () => AppRepository, batchSize: number): Promise<void> {
  const r = getRepo();
  const now = nowIso();
  const claimed = await r.claimExportJobsPending(batchSize, now);
  for (const job of claimed) {
    if (job.kind !== "audits_ndjson") {
      await r.updateExportJob({
        ...job,
        status: "failed",
        error: `unsupported export kind: ${job.kind}`,
        updatedAt: nowIso(),
      });
      recordExportJobOutcome("failed");
      continue;
    }
    try {
      const chunks: string[] = [];
      let exported = 0;
      let offset = 0;
      const pageSize = 500;
      while (exported < job.maxExport) {
        const take = Math.min(pageSize, job.maxExport - exported);
        const p0 = Date.now();
        const page = await r.listAuditsPage(job.filter, { limit: take, offset });
        recordAuditListDurationMs(Date.now() - p0);
        for (const log of page.items) {
          chunks.push(`${JSON.stringify(log)}\n`);
          exported += 1;
          if (exported >= job.maxExport) break;
        }
        if (page.items.length === 0) break;
        offset += page.items.length;
        if (offset >= page.total) break;
      }
      let resultNdjson = chunks.join("");
      if (Buffer.byteLength(resultNdjson, "utf8") > MAX_RESULT_BYTES) {
        resultNdjson = Buffer.from(resultNdjson, "utf8").subarray(0, MAX_RESULT_BYTES).toString("utf8");
        resultNdjson += `\n${JSON.stringify({ truncated: true, maxBytes: MAX_RESULT_BYTES })}\n`;
      }
      await r.updateExportJob({
        ...job,
        status: "completed",
        resultNdjson,
        error: undefined,
        updatedAt: nowIso(),
      });
      recordExportJobOutcome("completed");
    } catch (e) {
      await r.updateExportJob({
        ...job,
        status: "failed",
        error: e instanceof Error ? e.message : "export_failed",
        updatedAt: nowIso(),
      });
      recordExportJobOutcome("failed");
    }
  }
}
