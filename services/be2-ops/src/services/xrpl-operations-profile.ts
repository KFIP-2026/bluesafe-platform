import { config } from "../config.js";

/** V8-E: XRPL connectivity / DR introspection (declarative; does not auto-select rippled mode). */
export function getXrplOperationsSnapshot(): {
  topologyProfile: "public_hub" | "dedicated" | "clio";
  rippledWssConfigured: boolean;
  drRunbookUrl: string | null;
  conditionalEscrowSupported: false;
  conditionalEscrowNote: string;
} {
  return {
    topologyProfile: config.xrpl.topologyProfile,
    rippledWssConfigured: Boolean(config.xrpl.wssUrl.trim()),
    drRunbookUrl: config.xrpl.drRunbookUrl || null,
    conditionalEscrowSupported: false,
    conditionalEscrowNote:
      "BlueSafe Backend2 MVP does not implement EscrowCreate Condition/Fulfillment paths; see docs/adr/0013-v8-conditional-escrow-not-supported.md.",
  };
}
