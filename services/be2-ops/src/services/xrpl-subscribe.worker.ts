import { Client } from "xrpl";
import type { LedgerStream, TransactionStream } from "xrpl";
import type { AppRepository } from "../repository/app-repository.js";
import { afterSettlementLedgerClosedEvent } from "./settlement-ledger.js";
import { emitEvent } from "../utils.js";
import { applyLiveTxStatus } from "./xrpl-tx-reconcile.js";
import { escrowProtocolFieldsFromTxJson, mergeTxJsonLayers } from "./xrpl-escrow-protocol.js";
import { TokenBucket } from "./xrpl-subscribe-rate.js";
import {
  markXrplSubscribeConnected,
  markXrplSubscribeDisconnected,
  markXrplSubscribeWorkerStarted,
  recordXrplSubscribeLedgerClosed,
  recordXrplSubscribeTransactionProcessed,
  recordXrplSubscribeTransactionThrottled,
  setXrplSubscribeSyncSnapshot,
} from "./xrpl-subscribe-state.js";

export interface XrplSubscribeWorkerOptions {
  getRepo: () => AppRepository;
  wssUrl: string;
  requestTimeoutMs: number;
  disabled: boolean;
  maxSubscribeAccounts: number;
  accountsRefreshMs: number;
  /** When true, subscribe to `transactions` in addition to `ledger` (ADR 0004). */
  transactionsStream?: boolean;
  /** Log JSON before exponential backoff reconnect sleep. */
  logReconnects?: boolean;
  /** Max `transactions` stream events processed per second (`0` = unlimited). */
  transactionStreamMaxPerSec?: number;
  /** When true, each deduped `ledgerClosed` updates V5 monthly `settlements` rows + emits `settlement.period_touched`. */
  settlementLedgerTouchEnabled?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function txHashFromStream(stream: TransactionStream): string | undefined {
  const s = stream as unknown as Record<string, unknown>;
  if (typeof s.hash === "string" && s.hash.length >= 8) return s.hash;
  const inner = (s.transaction ?? s.tx_json) as Record<string, unknown> | undefined;
  if (inner && typeof inner.hash === "string" && inner.hash.length >= 8) return inner.hash;
  return undefined;
}

function accountFromStream(stream: TransactionStream): string | undefined {
  const inner = (stream as unknown as { transaction?: Record<string, unknown>; tx_json?: Record<string, unknown> })
    .transaction ??
    (stream as unknown as { tx_json?: Record<string, unknown> }).tx_json;
  const acc = inner?.Account;
  return typeof acc === "string" && acc.startsWith("r") ? acc : undefined;
}

function txJsonFromStream(stream: TransactionStream): Record<string, unknown> | undefined {
  const inner = (stream as unknown as { transaction?: Record<string, unknown>; tx_json?: Record<string, unknown> })
    .transaction ?? (stream as unknown as { tx_json?: Record<string, unknown> }).tx_json;
  if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  return undefined;
}

async function handleTransaction(
  stream: TransactionStream,
  getRepo: () => AppRepository,
  txBucket: TokenBucket | null,
): Promise<void> {
  if (!stream.validated) return;
  if (txBucket && !txBucket.tryConsume()) {
    recordXrplSubscribeTransactionThrottled();
    return;
  }
  const hash = txHashFromStream(stream);
  if (!hash) return;
  const ledgerIndex = typeof stream.ledger_index === "number" ? stream.ledger_index : -1;
  if (ledgerIndex < 0) return;

  const r = getRepo();
  const tracked = await r.getXrplTx(hash);
  if (!tracked) return;

  const engineResult = typeof stream.engine_result === "string" ? stream.engine_result : undefined;
  const meta = stream.meta as { TransactionResult?: string } | undefined;
  const resultCode = engineResult ?? meta?.TransactionResult;

  const inserted = await r.tryRecordXrplIngestionEvent({
    ledgerIndex,
    txHash: hash,
    eventSource: "xrpl_subscribe_transaction",
    engineResult: resultCode,
  });
  if (!inserted) return;

  const inner = txJsonFromStream(stream);
  const flat = inner ? mergeTxJsonLayers(inner) : {};
  const escrow = escrowProtocolFieldsFromTxJson(flat);

  await applyLiveTxStatus(hash, {
    txHash: hash,
    validated: true,
    ledgerIndex,
    resultCode,
    account: accountFromStream(stream),
    transactionType: typeof flat.TransactionType === "string" ? flat.TransactionType : undefined,
    ...escrow,
  });
  recordXrplSubscribeTransactionProcessed();
}

async function handleLedgerClosed(
  stream: LedgerStream,
  getRepo: () => AppRepository,
  settlementTouchEnabled: boolean,
): Promise<void> {
  const ledgerIndex = stream.ledger_index;
  const r = getRepo();
  const syntheticHash = `ledger:${ledgerIndex}`;
  const inserted = await r.tryRecordXrplIngestionEvent({
    ledgerIndex,
    txHash: syntheticHash,
    eventSource: "xrpl_subscribe_ledger_closed",
  });
  if (!inserted) return;

  recordXrplSubscribeLedgerClosed(ledgerIndex);

  await emitEvent({
    eventType: "settlement.ledger_closed",
    entityType: "xrpl_ledger",
    entityId: syntheticHash,
    payload: {
      ledgerIndex,
      ledgerHash: stream.ledger_hash,
      ledgerTime: stream.ledger_time,
      txnCount: stream.txn_count,
    },
  });

  await afterSettlementLedgerClosedEvent(getRepo, stream, { touchEnabled: settlementTouchEnabled });
}

export function startXrplSubscribeWorker(opts: XrplSubscribeWorkerOptions): () => void {
  if (opts.disabled || !opts.wssUrl.trim()) {
    return () => {};
  }

  markXrplSubscribeWorkerStarted();

  let stopped = false;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let prevAccounts: string[] = [];
  let prevLedgerSubscribed = false;
  let prevTransactionsSubscribed = false;
  let reconnectAttempt = 0;

  const ledgerStreams = (): Array<"ledger" | "transactions"> => {
    return opts.transactionsStream ? ["ledger", "transactions"] : ["ledger"];
  };

  const shutdown = () => {
    stopped = true;
    if (refreshTimer) clearInterval(refreshTimer);
  };

  const runLoop = async () => {
    while (!stopped) {
      let client: Client | undefined;
      try {
        client = new Client(opts.wssUrl, { timeout: opts.requestTimeoutMs });
        const connected = client;
        const txBucket =
          opts.transactionsStream && (opts.transactionStreamMaxPerSec ?? 0) > 0
            ? new TokenBucket(opts.transactionStreamMaxPerSec!, opts.transactionStreamMaxPerSec!)
            : null;
        connected.on("transaction", (tx: TransactionStream) => {
          void handleTransaction(tx, opts.getRepo, txBucket);
        });
        connected.on("ledgerClosed", (ledger: LedgerStream) => {
          void handleLedgerClosed(ledger, opts.getRepo, opts.settlementLedgerTouchEnabled !== false);
        });

        await connected.connect();
        reconnectAttempt = 0;
        markXrplSubscribeConnected();

        const syncSubscriptions = async () => {
          if (stopped || !connected.isConnected()) return;
          const accounts = await opts.getRepo().listXrplSubscribeAccounts(opts.maxSubscribeAccounts);
          const wantTx = Boolean(opts.transactionsStream);
          const sameAccounts =
            accounts.length === prevAccounts.length && accounts.every((a, i) => a === prevAccounts[i]);
          if (sameAccounts && prevLedgerSubscribed && prevTransactionsSubscribed === wantTx) return;

          if (prevAccounts.length > 0 || prevLedgerSubscribed || prevTransactionsSubscribed) {
            const streams: Array<"ledger" | "transactions"> = [];
            if (prevLedgerSubscribed) streams.push("ledger");
            if (prevTransactionsSubscribed) streams.push("transactions");
            await connected.request({
              command: "unsubscribe",
              ...(prevAccounts.length > 0 ? { accounts: prevAccounts } : {}),
              ...(streams.length > 0 ? { streams } : {}),
            });
          }
          prevAccounts = accounts;
          prevLedgerSubscribed = true;
          prevTransactionsSubscribed = wantTx;
          await connected.request({
            command: "subscribe",
            streams: ledgerStreams(),
            ...(accounts.length > 0 ? { accounts } : {}),
          });
          setXrplSubscribeSyncSnapshot(accounts.length, true);
        };

        await syncSubscriptions();
        refreshTimer = setInterval(() => {
          void syncSubscriptions();
        }, opts.accountsRefreshMs);

        await new Promise<void>((resolve) => {
          connected.once("disconnected", () => resolve());
        });
      } catch (e) {
        console.error("[xrpl-subscribe-worker]", e);
      } finally {
        markXrplSubscribeDisconnected();
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = undefined;
        }
        try {
          await client?.disconnect();
        } catch {
          /* ignore */
        }
        prevAccounts = [];
        prevLedgerSubscribed = false;
        prevTransactionsSubscribed = false;
      }

      if (stopped) break;
      const delay = Math.min(60_000, 1000 * 2 ** reconnectAttempt);
      reconnectAttempt += 1;
      if (opts.logReconnects) {
        console.log(
          JSON.stringify({
            scope: "xrpl-subscribe-worker",
            phase: "reconnect_backoff",
            reconnectAttempt,
            delayMs: delay,
          }),
        );
      }
      await sleep(delay);
    }
  };

  void runLoop();
  return shutdown;
}
