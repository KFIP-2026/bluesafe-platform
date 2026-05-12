import { createHash, randomBytes } from 'crypto';
import type { TxResponse, Wallet } from 'xrpl';

import { XrplClient } from '../xrpl/XrplClient';
import { EscrowService } from '../escrow/EscrowService';
import { NFTService } from '../nft/NFTService';
import { PaymentService } from '../payment/PaymentService';
import type {
  DisputeRuling,
  LeaseParties,
} from '../lib/types';
import { SLASH_TENANT_BPS, BPS_DENOM } from '../lib/types';

/**
 * DisputeService — Layer 4 (Verifier Pool & 자동 라우팅).
 *
 * XRPL has no on-chain governance primitive, so the panel selection,
 * vote collection, and majority computation all happen in this
 * service's in-memory store. The *consequences* of a verdict are
 * always XRPL transactions:
 *
 *   TENANT_WINS    → EscrowCancel(deposit) + Payment(stake → tenant 70%
 *                    & InsurancePool 30%)  + Reputation SBT updates
 *   LANDLORD_WINS  → EscrowFinish(deposit) + EscrowFinish(stake)
 *                    + Reputation SBT updates
 *   SYSTEM_FAULT   → EscrowCancel(deposit, refund tenant)
 *                    + EscrowFinish(stake → landlord)
 *                    + InsurancePool compensation handled separately
 *
 * The mintDisputeNFT step (§4.4) is appended in every case so the
 * judgment itself is on-chain immutable.
 */

export interface DisputeMeta {
  leaseId: string;
  parties: LeaseParties;
  /** Ripple ledger-side identifiers needed to release the escrows. */
  depositEscrow: { owner: string; sequence: number; fulfillment?: string };
  stakeEscrow:   { owner: string; sequence: number };
  /** Used in slashing math. */
  stakeAmountDrops?: string;
  /** Used to mint dispute NFT URI; must be set by orchestrator. */
  evidenceUris: string[];
}

export interface DisputeSubmission {
  disputeId: string;
  claimant: string;             // tenant or landlord wallet address
  evidenceHashHex: string;
  openedAtUnix: number;
  votingDeadlineUnix: number;
  panel: string[];              // selected verifier addresses
  votes: Map<string, DisputeRuling>;
  withdrawn: boolean;
  ruling?: DisputeRuling;
  executedTxs?: string[];       // hashes of every tx the verdict produced
  meta: DisputeMeta;
}

export interface VerifierEntry {
  address: string;
  active: boolean;
  /** Off-chain inputs used to filter out conflicts (region, brokerage). */
  region?: string;
  brokerages?: string[];
  /** Track-record. */
  casesHandled: number;
  votesWithMajority: number;
}

export interface PanelSelectionParams {
  /** Spec says 3~5 verifiers; default 5 for tie-breakability. */
  panelSize?: number;
  excludeAddresses?: string[];        // tenant + landlord automatically added
  excludeRegion?: string;
  excludeBrokerages?: string[];
}

export class DisputeService {
  private readonly disputes = new Map<string, DisputeSubmission>();
  private readonly verifiers = new Map<string, VerifierEntry>();

  /** Voting window. */
  votingPeriodSeconds = 7 * 24 * 60 * 60;
  /** Slashing destinations are configured by the orchestrator at boot. */
  insurancePoolAccount: string;

  constructor(
    private readonly xrpl: XrplClient,
    private readonly escrow: EscrowService,
    private readonly nft: NFTService,
    private readonly payment: PaymentService,
    insurancePoolAccount: string,
  ) {
    this.insurancePoolAccount = insurancePoolAccount;
  }

  // ─── Roster management ───────────────────────────────────────────────

  registerVerifier(v: Omit<VerifierEntry, 'casesHandled' | 'votesWithMajority' | 'active'>): void {
    if (this.verifiers.has(v.address)) throw new Error('verifier already registered');
    this.verifiers.set(v.address, { ...v, active: true, casesHandled: 0, votesWithMajority: 0 });
  }

  deactivateVerifier(address: string): void {
    const entry = this.verifiers.get(address);
    if (!entry) throw new Error('verifier not found');
    entry.active = false;
  }

  listVerifiers(): VerifierEntry[] {
    return [...this.verifiers.values()];
  }

  // ─── Submit / select / collect / execute ─────────────────────────────

  submitDispute(args: {
    claimant: string;
    evidenceHashHex: string;
    meta: DisputeMeta;
    panelSelection?: PanelSelectionParams;
  }): DisputeSubmission {
    const { tenant, landlord } = args.meta.parties;
    if (args.claimant !== tenant && args.claimant !== landlord) {
      throw new Error('claimant must be a lease party');
    }

    const disputeId = randomDisputeId();
    const openedAtUnix = Math.floor(Date.now() / 1000);
    const panel = this.selectVerifiers({
      ...args.panelSelection,
      excludeAddresses: [
        ...(args.panelSelection?.excludeAddresses ?? []),
        tenant,
        landlord,
      ],
    });

    const submission: DisputeSubmission = {
      disputeId,
      claimant: args.claimant,
      evidenceHashHex: args.evidenceHashHex,
      openedAtUnix,
      votingDeadlineUnix: openedAtUnix + this.votingPeriodSeconds,
      panel,
      votes: new Map(),
      withdrawn: false,
      meta: args.meta,
    };
    this.disputes.set(disputeId, submission);
    return submission;
  }

  /**
   * Pseudo-random selection — sufficient for off-chain panel draw, since
   * every verdict is anchored on-chain via mintDisputeNFT and the panel
   * itself is published in the dispute NFT memo (verifiable after the
   * fact).
   */
  selectVerifiers(opts: PanelSelectionParams = {}): string[] {
    const panelSize = opts.panelSize ?? 5;
    const exclude = new Set(opts.excludeAddresses ?? []);
    const eligible = [...this.verifiers.values()].filter((v) => {
      if (!v.active || exclude.has(v.address)) return false;
      if (opts.excludeRegion && v.region === opts.excludeRegion) return false;
      if (opts.excludeBrokerages && v.brokerages?.some((b) => opts.excludeBrokerages!.includes(b))) {
        return false;
      }
      return true;
    });
    if (eligible.length < panelSize) {
      throw new Error(`not enough eligible verifiers: have ${eligible.length}, need ${panelSize}`);
    }
    // Fisher-Yates partial shuffle.
    const arr = eligible.map((v) => v.address);
    for (let i = arr.length - 1; i > arr.length - 1 - panelSize; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(arr.length - panelSize);
  }

  collectVote(disputeId: string, verifier: string, ruling: DisputeRuling): void {
    const d = this.requireOpen(disputeId);
    if (!d.panel.includes(verifier)) throw new Error('not on panel');
    if (d.votes.has(verifier))       throw new Error('already voted');
    d.votes.set(verifier, ruling);

    const entry = this.verifiers.get(verifier);
    if (entry) entry.casesHandled++;
  }

  withdrawDispute(disputeId: string, claimant: string): void {
    const d = this.requireOpen(disputeId);
    if (d.claimant !== claimant) throw new Error('not the claimant');
    d.withdrawn = true;
  }

  /**
   * Compute the verdict (majority if reached, plurality with system-
   * fault tiebreak after the deadline) and submit every consequential
   * XRPL transaction.
   *
   * Wallets:
   *   - bluesafeWallet must be a co-signer on the escrow holder
   *     (covers EscrowFinish/EscrowCancel via multisig externally).
   *   - issuerWallet mints the dispute NFT and reputation updates.
   *   - poolFunderWallet drives the slashing redistribution Payment.
   *
   * For brevity this method submits each tx with `bluesafeWallet`
   * directly — production code should route the multisig blobs through
   * MultisigService.signAndBroadcast() when EscrowFinish/Cancel
   * actually requires a quorum.
   */
  async executeJudgment(args: {
    disputeId: string;
    bluesafeWallet: Wallet;
    issuerWallet: Wallet;
    poolFunderWallet: Wallet;
    /** URI for the dispute judgment NFT (ipfs://...). */
    judgmentUri: string;
    /** Hashed/anonymised panel addresses for §4.4 NFT memo. */
    panelAnonymizedHashes: string[];
  }): Promise<DisputeSubmission> {
    const d = this.requireOpen(args.disputeId);
    const ruling = this.computeRuling(d);
    d.ruling = ruling;
    d.executedTxs = [];

    const tally = countVotes(d);

    // 1. Settle escrows according to the ruling.
    if (ruling === 'TENANT_WINS') {
      await this.cancelDeposit(d, args.bluesafeWallet);
      await this.slashStake(d, args.poolFunderWallet);
    } else if (ruling === 'LANDLORD_WINS') {
      await this.finishDeposit(d, args.bluesafeWallet);
      await this.finishStake(d, args.bluesafeWallet);
    } else {
      await this.cancelDeposit(d, args.bluesafeWallet);
      await this.finishStake(d, args.bluesafeWallet);
      // SYSTEM_FAULT compensation is initiated separately via
      // InsurancePoolService.compensateUser by the orchestrator.
    }

    // 2. Mint the dispute judgment NFT (§4.4).
    const disputeNft = NFTService.buildDisputeNFT({
      issuer: args.issuerWallet.classicAddress,
      disputeId: d.disputeId,
      ruling,
      votes: tally,
      panelAnonymizedHashes: args.panelAnonymizedHashes,
      evidenceUris: d.meta.evidenceUris,
      uri: args.judgmentUri,
    });
    const mintRes = await this.nft.mint(disputeNft, args.issuerWallet);
    pushHash(d, mintRes.response);

    // 3. Track verifier accuracy.
    for (const [v, vote] of d.votes) {
      if (vote === ruling) {
        const entry = this.verifiers.get(v);
        if (entry) entry.votesWithMajority++;
      }
    }

    return d;
  }

  // ─── Internal: ruling math ───────────────────────────────────────────

  private computeRuling(d: DisputeSubmission): DisputeRuling {
    const tally = countVotes(d);
    const majority = Math.floor(d.panel.length / 2) + 1;
    if (tally.tenant   >= majority) return 'TENANT_WINS';
    if (tally.landlord >= majority) return 'LANDLORD_WINS';
    if (tally.system   >= majority) return 'SYSTEM_FAULT';
    if (Math.floor(Date.now() / 1000) < d.votingDeadlineUnix) {
      throw new Error('no majority yet and voting still open');
    }
    // Plurality after deadline; tie defaults to SYSTEM_FAULT (no slashing).
    if (tally.tenant > tally.landlord && tally.tenant > tally.system)   return 'TENANT_WINS';
    if (tally.landlord > tally.tenant && tally.landlord > tally.system) return 'LANDLORD_WINS';
    return 'SYSTEM_FAULT';
  }

  // ─── Internal: settlement helpers ────────────────────────────────────

  private async cancelDeposit(d: DisputeSubmission, signer: Wallet): Promise<void> {
    const tx = EscrowService.buildCancel({
      account:        signer.classicAddress,
      owner:          d.meta.depositEscrow.owner,
      offerSequence:  d.meta.depositEscrow.sequence,
    });
    pushHash(d, await this.xrpl.signAndSubmit(tx, signer));
  }

  private async finishDeposit(d: DisputeSubmission, signer: Wallet): Promise<void> {
    const tx = EscrowService.buildFinish({
      account:        signer.classicAddress,
      owner:          d.meta.depositEscrow.owner,
      offerSequence:  d.meta.depositEscrow.sequence,
      fulfillment:    d.meta.depositEscrow.fulfillment,
    });
    pushHash(d, await this.xrpl.signAndSubmit(tx, signer));
  }

  private async finishStake(d: DisputeSubmission, signer: Wallet): Promise<void> {
    const tx = EscrowService.buildFinish({
      account:        signer.classicAddress,
      owner:          d.meta.stakeEscrow.owner,
      offerSequence:  d.meta.stakeEscrow.sequence,
    });
    pushHash(d, await this.xrpl.signAndSubmit(tx, signer));
  }

  /**
   * Stake slashing: 70% to tenant, 30% to InsurancePool. We first
   * EscrowFinish the stake into a "pool funder" account and then split
   * via two Payments. Real deployments route this through the
   * 2-of-3 SignerList holding the stake account.
   */
  private async slashStake(d: DisputeSubmission, funder: Wallet): Promise<void> {
    if (!d.meta.stakeAmountDrops) {
      throw new Error('slashStake requires meta.stakeAmountDrops (XRP drops as string)');
    }
    const finishStake = EscrowService.buildFinish({
      account:        funder.classicAddress,
      owner:          d.meta.stakeEscrow.owner,
      offerSequence:  d.meta.stakeEscrow.sequence,
    });
    pushHash(d, await this.xrpl.signAndSubmit(finishStake, funder));

    const total      = BigInt(d.meta.stakeAmountDrops);
    const toTenant   = (total * BigInt(SLASH_TENANT_BPS)) / BigInt(BPS_DENOM);
    const toInsurance = total - toTenant;

    const tenantPay = PaymentService.buildPayment({
      from:   funder.classicAddress,
      to:     d.meta.parties.tenant,
      amount: toTenant.toString(),
    });
    const poolPay = PaymentService.buildPayment({
      from:   funder.classicAddress,
      to:     this.insurancePoolAccount,
      amount: toInsurance.toString(),
    });
    pushHash(d, await this.xrpl.signAndSubmit(tenantPay, funder));
    pushHash(d, await this.xrpl.signAndSubmit(poolPay, funder));
  }

  // ─── Internal: helpers ───────────────────────────────────────────────

  private requireOpen(id: string): DisputeSubmission {
    const d = this.disputes.get(id);
    if (!d) throw new Error('dispute not found');
    if (d.withdrawn) throw new Error('dispute withdrawn');
    if (d.ruling)    throw new Error('dispute already executed');
    return d;
  }

  // ─── Read API ────────────────────────────────────────────────────────

  getDispute(id: string): DisputeSubmission | undefined {
    return this.disputes.get(id);
  }
}

// ───────────────────────────────────────────────────────────────────────

function countVotes(d: DisputeSubmission): { tenant: number; landlord: number; system: number } {
  let tenant = 0, landlord = 0, system = 0;
  for (const r of d.votes.values()) {
    if      (r === 'TENANT_WINS')   tenant++;
    else if (r === 'LANDLORD_WINS') landlord++;
    else if (r === 'SYSTEM_FAULT')  system++;
  }
  return { tenant, landlord, system };
}

function pushHash(d: DisputeSubmission, res: TxResponse): void {
  const hash = (res.result as { hash?: string }).hash;
  if (hash) d.executedTxs!.push(hash);
}

function randomDisputeId(): string {
  return createHash('sha256').update(randomBytes(16)).digest('hex').slice(0, 24);
}
