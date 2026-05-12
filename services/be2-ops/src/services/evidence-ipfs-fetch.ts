import { config } from "../config.js";

export async function fetchEvidenceBytesFromPublicGateway(cid: string): Promise<Buffer> {
  const base = config.evidenceVault.ipfsGatewayBase.replace(/\/$/, "");
  const url = `${base}/${cid}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IPFS gateway HTTP ${res.status} for cid`);
  }
  return Buffer.from(await res.arrayBuffer());
}
