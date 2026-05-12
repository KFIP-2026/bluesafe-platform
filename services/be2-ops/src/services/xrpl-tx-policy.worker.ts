import { config } from "../config.js";
import type { AppRepository } from "../repository/app-repository.js";
import type { XrplTransaction } from "../types.js";
import { emitEvent, nowIso, writeAudit } from "../utils.js";
import { recordXrplTxOutcomeClassified } from "./xrpl-outcome-metrics.js";
import { recordXrplTxPolicyTickEnd } from "./xrpl-tx-policy-metrics.js";
import { applyLiveTxStatus } from "./xrpl-tx-reconcile.js";
import { xrplService } from "./xrpl.service.js";

/**
 * Policy jobs use Postgres `delayed_jobs` in this repo; at very high scale consider an external queue
 * (SQS/PubSub) with the same payload shape.
 */
export const XRPL_TX_POLICY_JOB_KIND = "xrpl_tx_policy_probe";

export function xrplTxPolicyJobId(txHash: string): string {
  return `xrpl_policy:${txHash}`;
}

export interface XrplTxPolicyWorkerOptions {
  getRepo: () => AppRepository;
  intervalMs: number;
  /** v1 §7.3 — after this age since `lastCheckedAt`, enqueue / probe `tx` / `account_tx`. */
  pendingTimeoutMs: number;
  batchSize: number;
  /** After this many probes with no ledger resolution, mark `manual_review` (v1 §7.3 budget). */
  maxNotFoundProbes: number;
  /** Lease duration for claimed `delayed_jobs` rows (Postgres `SKIP LOCKED`). */
  lockTtlMs?: number;
  /** Upper bound for `intervalMs * 2^n` between job attempts. */
  maxBackoffMs: number;
  /** Emit structured JSON per tick for operators. */
  logSummaryTick?: boolean;
}

function policyJobBackoffMs(baseIntervalMs: number, maxBackoffMs: number, nextAttempts: number): number {
  const n = Math.min(Math.max(0, nextAttempts), 14);
  const raw = baseIntervalMs * 2 ** n;
  return Math.min(maxBackoffMs, Math.max(baseIntervalMs, raw));
}

function ageMs(lastCheckedAt: string): number {
  const t = Date.parse(lastCheckedAt);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

function isPolicyCandidate(tx: XrplTransaction): boolean {
  if (tx.validated) return false;
  if (tx.trackingStatus !== "pending_validation" && tx.trackingStatus !== "retry_scheduled") return false;
  if (tx.outcomeClass === "manual_review") return false;
  return true;
}

export function startXrplTxPolicyWorker(opts: XrplTxPolicyWorkerOptions): () => void {
  const lockTtlMs = opts.lockTtlMs ?? 120_000;

  const tick = async () => {
    if (!xrplService.isEnabled()) return;
    const r = opts.getRepo();
    const now = nowIso();
    const tickStats = {
      at: now,
      accountBackfillTried: 0,
      accountBackfillUpdated: 0,
      jobsClaimed: 0,
      jobsResolved: 0,
      jobsRequeued: 0,
      jobsDeletedStale: 0,
      jobErrors: 0,
      policyExhausted: 0,
    };
    const summary =
      opts.logSummaryTick === true
        ? { scope: "xrpl-tx-policy-worker" as const, ...tickStats }
        : null;

    const txs = await r.listXrplTxs();
    const backfillCap = config.xrplTxPolicy.accountBackfillPerTick;
    if (backfillCap > 0) {
      const missingAccount = txs
        .filter((t) => !t.account && !t.validated && isPolicyCandidate(t))
        .slice(0, backfillCap);
      for (const tx of missingAccount) {
        if (summary) summary.accountBackfillTried += 1;
        tickStats.accountBackfillTried += 1;
        try {
          const live = await xrplService.getTxStatus(tx.txHash);
          if (!live?.account?.trim()) continue;
          const latest = (await r.getXrplTx(tx.txHash)) ?? tx;
          if (latest.account) continue;
          latest.account = live.account.trim();
          latest.lastCheckedAt = nowIso();
          await r.saveXrplTx(latest);
          if (summary) summary.accountBackfillUpdated += 1;
          tickStats.accountBackfillUpdated += 1;
          await writeAudit({
            entityType: "xrpl_tx",
            entityId: tx.txHash,
            action: "xrpl.tx_account_backfilled",
            actorId: "system",
            metadata: { account: latest.account, source: "tx" },
          });
        } catch (e) {
          console.error("[xrpl-tx-policy-worker] account-backfill", tx.txHash, e);
        }
      }
    }

    for (const tx of txs) {
      if (!isPolicyCandidate(tx)) continue;
      if (ageMs(tx.lastCheckedAt) < opts.pendingTimeoutMs) continue;
      await r.createDelayedJobIfAbsent({
        id: xrplTxPolicyJobId(tx.txHash),
        kind: XRPL_TX_POLICY_JOB_KIND,
        payload: { txHash: tx.txHash },
        runAfter: now,
        attempts: 0,
        maxAttempts: 64,
        createdAt: now,
        updatedAt: now,
      });
    }

    const jobs = await r.claimDueDelayedJobs(XRPL_TX_POLICY_JOB_KIND, now, opts.batchSize, lockTtlMs);
    if (summary) summary.jobsClaimed = jobs.length;
    tickStats.jobsClaimed = jobs.length;

    for (const job of jobs) {
      const txHash = typeof job.payload.txHash === "string" ? job.payload.txHash : "";
      if (!txHash) {
        await r.deleteDelayedJob(job.id);
        if (summary) summary.jobsDeletedStale += 1;
        tickStats.jobsDeletedStale += 1;
        continue;
      }

      try {
        const tx = (await r.getXrplTx(txHash)) ?? undefined;
        if (!tx || !isPolicyCandidate(tx)) {
          await r.deleteDelayedJob(job.id);
          if (summary) summary.jobsDeletedStale += 1;
          tickStats.jobsDeletedStale += 1;
          continue;
        }

        let live = await xrplService.getTxStatus(txHash);
        if (!live && tx.account) {
          const map = await xrplService.getAccountTxResults(tx.account);
          live = map[txHash] ?? null;
        }
        if (live) {
          await applyLiveTxStatus(txHash, live);
          await r.deleteDelayedJob(job.id);
          if (summary) summary.jobsResolved += 1;
          tickStats.jobsResolved += 1;
          continue;
        }

        const latest = (await r.getXrplTx(txHash)) ?? tx;
        const probes = latest.retries + 1;
        const updated: XrplTransaction = {
          ...latest,
          retries: probes,
          lastCheckedAt: nowIso(),
        };
        if (probes >= opts.maxNotFoundProbes) {
          updated.outcomeClass = "manual_review";
          updated.resultCode = updated.resultCode ?? "not_found_after_policy";
          updated.trackingStatus = "validated_fail";
          updated.validated = false;
          await r.saveXrplTx(updated);
          recordXrplTxOutcomeClassified("manual_review");
          await r.deleteDelayedJob(job.id);
          if (summary) summary.jobsResolved += 1;
          tickStats.jobsResolved += 1;
          tickStats.policyExhausted += 1;
          await writeAudit({
            entityType: "xrpl_tx",
            entityId: txHash,
            action: "xrpl.tx_policy_exhausted",
            actorId: "system",
            metadata: { probes, account: tx.account ?? null },
          });
          await emitEvent({
            eventType: "xrpl.tx_policy_exhausted",
            entityType: "xrpl_tx",
            entityId: txHash,
            payload: { probes, account: tx.account ?? null, resultCode: updated.resultCode },
          });
        } else {
          await r.saveXrplTx(updated);
          const nextAttempts = job.attempts + 1;
          const backoff = policyJobBackoffMs(opts.intervalMs, opts.maxBackoffMs, nextAttempts);
          await r.bumpDelayedJob({
            id: job.id,
            runAfter: new Date(Date.now() + backoff).toISOString(),
            attempts: nextAttempts,
            updatedAt: nowIso(),
          });
          if (summary) summary.jobsRequeued += 1;
          tickStats.jobsRequeued += 1;
        }
      } catch (e) {
        console.error("[xrpl-tx-policy-worker]", job.id, e);
        if (summary) summary.jobErrors += 1;
        tickStats.jobErrors += 1;
        const nextAttempts = job.attempts + 1;
        const backoff = policyJobBackoffMs(opts.intervalMs, opts.maxBackoffMs, nextAttempts);
        await r.bumpDelayedJob({
          id: job.id,
          runAfter: new Date(Date.now() + backoff).toISOString(),
          attempts: nextAttempts,
          lastError: e instanceof Error ? e.message : String(e),
          updatedAt: nowIso(),
        });
        if (summary) summary.jobsRequeued += 1;
        tickStats.jobsRequeued += 1;
      }
    }

    recordXrplTxPolicyTickEnd(tickStats);

    if (summary) {
      Object.assign(summary, tickStats);
      console.log(JSON.stringify(summary));
    }
  };

  const id = setInterval(() => {
    void tick();
  }, opts.intervalMs);
  void tick();
  return () => clearInterval(id);
}
