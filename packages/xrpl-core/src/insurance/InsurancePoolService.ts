import type { Amount, Payment, TxResponse, Wallet } from 'xrpl';

import { XrplClient } from '../xrpl/XrplClient';
import { PaymentService } from '../payment/PaymentService';
import { encodeMemo } from '../lib/memo';

/**
 * InsurancePoolService — Layer 3.3.
 *
 * Funding sources (spec):
 *   • 거래 수수료의 20%       → depositFromFees
 *   • 슬래싱된 Stake 100%(30%) → depositFromSlashing  *
 *   • Phase 2 외부 보험 출자  → depositFromFees with reason='partner'
 *
 *   * spec ambiguity: §1.3 says "70% tenant / 30% pool" while §3.3 says
 *     "슬래싱된 Stake 100%". DisputeService follows §1.3 (the more
 *     specific clause). InsurancePool itself just records whatever
 *     comes in — the split is the caller's concern.
 *
 * Payouts:
 *   • Verifier Pool returns SYSTEM_FAULT → compensateUser
 *
 * Every Payment carries a Memo so the audit trail (§3.3 "온체인 기록")
 * is greppable by reason.
 */
export class InsurancePoolService {
  constructor(
    private readonly xrpl: XrplClient,
    /** The pool's own XRPL address — also a 2-of-3 multisig account in production. */
    public readonly poolAccount: string,
  ) {}

  // ─── Funding ─────────────────────────────────────────────────────────

  buildDepositFromSlashing(args: {
    funder: string;          // sender (the EscrowFinish recipient redirecting funds)
    amount: Amount;
    disputeId: string;
  }): Payment {
    return PaymentService.buildPayment({
      from: args.funder,
      to:   this.poolAccount,
      amount: args.amount,
      memos: [encodeMemo({
        type: 'INSURANCE_DEPOSIT_SLASHING',
        format: 'application/json',
        data: JSON.stringify({ disputeId: args.disputeId }),
      })],
    });
  }

  buildDepositFromFees(args: {
    funder: string;          // sender (fee router or partner)
    amount: Amount;
    /** Free-form reason: "tx-fee-share", "partner-yyyymm", … */
    reason: string;
  }): Payment {
    return PaymentService.buildPayment({
      from:   args.funder,
      to:     this.poolAccount,
      amount: args.amount,
      memos: [encodeMemo({
        type: 'INSURANCE_DEPOSIT_FEES',
        format: 'text/plain',
        data:   args.reason,
      })],
    });
  }

  async depositFromSlashing(args: { amount: Amount; disputeId: string }, funderWallet: Wallet): Promise<TxResponse> {
    const tx = this.buildDepositFromSlashing({
      funder: funderWallet.classicAddress,
      amount: args.amount,
      disputeId: args.disputeId,
    });
    return this.xrpl.signAndSubmit(tx, funderWallet);
  }

  async depositFromFees(args: { amount: Amount; reason: string }, funderWallet: Wallet): Promise<TxResponse> {
    const tx = this.buildDepositFromFees({
      funder: funderWallet.classicAddress,
      amount: args.amount,
      reason: args.reason,
    });
    return this.xrpl.signAndSubmit(tx, funderWallet);
  }

  // ─── Payout ──────────────────────────────────────────────────────────

  buildCompensation(args: {
    to: string;
    amount: Amount;
    disputeId: string;
    reason: string;          // e.g. "system-fault: oracle outage 2026-04-12"
  }): Payment {
    return PaymentService.buildPayment({
      from:   this.poolAccount,
      to:     args.to,
      amount: args.amount,
      memos: [encodeMemo({
        type: 'INSURANCE_PAYOUT',
        format: 'application/json',
        data: JSON.stringify({
          disputeId: args.disputeId,
          reason:    args.reason,
        }),
      })],
    });
  }

  /**
   * Submit the compensation Payment. The pool account is multisig in
   * production, so callers should usually go through
   * MultisigService.signAndBroadcast instead — this single-wallet
   * shortcut exists for testnet / smoke testing.
   */
  async compensateUser(
    args: { to: string; amount: Amount; disputeId: string; reason: string },
    poolWallet: Wallet,
  ): Promise<TxResponse> {
    if (poolWallet.classicAddress !== this.poolAccount) {
      throw new Error('poolWallet does not match poolAccount');
    }
    const tx = this.buildCompensation(args);
    return this.xrpl.signAndSubmit(tx, poolWallet);
  }
}
