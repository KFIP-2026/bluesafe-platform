import { config } from "../config.js";
import { generateCidFromHash } from "../utils.js";

export interface UploadToIpfsInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sha256: string;
}

export interface UploadToIpfsResult {
  cid: string;
  provider: "mock" | "pinata";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

class IpfsService {
  async upload(input: UploadToIpfsInput): Promise<UploadToIpfsResult> {
    if (config.ipfs.mode === "pinata") {
      return this.uploadViaPinata(input);
    }
    return {
      cid: generateCidFromHash(input.sha256),
      provider: "mock",
    };
  }

  /** V6-B: best-effort Pinata unpin (retention purge); logs only on failure. */
  async unpinIfPinata(cid: string, storageProvider: string): Promise<void> {
    if (storageProvider !== "pinata" || config.ipfs.mode !== "pinata") return;
    if (!config.ipfs.pinataJwt) return;
    const url = `${config.ipfs.pinataUnpinBaseUrl}/${encodeURIComponent(cid)}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.ipfs.pinataJwt}` },
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`Pinata unpin failed: ${response.status} ${bodyText}`);
    }
  }

  private async uploadViaPinata(input: UploadToIpfsInput): Promise<UploadToIpfsResult> {
    if (!config.ipfs.pinataJwt) {
      throw new Error("IPFS_PINATA_JWT is required when IPFS_MODE=pinata");
    }

    const maxAttempts = config.ipfs.pinataMaxAttempts;
    let attempt = 0;
    let delay = config.ipfs.pinataRetryInitialMs;
    let lastErr: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await this.pinOnce(input);
      } catch (e) {
        lastErr = e;
        if (attempt >= maxAttempts) break;
        await sleep(delay);
        delay = Math.min(config.ipfs.pinataRetryMaxMs, Math.floor(delay * 2));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private async pinOnce(input: UploadToIpfsInput): Promise<UploadToIpfsResult> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(input.buffer)], {
      type: input.mimeType || "application/octet-stream",
    });
    formData.append("file", blob, input.fileName);

    const response = await fetch(config.ipfs.pinataEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.ipfs.pinataJwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Pinata upload failed: ${response.status} ${bodyText}`);
    }

    const payload = (await response.json()) as { IpfsHash?: string };
    if (!payload.IpfsHash) {
      throw new Error("Pinata upload response does not include IpfsHash");
    }

    return {
      cid: payload.IpfsHash,
      provider: "pinata",
    };
  }
}

export const ipfsService = new IpfsService();
