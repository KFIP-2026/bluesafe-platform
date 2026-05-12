import type {
  AuthorizeCredential,
  CredentialAccept,
  CredentialCreate,
  CredentialDelete,
  LedgerEntry,
  PermissionedDomainSet,
  TxResponse,
  Wallet,
} from 'xrpl';

type CredentialLedgerEntry = LedgerEntry.Credential;

import { XrplClient } from '../xrpl/XrplClient';
import { utf8ToHex } from '../lib/hex';

/**
 * CredentialService — Layer 3.1 (XLS-70 KYC/KYB) + Layer 3.4 (XLS-80
 * Permissioned Domain).
 *
 * Lifecycle:
 *   issuer  → CredentialCreate  (announces a credential offer)
 *   subject → CredentialAccept  (acknowledges, makes it active)
 *   issuer  → CredentialDelete  (revoke at any time)
 *
 * Permissioned Domain ties everything together: only addresses holding
 * a valid credential of one of the AcceptedCredentials types may
 * interact with the domain (e.g. create leases under it).
 */

export const CREDENTIAL = {
  FOREIGN_RESIDENT_KYC: 'FOREIGN_RESIDENT_KYC',
  LANDLORD_KYB:         'LANDLORD_KYB',
  VERIFIER:             'VERIFIER',
} as const;

export type CredentialName = (typeof CREDENTIAL)[keyof typeof CREDENTIAL];

export interface IssueCredentialInput {
  issuer: string;            // BlueSafe (or delegated KYC partner)
  subject: string;
  credentialType: CredentialName | string;
  /** UNIX seconds; the contract converts to Ripple Epoch. */
  expirationUnix?: number;
  /** Off-chain document pointer (ipfs:// or https://). Stored as URI. */
  documentUri?: string;
}

export interface AcceptCredentialInput {
  subject: string;           // tx is signed by the subject
  issuer: string;
  credentialType: CredentialName | string;
}

export interface RevokeCredentialInput {
  issuer: string;            // tx signed by the issuer
  subject: string;
  credentialType: CredentialName | string;
}

export class CredentialService {
  constructor(private readonly xrpl: XrplClient) {}

  // ─── Builders ────────────────────────────────────────────────────────

  static buildIssue(p: IssueCredentialInput): CredentialCreate {
    const tx: CredentialCreate = {
      TransactionType: 'CredentialCreate',
      Account: p.issuer,
      Subject: p.subject,
      CredentialType: utf8ToHex(p.credentialType),   // XLS-70 expects hex
    };
    if (p.expirationUnix !== undefined) {
      // CredentialCreate.Expiration is in Ripple Epoch.
      tx.Expiration = unixToRipple(p.expirationUnix);
    }
    if (p.documentUri) tx.URI = utf8ToHex(p.documentUri);
    return tx;
  }

  static buildAccept(p: AcceptCredentialInput): CredentialAccept {
    return {
      TransactionType: 'CredentialAccept',
      Account: p.subject,
      Issuer: p.issuer,
      CredentialType: utf8ToHex(p.credentialType),
    };
  }

  static buildRevoke(p: RevokeCredentialInput): CredentialDelete {
    return {
      TransactionType: 'CredentialDelete',
      Account: p.issuer,
      Subject: p.subject,
      Issuer:  p.issuer,
      CredentialType: utf8ToHex(p.credentialType),
    };
  }

  /**
   * Build a PermissionedDomainSet that admits any address holding one of
   * the listed credentials from BlueSafe (or delegated issuers).
   */
  static buildDomainSet(args: {
    owner: string;                          // domain controller
    domainId?: string;                      // omit to create, set to update
    issuers: { issuer: string; credentialType: CredentialName | string }[];
  }): PermissionedDomainSet {
    const accepted: AuthorizeCredential[] = args.issuers.map((i) => ({
      Credential: {
        Issuer: i.issuer,
        CredentialType: utf8ToHex(i.credentialType),
      },
    }));
    const tx: PermissionedDomainSet = {
      TransactionType: 'PermissionedDomainSet',
      Account: args.owner,
      AcceptedCredentials: accepted,
    };
    if (args.domainId) tx.DomainID = args.domainId;
    return tx;
  }

  // ─── Submission shortcuts ────────────────────────────────────────────

  async issue(p: IssueCredentialInput, issuerWallet: Wallet): Promise<TxResponse> {
    return this.xrpl.signAndSubmit(CredentialService.buildIssue(p), issuerWallet);
  }

  async accept(p: AcceptCredentialInput, subjectWallet: Wallet): Promise<TxResponse> {
    return this.xrpl.signAndSubmit(CredentialService.buildAccept(p), subjectWallet);
  }

  async revoke(p: RevokeCredentialInput, issuerWallet: Wallet): Promise<TxResponse> {
    return this.xrpl.signAndSubmit(CredentialService.buildRevoke(p), issuerWallet);
  }

  /**
   * Lookup a credential ledger object via account_objects RPC.
   * Returns the object if active, undefined if missing or expired.
   */
  async verifyCredential(p: AcceptCredentialInput): Promise<CredentialLedgerEntry | undefined> {
    const res = await this.xrpl.raw().request({
      command: 'account_objects',
      account: p.subject,
      type: 'credential',
    });
    const wantedType = utf8ToHex(p.credentialType);
    const match = res.result.account_objects.find(
      (o): o is CredentialLedgerEntry =>
        o.LedgerEntryType === 'Credential' &&
        (o as CredentialLedgerEntry).Issuer === p.issuer &&
        (o as CredentialLedgerEntry).CredentialType === wantedType,
    );
    if (!match) return undefined;
    if (match.Expiration !== undefined && match.Expiration <= currentRippleEpoch()) {
      return undefined;
    }
    return match;
  }
}

// ─── tiny inline epoch helpers (avoid circular import) ───────────────────

function unixToRipple(unixSeconds: number): number {
  return Math.floor(unixSeconds) - 946_684_800;
}
function currentRippleEpoch(): number {
  return unixToRipple(Math.floor(Date.now() / 1000));
}
