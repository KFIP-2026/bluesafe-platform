import {
  NFTokenMintFlags,
  type NFTokenMint,
  type TransactionMetadata,
  type TxResponse,
  type Wallet,
} from 'xrpl';

import { XrplClient } from '../xrpl/XrplClient';
import { utf8ToHex } from '../lib/hex';
import { encodeMemos, type MemoInput } from '../lib/memo';
import type { DisputeRuling } from '../lib/types';

/**
 * NFTService — Layer 2.1 (계약 NFT) + Layer 3.2 (평판 SBT) +
 * Layer 4.4 (분쟁 판정 결과 NFT).
 *
 * All three flavours are XLS-20 NFTokenMint transactions with
 * Transferable disabled (the SBT property). They differ only in
 * NFTokenTaxon, URI payload, and the Memos riding alongside.
 *
 *   Taxon convention (BlueSafe-internal):
 *     1 = Contract NFT
 *     2 = Reputation SBT
 *     3 = Dispute Judgment NFT
 *
 * The `URI` field carries an IPFS / SHA-256 pointer; XRPL stores it as
 * up-to-256 hex chars.
 */

export const NFT_TAXON = {
  CONTRACT:  1,
  REPUTATION: 2,
  DISPUTE:   3,
} as const;

const SOULBOUND_FLAGS = 0;       // tfTransferable OMITTED → soulbound by default

export interface ContractNftInput {
  issuer: string;                // BlueSafe issuer wallet
  /** ipfs://... or hex hash that resolves to the signed PDF + payload. */
  uri: string;
  /** 32-byte SHA-256 of the canonicalised lease metadata, hex. */
  metadataHash: string;
  /** Property-address ciphertext hash (PII protection). */
  propertyAddrHash: string;
  tenant: string;
  landlord: string;
  depositAmountReadable: string;  // e.g. "1000 RLUSD" — for the memo only
  startUnix: number;
  endUnix: number;
  memos?: MemoInput[];
}

export interface ReputationSbtInput {
  issuer: string;                 // BlueSafe issuer
  subject: string;                // tenant or landlord
  /** Encoded stats payload (JSON / canonical) referenced by URI. */
  uri: string;
  payloadHashHex: string;
  /** Reference to prior SBT (NFTokenID hex). Empty = first issuance. */
  previousNftId?: string;
  memos?: MemoInput[];
}

export interface DisputeNftInput {
  issuer: string;
  disputeId: string | number;
  ruling: DisputeRuling;
  /** Voting tally e.g. {tenant: 3, landlord: 2, system: 0}. */
  votes: { tenant: number; landlord: number; system: number };
  /** Hashed/anonymised verifier panel (any pseudonym scheme). */
  panelAnonymizedHashes: string[];
  /** IPFS hashes of evidence bundle. */
  evidenceUris: string[];
  uri: string;                    // canonical bundle URI
  memos?: MemoInput[];
}

export class NFTService {
  constructor(private readonly xrpl: XrplClient) {}

  // ─── Builders ────────────────────────────────────────────────────────

  static buildContractNFT(p: ContractNftInput): NFTokenMint {
    const memos = encodeMemos([
      ...(p.memos ?? []),
      {
        type: 'BLUESAFE_CONTRACT',
        format: 'application/json',
        data: JSON.stringify({
          tenant:        p.tenant,
          landlord:      p.landlord,
          deposit:       p.depositAmountReadable,
          start:         p.startUnix,
          end:           p.endUnix,
          metadataHash:  p.metadataHash.toLowerCase(),
          propertyHash:  p.propertyAddrHash.toLowerCase(),
        }),
      },
    ]);

    return {
      TransactionType: 'NFTokenMint',
      Account:      p.issuer,
      NFTokenTaxon: NFT_TAXON.CONTRACT,
      URI:          uriToHex(p.uri),
      Flags:        SOULBOUND_FLAGS,    // soulbound: no tfTransferable
      Memos:        memos,
    };
  }

  /**
   * Reputation SBT — re-issued after every relevant lifecycle event. The
   * previous NFTokenID is referenced via a memo so chained history can
   * be traced without mutating earlier tokens (spec §3.2).
   */
  static buildReputationSBT(p: ReputationSbtInput): NFTokenMint {
    const memos = encodeMemos([
      ...(p.memos ?? []),
      {
        type: 'BLUESAFE_REPUTATION',
        format: 'application/json',
        data: JSON.stringify({
          subject:    p.subject,
          payload:    p.payloadHashHex.toLowerCase(),
          previous:   p.previousNftId ?? null,
        }),
      },
    ]);

    return {
      TransactionType: 'NFTokenMint',
      Account:      p.issuer,
      Destination:  p.subject,        // mint directly to the holder
      NFTokenTaxon: NFT_TAXON.REPUTATION,
      URI:          uriToHex(p.uri),
      Flags:        SOULBOUND_FLAGS,
      Memos:        memos,
    };
  }

  static buildDisputeNFT(p: DisputeNftInput): NFTokenMint {
    const memos = encodeMemos([
      ...(p.memos ?? []),
      {
        type: 'BLUESAFE_DISPUTE',
        format: 'application/json',
        data: JSON.stringify({
          disputeId: String(p.disputeId),
          ruling:    p.ruling,
          votes:     p.votes,
          panel:     p.panelAnonymizedHashes,
          evidence:  p.evidenceUris,
        }),
      },
    ]);

    return {
      TransactionType: 'NFTokenMint',
      Account:      p.issuer,
      NFTokenTaxon: NFT_TAXON.DISPUTE,
      URI:          uriToHex(p.uri),
      Flags:        SOULBOUND_FLAGS,
      Memos:        memos,
    };
  }

  // ─── Submission helpers ──────────────────────────────────────────────

  async mint(tx: NFTokenMint, issuerWallet: Wallet): Promise<MintResult> {
    const res = await this.xrpl.signAndSubmit(tx, issuerWallet);
    const meta = res.result.meta as TransactionMetadata<NFTokenMint> | undefined;
    return {
      response: res,
      nftokenId: meta && typeof meta === 'object' ? meta.nftoken_id : undefined,
    };
  }
}

export interface MintResult {
  response: TxResponse;
  nftokenId?: string;
}

function uriToHex(uri: string): string {
  // xrpl.js will reject overly long URIs; 256 chars (128 bytes) is the cap.
  if (uri.length === 0) throw new Error('URI must be non-empty');
  const hex = utf8ToHex(uri);
  if (hex.length > 512) {
    throw new Error('URI exceeds 256-byte XRPL limit after hex encoding');
  }
  return hex;
}

// re-export the OZ-style flag enum for callers that want to add Burnable etc.
export { NFTokenMintFlags };
