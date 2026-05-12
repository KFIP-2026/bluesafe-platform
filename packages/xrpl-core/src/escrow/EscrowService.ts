import type {
  Amount,
  EscrowCancel,
  EscrowCreate,
  EscrowFinish,
  TxResponse,
  Wallet,
} from 'xrpl';

import { XrplClient } from '../xrpl/XrplClient';
import { addDaysUnix, unixToRippleEpoch } from '../lib/time';
import { buildPreimageCondition, type PreimageCondition } from '../lib/condition';

/**
 * EscrowService — Layer 1 (구조적 신뢰).
 *
 * Builds the three escrow flavours described in spec §1:
 *   • deposit escrow — tenant → landlord, IOU/RLUSD, time-locked
 *   • stake escrow   — landlord → BlueSafe-controlled holder, slashable
 *   • finish/cancel  — release transactions (paired with multisig flow)
 *
 * Both create-flavours follow the same XRPL constraints:
 *   - Amount with IOU requires CancelAfter (the spec's "Token Escrow"
 *     foot-gun).
 *   - FinishAfter < CancelAfter, both expressed in Ripple Epoch
 *     (UNIX − 946,684,800).
 *   - The Condition field is optional preimage-SHA-256; when set, the
 *     matching Fulfillment must be revealed at EscrowFinish.
 */
export interface DepositEscrowInput {
  tenant: string;          // Account (sender)
  landlord: string;        // Destination
  amount: Amount;          // RLUSD IOU object or XRP drops as a string
  leaseEndUnix: number;
  finishOffsetDays?: number;   // default 7
  cancelOffsetDays?: number;   // default 30
  /** Optional preimage. Pass the same one shared with the landlord
   *  off-chain — both must reveal it to call EscrowFinish. */
  condition?: PreimageCondition;
  destinationTag?: number;
  memos?: EscrowCreate['Memos'];
}

export interface StakeEscrowInput {
  landlord: string;        // Account (sender)
  /** Holder address whose key is governed by the 2-of-3 SignerList. */
  stakeHolder: string;
  amount: Amount;
  leaseEndUnix: number;
  /** Same window as the deposit escrow so both expire together. */
  finishOffsetDays?: number;   // default 7
  cancelOffsetDays?: number;   // default 30
  destinationTag?: number;
  memos?: EscrowCreate['Memos'];
}

export interface FinishInput {
  account: string;             // sender (any signer for multisig path)
  owner: string;               // original creator of the escrow
  offerSequence: number;       // Sequence of the EscrowCreate tx
  /** Required iff the escrow was created with `Condition`. */
  fulfillment?: string;
  memos?: EscrowFinish['Memos'];
}

export interface CancelInput {
  account: string;
  owner: string;
  offerSequence: number;
  memos?: EscrowCancel['Memos'];
}

export class EscrowService {
  constructor(private readonly xrpl: XrplClient) {}

  // ─── Builders (pure) ─────────────────────────────────────────────────

  static buildDepositEscrow(p: DepositEscrowInput): EscrowCreate {
    const finishUnix = addDaysUnix(p.leaseEndUnix, p.finishOffsetDays ?? 7);
    const cancelUnix = addDaysUnix(p.leaseEndUnix, p.cancelOffsetDays ?? 30);

    const tx: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: p.tenant,
      Destination: p.landlord,
      Amount: p.amount,
      FinishAfter: unixToRippleEpoch(finishUnix),
      CancelAfter: unixToRippleEpoch(cancelUnix),  // mandatory for IOU escrow
    };
    if (p.condition)      tx.Condition      = p.condition.condition;
    if (p.destinationTag !== undefined) tx.DestinationTag = p.destinationTag;
    if (p.memos)          tx.Memos          = p.memos;
    return tx;
  }

  static buildStakeEscrow(p: StakeEscrowInput): EscrowCreate {
    const finishUnix = addDaysUnix(p.leaseEndUnix, p.finishOffsetDays ?? 7);
    const cancelUnix = addDaysUnix(p.leaseEndUnix, p.cancelOffsetDays ?? 30);

    const tx: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: p.landlord,
      Destination: p.stakeHolder,
      Amount: p.amount,
      FinishAfter: unixToRippleEpoch(finishUnix),
      CancelAfter: unixToRippleEpoch(cancelUnix),
    };
    if (p.destinationTag !== undefined) tx.DestinationTag = p.destinationTag;
    if (p.memos)          tx.Memos          = p.memos;
    return tx;
  }

  static buildFinish(p: FinishInput): EscrowFinish {
    const tx: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: p.account,
      Owner: p.owner,
      OfferSequence: p.offerSequence,
    };
    if (p.fulfillment) {
      tx.Fulfillment = p.fulfillment;
      // Re-derive the matching condition so node validation succeeds.
      tx.Condition = restoreConditionFromFulfillment(p.fulfillment);
    }
    if (p.memos) tx.Memos = p.memos;
    return tx;
  }

  static buildCancel(p: CancelInput): EscrowCancel {
    const tx: EscrowCancel = {
      TransactionType: 'EscrowCancel',
      Account: p.account,
      Owner: p.owner,
      OfferSequence: p.offerSequence,
    };
    if (p.memos) tx.Memos = p.memos;
    return tx;
  }

  // ─── Submission helpers (single-signer convenience) ──────────────────

  /**
   * Submit an escrow create as the deposit owner (tenant).
   * For the safety net (cancel after timeout) any wallet can submit
   * an EscrowCancel; this helper covers that direct path.
   */
  async submit(tx: EscrowCreate | EscrowFinish | EscrowCancel, wallet: Wallet): Promise<TxResponse> {
    return this.xrpl.signAndSubmit(tx, wallet);
  }
}

/**
 * Re-derive the PREIMAGE-SHA-256 Condition string from its Fulfillment
 * hex. EscrowFinish must include both — and they must match — for the
 * ledger to accept the release.
 */
function restoreConditionFromFulfillment(fulfillmentHex: string): string {
  const fulfillment = Buffer.from(fulfillmentHex, 'hex');
  // Fulfillment layout: A0 [len] 80 [preimage_len] [preimage]
  if (fulfillment[0] !== 0xa0 || fulfillment[2] !== 0x80) {
    throw new Error('not a PREIMAGE-SHA-256 fulfillment');
  }
  const preimageLen = fulfillment[3];
  const preimage = fulfillment.subarray(4, 4 + preimageLen);
  return buildPreimageCondition(preimage).condition;
}
