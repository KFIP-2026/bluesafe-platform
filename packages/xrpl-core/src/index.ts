// XRPL wrapper
export { XrplClient } from './xrpl/XrplClient';

// Lib helpers
export * from './lib/time';
export * from './lib/hex';
export * from './lib/memo';
export * from './lib/condition';
export * from './lib/types';

// Services (Layer 1 → 4)
export { EscrowService } from './escrow/EscrowService';
export { MultisigService } from './multisig/MultisigService';
export { NFTService, NFT_TAXON, NFTokenMintFlags } from './nft/NFTService';
export { PaymentService } from './payment/PaymentService';
export { CredentialService, CREDENTIAL } from './credential/CredentialService';
export { DisputeService } from './dispute/DisputeService';
export { InsurancePoolService } from './insurance/InsurancePoolService';

export type { CredentialName } from './credential/CredentialService';
export type { DepositEscrowInput, StakeEscrowInput, FinishInput, CancelInput } from './escrow/EscrowService';
export type { MintResult, ContractNftInput, ReputationSbtInput, DisputeNftInput } from './nft/NFTService';
export type {
  UtilityPaymentInput,
  VerificationResult,
} from './payment/PaymentService';
export type {
  IssueCredentialInput,
  AcceptCredentialInput,
  RevokeCredentialInput,
} from './credential/CredentialService';
export type {
  DisputeMeta,
  DisputeSubmission,
  VerifierEntry,
  PanelSelectionParams,
} from './dispute/DisputeService';
