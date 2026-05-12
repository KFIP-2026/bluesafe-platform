import { config } from "../config.js";
import { xrplService } from "./xrpl.service.js";

/**
 * MVP synthetic txHash path is allowed only when env allows non-zero synthetic AND deployment tier is `dev`.
 * `strict` tier never uses the synthetic branch (ADR 0011).
 */
export function syntheticExecutionPathEffective(): boolean {
  return config.execution.syntheticExecutionHashEnabled && config.execution.deploymentTier === "dev";
}

/** Operator/health introspection for dispute execution safety. */
export function getExecutionPolicySnapshot(): {
  deploymentTier: "dev" | "strict";
  syntheticExecutionHashEnvEnabled: boolean;
  syntheticExecutionPathEffective: boolean;
  submitEnabled: boolean;
  submitSeedConfigured: boolean;
  xrplLive: boolean;
  conditionalEscrowSupported: false;
  conditionalEscrowAdr: string;
  warnings: string[];
} {
  const syntheticEnv = config.execution.syntheticExecutionHashEnabled;
  const syntheticEffective = syntheticExecutionPathEffective();
  const submitSeedConfigured = Boolean(config.execution.submitSeed.trim());
  const submitConfigured = Boolean(config.execution.submitEnabled && submitSeedConfigured);
  const xrplLive = xrplService.isEnabled();
  const warnings: string[] = [];
  if (syntheticEffective) {
    warnings.push(
      "Synthetic execution txHash placeholder path is on (dev tier). For staging/production use BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict and pass ledger txHash or enable execution submit — docs/adr/0011-v8-execution-keys-synthetic-hash.md",
    );
  }
  if (config.execution.deploymentTier === "strict" && syntheticEnv && !syntheticEffective) {
    warnings.push(
      "BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict disables the synthetic hash path regardless of BLUESAFE_SYNTHETIC_EXECUTION_HASH.",
    );
  }
  if (config.execution.submitEnabled && !submitSeedConfigured) {
    warnings.push("BLUESAFE_EXECUTION_SUBMIT_ENABLED=1 but BLUESAFE_EXECUTION_SUBMIT_SEED is empty.");
  }
  if (submitConfigured && !xrplLive) {
    warnings.push("Execution submit is configured but XRPL_WSS_URL is not set (rippled not live).");
  }
  return {
    deploymentTier: config.execution.deploymentTier,
    syntheticExecutionHashEnvEnabled: syntheticEnv,
    syntheticExecutionPathEffective: syntheticEffective,
    submitEnabled: config.execution.submitEnabled,
    submitSeedConfigured,
    xrplLive,
    conditionalEscrowSupported: false,
    conditionalEscrowAdr: "docs/adr/0013-v8-conditional-escrow-not-supported.md",
    warnings,
  };
}
