import type { EscrowCancel, EscrowFinish } from "xrpl";
import { Wallet } from "xrpl";
import { config } from "../config.js";
import { xrplService } from "./xrpl.service.js";

function buildExecutionTx(input: {
  txType: "EscrowFinish" | "EscrowCancel";
  owner: string;
  offerSequence: string | number;
}): EscrowFinish | EscrowCancel {
  if (input.txType === "EscrowCancel") {
    const tx: EscrowCancel = {
      TransactionType: "EscrowCancel",
      Account: input.owner,
      Owner: input.owner,
      OfferSequence: input.offerSequence,
    };
    return tx;
  }
  const tx: EscrowFinish = {
    TransactionType: "EscrowFinish",
    Account: input.owner,
    Owner: input.owner,
    OfferSequence: input.offerSequence,
  };
  return tx;
}

/**
 * When `BLUESAFE_EXECUTION_SUBMIT_ENABLED=1`, `BLUESAFE_EXECUTION_SUBMIT_SEED`, and XRPL live are configured,
 * signs and submits EscrowFinish/Cancel using the seed wallet (must match `owner`).
 */
export async function trySubmitDisputeExecution(params: {
  txType: "EscrowFinish" | "EscrowCancel";
  owner: string;
  offerSequence: string | number;
}): Promise<{ txHash: string } | null> {
  if (!config.execution.submitEnabled || !config.execution.submitSeed.trim()) {
    return null;
  }
  if (!xrplService.isEnabled()) {
    return null;
  }
  const wallet = Wallet.fromSeed(config.execution.submitSeed.trim());
  if (wallet.classicAddress !== params.owner) {
    throw new Error(
      `BLUESAFE_EXECUTION_SUBMIT_SEED derives address ${wallet.classicAddress} but execution owner is ${params.owner}`,
    );
  }
  const tx = buildExecutionTx(params);
  return xrplService.submitAndWaitFromWallet(tx, wallet);
}
