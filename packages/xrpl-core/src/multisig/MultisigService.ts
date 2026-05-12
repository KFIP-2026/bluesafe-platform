import type {
  AccountSet,
  SignerEntry,
  SignerListSet,
  Transaction,
  TxResponse,
  Wallet,
} from 'xrpl';

import { XrplClient } from '../xrpl/XrplClient';
import type { LeaseParties } from '../lib/types';

/**
 * MultisigService — Layer 1.2 (3자 멀티시그).
 *
 * The escrow holder account installs a SignerList of {tenant, landlord,
 * BlueSafe} each at weight 1, with SignerQuorum = 2. From that point on
 * the master key becomes optional (the spec recommends disabling it via
 * `asfDisableMaster` so BlueSafe alone can never move funds).
 *
 * Multisig flow:
 *   1. {@link buildSignerListSet} → submit ONCE with the master key.
 *   2. (optional) {@link buildDisableMaster} → master key off.
 *   3. For every escrow-modifying tx:
 *        a. autofill via {@link XrplClient.prepareForMultisign}
 *        b. each signer runs {@link signFor}
 *        c. {@link broadcast} merges the partial blobs and submits
 */
export class MultisigService {
  constructor(private readonly xrpl: XrplClient) {}

  // ─── Setup ───────────────────────────────────────────────────────────

  static buildSignerListSet(holderAccount: string, parties: LeaseParties): SignerListSet {
    const entries: SignerEntry[] = [
      { SignerEntry: { Account: parties.tenant,   SignerWeight: 1 } },
      { SignerEntry: { Account: parties.landlord, SignerWeight: 1 } },
      { SignerEntry: { Account: parties.bluesafe, SignerWeight: 1 } },
    ];
    return {
      TransactionType: 'SignerListSet',
      Account: holderAccount,
      SignerQuorum: 2,
      SignerEntries: entries,
    };
  }

  /** Remove the SignerList — equivalent to closing out the lease. */
  static buildSignerListClear(holderAccount: string): SignerListSet {
    return {
      TransactionType: 'SignerListSet',
      Account: holderAccount,
      SignerQuorum: 0,
    };
  }

  /**
   * Set asfDisableMaster (flag 4) on the holder account so the master
   * key can no longer sign — only the SignerList can.
   * Caller must have at least one regular key or signer-list entry
   * already in place, per XRPL safety check.
   */
  static buildDisableMaster(holderAccount: string): AccountSet {
    return {
      TransactionType: 'AccountSet',
      Account: holderAccount,
      SetFlag: 4,   // asfDisableMaster
    };
  }

  // ─── Submission shortcuts ────────────────────────────────────────────

  async submitSignerList(holderWallet: Wallet, parties: LeaseParties): Promise<TxResponse> {
    const tx = MultisigService.buildSignerListSet(holderWallet.classicAddress, parties);
    return this.xrpl.signAndSubmit(tx, holderWallet);
  }

  // ─── Per-tx multisig orchestration ───────────────────────────────────

  /**
   * Returns an autofilled transaction primed for multisig (Sequence,
   * Fee, LastLedgerSequence in place; SigningPubKey blank).
   */
  async prepare<T extends Transaction>(tx: T): Promise<T> {
    return this.xrpl.prepareForMultisign(tx as any) as Promise<T>;
  }

  /** Each co-signer calls this with their own wallet on the SAME prepared tx. */
  static signFor(tx: Transaction, wallet: Wallet): string {
    return XrplClient.signFor(tx, wallet);
  }

  /** Combine ≥ quorum partial blobs and submit. */
  async broadcast(signedBlobs: string[]): Promise<TxResponse> {
    if (signedBlobs.length < 2) {
      throw new Error('need at least 2 signed blobs to meet quorum');
    }
    return this.xrpl.multisignAndSubmit(signedBlobs);
  }

  /**
   * End-to-end helper: prepare → collect signatures from `signers` →
   * broadcast. `signers` must be exactly the wallets approving (≥ 2).
   */
  async signAndBroadcast<T extends Transaction>(tx: T, signers: Wallet[]): Promise<TxResponse> {
    const prepared = await this.prepare(tx);
    const blobs = signers.map((w) => MultisigService.signFor(prepared, w));
    return this.broadcast(blobs);
  }
}
