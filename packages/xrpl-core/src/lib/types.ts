/** Domain-level types shared across BlueSafe services. */

import type { Amount } from 'xrpl';

export type Address = string;

/** Roles in a 2-of-3 multisig escrow. */
export type SignerRole = 'tenant' | 'landlord' | 'bluesafe';

export interface LeaseParties {
  tenant:   Address;
  landlord: Address;
  bluesafe: Address;     // platform co-signer (NOT a custodian)
}

export interface LeaseTerms {
  /** Off-chain ledger ID (e.g. NFTokenID hex once minted). */
  contractNftId?: string;
  parties:          LeaseParties;
  depositAmount:    Amount;     // RLUSD IOU or XRP drops string
  stakeAmount:      Amount;     // landlord skin-in-the-game
  /** Lease end as UNIX seconds. FinishAfter / CancelAfter are derived. */
  leaseEndUnix:     number;
  /** Days after `leaseEndUnix` until normal release becomes legal. */
  finishOffsetDays: number;     // spec default 7
  /** Days after `leaseEndUnix` until the safety net can refund. */
  cancelOffsetDays: number;     // spec default 30
}

export type DisputeRuling = 'TENANT_WINS' | 'LANDLORD_WINS' | 'SYSTEM_FAULT';

export const DISPUTE_SBT_KIND = {
  TENANT_WINS: ['DISPUTE_WON', 'DISPUTE_LOST', 'DEPOSIT_WITHHELD'] as const,
  LANDLORD_WINS: ['DISPUTE_WON', 'DISPUTE_LOST'] as const,
  SYSTEM_FAULT: [] as const,
} as const;

/** Stake slashing split: 70% tenant, 30% Insurance Pool (spec §4.2). */
export const SLASH_TENANT_BPS    = 7000;
export const SLASH_INSURANCE_BPS = 3000;
export const BPS_DENOM           = 10000;
