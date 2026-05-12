import { createHash } from 'crypto';
import type { Amount, Payment, TxResponse, Wallet } from 'xrpl';

import { XrplClient } from '../xrpl/XrplClient';
import { utilityBillMemo } from '../lib/memo';

/**
 * PaymentService — Layer 2.2 (월별 공과금 정산).
 *
 * Builds the Payment + Memo combo that records monthly utility
 * settlement on-ledger. The Memo carries SHA-256 hashes (not raw
 * usage values) so the figures can be revealed off-chain on demand
 * but never tampered with after the fact.
 *
 * The verifyUtilityBill() helper reproduces those hashes from raw
 * inputs so the orchestrator can compare KEPCO-side usage with the
 * landlord's invoice before sending the Payment.
 */

export interface UtilityPaymentInput {
  tenant: string;            // Account
  landlord: string;          // Destination
  /** Amount to settle (RLUSD IOU object or XRP drops string). */
  amount: Amount;
  yearMonth: string;         // "YYYY-MM"
  /** Raw KEPCO usage payload (e.g. JSON) — hashed into the memo. */
  kepcoUsagePayload: string;
  /** Raw invoice payload — hashed and compared against the usage. */
  invoicePayload: string;
  destinationTag?: number;
}

export interface VerificationResult {
  match: boolean;
  kepcoUsageHashHex: string;
  billHashHex: string;
}

export class PaymentService {
  constructor(private readonly xrpl: XrplClient) {}

  /**
   * Compare KEPCO usage and the landlord's invoice. The spec only
   * requires the hashes to be recorded on-chain, but the orchestrator
   * still needs a verdict so it can either auto-pay (match) or alert
   * the tenant (mismatch).
   *
   * Equality is semantic: callers should canonicalise both payloads
   * (e.g. canonical JSON) before passing them in so cosmetic
   * differences don't fail the check.
   */
  static verifyUtilityBill(p: Pick<UtilityPaymentInput, 'kepcoUsagePayload' | 'invoicePayload'>): VerificationResult {
    const kepcoUsageHashHex = sha256Hex(p.kepcoUsagePayload);
    const billHashHex       = sha256Hex(p.invoicePayload);
    return {
      match: kepcoUsageHashHex === billHashHex,
      kepcoUsageHashHex,
      billHashHex,
    };
  }

  /** Build a Payment carrying the UTILITY_BILL memo (no submit). */
  static buildMonthlyUtilityPayment(p: UtilityPaymentInput): Payment {
    const { kepcoUsageHashHex, billHashHex } = PaymentService.verifyUtilityBill(p);
    const memo = utilityBillMemo({
      yearMonth: p.yearMonth,
      kepcoUsageHashHex,
      billHashHex,
    });
    const tx: Payment = {
      TransactionType: 'Payment',
      Account: p.tenant,
      Destination: p.landlord,
      Amount: p.amount,
      Memos: [memo],
    };
    if (p.destinationTag !== undefined) tx.DestinationTag = p.destinationTag;
    return tx;
  }

  /**
   * End-to-end monthly settlement: verify hashes match, then submit
   * the Payment. Throws on mismatch — caller is expected to surface
   * the discrepancy to the tenant for dispute submission.
   */
  async monthlyUtilityPayment(p: UtilityPaymentInput, tenantWallet: Wallet): Promise<TxResponse> {
    const { match } = PaymentService.verifyUtilityBill(p);
    if (!match) {
      throw new Error(
        `utility-bill mismatch for ${p.yearMonth}: tenant should raise a dispute, not pay`,
      );
    }
    const tx = PaymentService.buildMonthlyUtilityPayment(p);
    return this.xrpl.signAndSubmit(tx, tenantWallet);
  }

  /** Plain Payment builder (used by InsurancePoolService etc.). */
  static buildPayment(args: {
    from: string;
    to: string;
    amount: Amount;
    destinationTag?: number;
    memos?: Payment['Memos'];
    invoiceID?: string;
  }): Payment {
    const tx: Payment = {
      TransactionType: 'Payment',
      Account: args.from,
      Destination: args.to,
      Amount: args.amount,
    };
    if (args.destinationTag !== undefined) tx.DestinationTag = args.destinationTag;
    if (args.memos)     tx.Memos     = args.memos;
    if (args.invoiceID) tx.InvoiceID = args.invoiceID;
    return tx;
  }
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
