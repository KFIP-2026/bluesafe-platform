import { getAuditListDurationSnapshot } from "../services/audit-list-metrics.js";
import { getExportJobMetricsSnapshot } from "../services/export-job-metrics.js";
import { getExecutionMetricsSnapshot } from "../services/execution-metrics.js";
import { getKmsDekMetricsSnapshot } from "../services/kms-dek-metrics.js";
import { getReputationOutboundMetricsSnapshot } from "../services/reputation-outbound-metrics.js";
import { getSettlementSyncMetricsSnapshot } from "../services/settlement-sync-metrics.js";
import { getXrplOutcomeMetricsSnapshot } from "../services/xrpl-outcome-metrics.js";
import { getXrplTxPolicyMetricsSnapshot } from "../services/xrpl-tx-policy-metrics.js";
import { getXrplSubscribeHealthSnapshot } from "../services/xrpl-subscribe-state.js";
import { getXrplWatcherBackfillSnapshot } from "../services/xrpl-watcher-metrics.js";

function line(metric: string, labels: Record<string, string> | undefined, value: number | string): string {
  const lb =
    labels && Object.keys(labels).length > 0
      ? `{${Object.entries(labels)
          .map(([k, v]) => `${k}="${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
          .join(",")}}`
      : "";
  return `${metric}${lb} ${value}\n`;
}

/** Minimal Prometheus exposition for scrape targets (W5). */
export function renderPrometheusText(): string {
  const p = getXrplTxPolicyMetricsSnapshot() as Record<string, unknown>;
  const s = getXrplSubscribeHealthSnapshot() as Record<string, unknown>;
  const w = getXrplWatcherBackfillSnapshot();
  const o = getXrplOutcomeMetricsSnapshot();
  const ex = getExecutionMetricsSnapshot();
  const st = getSettlementSyncMetricsSnapshot();
  const rep = getReputationOutboundMetricsSnapshot();
  const audit = getAuditListDurationSnapshot();
  const kms = getKmsDekMetricsSnapshot();
  const exj = getExportJobMetricsSnapshot();
  let out = "";
  out += line("bluesafe_xrpl_policy_tick_total", undefined, Number(p.tickCount ?? 0));
  out += line("bluesafe_xrpl_policy_jobs_resolved_total", undefined, Number(p.jobsResolved ?? 0));
  out += line("bluesafe_xrpl_policy_exhausted_total", undefined, Number(p.policyExhausted ?? 0));
  out += line("bluesafe_xrpl_policy_job_errors_total", undefined, Number(p.jobErrors ?? 0));
  out += line("bluesafe_xrpl_subscribe_ledger_closed_events_total", undefined, Number(s.ledgerClosedEvents ?? 0));
  out += line("bluesafe_xrpl_subscribe_tx_stream_processed_total", undefined, Number(s.transactionStreamProcessed ?? 0));
  out += line("bluesafe_xrpl_subscribe_tx_stream_throttled_total", undefined, Number(s.transactionStreamThrottled ?? 0));
  out += line("bluesafe_xrpl_subscribe_disconnect_cycles_total", undefined, Number(s.disconnectCycles ?? 0));
  out += line("bluesafe_xrpl_subscribe_connected", undefined, Number(s.connectedGauge ?? 0));
  out += line("bluesafe_xrpl_watcher_last_ledger_close_unixtime", undefined, Number(s.lastLedgerCloseUnixtime ?? 0));
  const intervalAvg = s.ledgerCloseIntervalAvgSec;
  out += line(
    "bluesafe_xrpl_watcher_ledger_close_interval_avg_seconds",
    undefined,
    typeof intervalAvg === "number" && !Number.isNaN(intervalAvg) ? intervalAvg : 0,
  );
  out += line(
    "bluesafe_xrpl_watcher_ledger_close_interval_samples_total",
    undefined,
    Number(s.ledgerCloseIntervalSampleCount ?? 0),
  );
  out += line("bluesafe_xrpl_backfill_account_tx_live_apply_total", undefined, w.backfillLiveApplyTotal);
  out += line("bluesafe_xrpl_tx_reconcile_apply_total", undefined, o.reconcileApplyTotal);
  out += line("bluesafe_xrpl_tx_outcome_classified_total", { outcome: "success" }, o.outcomeSuccess);
  out += line("bluesafe_xrpl_tx_outcome_classified_total", { outcome: "retryable" }, o.outcomeRetryable);
  out += line("bluesafe_xrpl_tx_outcome_classified_total", { outcome: "final_fail" }, o.outcomeFinalFail);
  out += line("bluesafe_xrpl_tx_outcome_classified_total", { outcome: "manual_review" }, o.outcomeManualReview);
  out += line("bluesafe_dispute_execution_requested_total", { mode: "synthetic" }, ex.syntheticTotal);
  out += line("bluesafe_dispute_execution_requested_total", { mode: "ledger_tx" }, ex.ledgerTxTotal);
  out += line("bluesafe_settlement_ledger_close_touch_invocations_total", undefined, st.ledgerCloseTouchInvocations);
  out += line("bluesafe_settlement_contracts_touched_rows_total", undefined, st.contractsTouchedTotal);
  out += line("bluesafe_reputation_outbound_delivery_total", { status: "success" }, rep.deliveredOk);
  out += line("bluesafe_reputation_outbound_delivery_total", { status: "failure" }, rep.deliveredFail);
  out += line("bluesafe_audit_list_query_duration_ms", { quantile: "p50" }, audit.p50Ms);
  out += line("bluesafe_audit_list_query_duration_ms", { quantile: "p95" }, audit.p95Ms);
  out += line("bluesafe_audit_list_query_samples", undefined, audit.sampleCount);
  out += line("bluesafe_kms_http_unwrap_avg_ms", undefined, kms.kmsHttpUnwrapAvgMs);
  for (const [source, n] of Object.entries(kms.dekBySource)) {
    out += line("bluesafe_evidence_dek_resolution_total", { source }, n);
  }
  out += line("bluesafe_export_jobs_completed_total", undefined, exj.completed);
  out += line("bluesafe_export_jobs_failed_total", undefined, exj.failed);
  return out;
}
