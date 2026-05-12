import { Client, Wallet } from "xrpl";
import type { AccountObjectsResponse } from "xrpl";
import type { SubmittableTransaction } from "xrpl";
import { config } from "../config.js";
import { escrowProtocolFieldsFromTxJson, mergeTxJsonLayers } from "./xrpl-escrow-protocol.js";

export interface LiveTxStatus {
  txHash: string;
  validated: boolean;
  ledgerIndex?: number;
  resultCode?: string;
  /** rippled `tx` response `TransactionType` (e.g. `EscrowCreate`). */
  transactionType?: string;
  /** rippled `tx` response `Account` (classic address) — enables `subscribe` / `account_tx` without client-supplied account. */
  account?: string;
  /** V7-A — Escrow protocol fields when `TransactionType` is EscrowCreate|Finish|Cancel (see ADR 0005). */
  escrowOwner?: string;
  escrowDestination?: string;
  escrowOfferSequence?: number;
  escrowSubmitterAccount?: string;
}

/** Subset of Escrow ledger entry for API consumers (see js.xrpl.org LedgerEntry.Escrow). */
export interface EscrowLedgerObject {
  ledgerEntryIndex: string;
  account: string;
  destination: string;
  amount: string;
  finishAfter?: number;
  cancelAfter?: number;
  previousTxnId?: string;
  previousTxnLedgerSeq?: number;
  flags?: number;
}

export interface AccountEscrowsPage {
  escrows: EscrowLedgerObject[];
  ledgerHash?: string;
  ledgerIndex?: number;
  nextMarker?: unknown;
}

function ledgerAmountToDisplay(amount: unknown): string {
  if (typeof amount === "string") return amount;
  if (amount && typeof amount === "object") {
    return JSON.stringify(amount);
  }
  return "";
}

class XrplService {
  private client?: Client;
  private connecting = false;

  isEnabled(): boolean {
    return config.xrpl.enabled;
  }

  private async getClient(): Promise<Client> {
    if (!config.xrpl.enabled || !config.xrpl.wssUrl) {
      throw new Error("XRPL live mode is disabled");
    }
    if (this.client?.isConnected()) {
      return this.client;
    }

    if (!this.client) {
      this.client = new Client(config.xrpl.wssUrl, {
        timeout: config.xrpl.requestTimeoutMs,
      });
    }

    if (!this.client.isConnected() && !this.connecting) {
      this.connecting = true;
      try {
        await this.client.connect();
      } finally {
        this.connecting = false;
      }
    } else {
      // Wait for in-flight connection attempts from other requests.
      while (this.connecting && !this.client.isConnected()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return this.client;
  }

  async getTxStatus(txHash: string): Promise<LiveTxStatus | null> {
    const client = await this.getClient();
    try {
      const response = await client.request({
        command: "tx",
        transaction: txHash,
      });

      const result = response.result as {
        hash?: string;
        validated?: boolean;
        ledger_index?: number;
        TransactionType?: string;
        Account?: string;
        meta?: { TransactionResult?: string };
      };

      const flat = mergeTxJsonLayers(result as unknown as Record<string, unknown>);
      const escrow = escrowProtocolFieldsFromTxJson(flat);

      return {
        txHash: (typeof flat.hash === "string" ? flat.hash : result.hash) || txHash,
        validated: Boolean(result.validated),
        ledgerIndex: result.ledger_index,
        resultCode: result.meta?.TransactionResult,
        transactionType: typeof flat.TransactionType === "string" ? flat.TransactionType : undefined,
        account: typeof flat.Account === "string" && flat.Account.startsWith("r") ? flat.Account : undefined,
        ...escrow,
      };
    } catch {
      return null;
    }
  }

  /**
   * Escrow objects owned by `account` from the latest validated ledger.
   * Uses rippled `account_objects` (see XRPL account_objects, ledger_index validated).
   */
  async getAccountEscrowsPage(
    account: string,
    opts?: { limit?: number; marker?: unknown },
  ): Promise<AccountEscrowsPage> {
    const client = await this.getClient();
    const rawLimit = opts?.limit ?? 50;
    const limit = Math.min(400, Math.max(10, rawLimit));
    const response = await client.request({
      command: "account_objects",
      account,
      ledger_index: "validated",
      type: "escrow",
      limit,
      ...(opts?.marker !== undefined && opts.marker !== null ? { marker: opts.marker } : {}),
    });
    const result = response.result as AccountObjectsResponse["result"];
    const objects = result.account_objects || [];
    const escrows: EscrowLedgerObject[] = [];
    for (const o of objects) {
      if (o.LedgerEntryType !== "Escrow") continue;
      escrows.push({
        ledgerEntryIndex: String(o.index),
        account: String(o.Account),
        destination: String(o.Destination),
        amount: ledgerAmountToDisplay(o.Amount),
        finishAfter: typeof o.FinishAfter === "number" ? o.FinishAfter : undefined,
        cancelAfter: typeof o.CancelAfter === "number" ? o.CancelAfter : undefined,
        previousTxnId: o.PreviousTxnID ? String(o.PreviousTxnID) : undefined,
        previousTxnLedgerSeq:
          typeof o.PreviousTxnLgrSeq === "number" ? o.PreviousTxnLgrSeq : undefined,
        flags: typeof o.Flags === "number" ? o.Flags : undefined,
      });
    }
    return {
      escrows,
      ledgerHash: result.ledger_hash,
      ledgerIndex: typeof result.ledger_index === "number" ? result.ledger_index : undefined,
      nextMarker: result.marker,
    };
  }

  async getAccountTxResults(account: string): Promise<Record<string, LiveTxStatus>> {
    const client = await this.getClient();
    const response = await client.request({
      command: "account_tx",
      account,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 50,
    });

    const out: Record<string, LiveTxStatus> = {};
    const txs =
      (
        response.result as unknown as {
          transactions?: Array<{
            tx?: Record<string, unknown>;
            meta?: { TransactionResult?: string };
            validated?: boolean;
            ledger_index?: number;
          }>;
        }
      ).transactions || [];

    for (const entry of txs) {
      const tx = entry.tx;
      const meta = entry.meta;
      const validated = Boolean(entry.validated);
      if (!tx?.hash) continue;
      const flat = mergeTxJsonLayers(tx);
      const escrow = escrowProtocolFieldsFromTxJson(flat);
      out[String(tx.hash)] = {
        txHash: String(tx.hash),
        validated,
        ledgerIndex: typeof entry.ledger_index === "number" ? entry.ledger_index : undefined,
        resultCode: meta?.TransactionResult,
        transactionType: typeof flat.TransactionType === "string" ? flat.TransactionType : undefined,
        account:
          typeof flat.Account === "string" && flat.Account.startsWith("r") ? flat.Account : undefined,
        ...escrow,
      };
    }

    return out;
  }

  /**
   * Cheap rippled round-trip for readiness (`/health?deep=1`).
   * Uses [server_info](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/server-info-methods/server_info).
   */
  async pingRippled(): Promise<{ ok: boolean; detail?: string }> {
    if (!config.xrpl.enabled || !config.xrpl.wssUrl) {
      return { ok: true, detail: "disabled" };
    }
    try {
      const client = await this.getClient();
      await client.request({ command: "server_info" });
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "unknown error" };
    }
  }

  /** Submit a signed transaction and wait for validation (v6 execution path). */
  async submitAndWaitFromWallet(
    transaction: SubmittableTransaction,
    wallet: Wallet,
  ): Promise<{ txHash: string }> {
    const client = await this.getClient();
    const response = await client.submitAndWait(transaction, { wallet, autofill: true });
    const hash = response.result?.hash;
    if (!hash || typeof hash !== "string") {
      throw new Error("XRPL submitAndWait response missing result.hash");
    }
    return { txHash: hash.toUpperCase() };
  }
}

export const xrplService = new XrplService();
