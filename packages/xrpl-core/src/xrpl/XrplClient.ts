import {
  Client,
  Wallet,
  multisign,
  type Transaction,
  type TxResponse,
  type SubmittableTransaction,
} from 'xrpl';

/**
 * Thin wrapper around xrpl.js for BlueSafe services.
 *
 * Responsibilities:
 *   - Hold a single connection (services share it).
 *   - autofill → sign → submitAndWait for normal single-signed tx.
 *   - Multi-signature flow: signFor() returns a partial blob that can be
 *     handed to other signers; multisignAndSubmit() merges the blobs.
 */
export class XrplClient {
  private readonly client: Client;

  constructor(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  // ─── connection ──────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (!this.client.isConnected()) await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client.isConnected()) await this.client.disconnect();
  }

  raw(): Client {
    return this.client;
  }

  // ─── single-sign path ────────────────────────────────────────────────

  async autofill<T extends SubmittableTransaction>(tx: T): Promise<T> {
    return (await this.client.autofill(tx)) as T;
  }

  /**
   * Autofill, sign with one wallet, submit, and wait for validation.
   * Use this for txs where the source account has its master key
   * authority (no SignerList override required).
   */
  async signAndSubmit(
    tx: SubmittableTransaction,
    wallet: Wallet,
  ): Promise<TxResponse> {
    const filled = await this.client.autofill(tx);
    const signed = wallet.sign(filled);
    return this.client.submitAndWait(signed.tx_blob);
  }

  // ─── multi-sign path (2-of-3 escrow control) ─────────────────────────

  /**
   * Produce a partial multisig blob for `wallet`. Callers collect
   * blobs from all required signers off-chain, then pass the array
   * to {@link multisignAndSubmit}.
   *
   * The transaction must already be autofilled and have
   * `SigningPubKey: ""` set (xrpl.js handles this when `multisign=true`).
   */
  static signFor(tx: Transaction, wallet: Wallet): string {
    const { tx_blob } = wallet.sign(tx as SubmittableTransaction, true);
    return tx_blob;
  }

  async multisignAndSubmit(signedBlobs: string[]): Promise<TxResponse> {
    const combined = multisign(signedBlobs);
    return this.client.submitAndWait(combined);
  }

  /** Autofill a tx that will be multisigned later. */
  async prepareForMultisign<T extends SubmittableTransaction>(tx: T): Promise<T> {
    const filled = await this.client.autofill(tx, /* signersCount */ 3);
    return filled as T;
  }
}
