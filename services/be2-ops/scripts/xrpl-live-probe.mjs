/**
 * W4: minimal live XRPL check (no Backend2 server). Uses `XRPL_WSS_URL` only.
 * Intended for CI `workflow_dispatch` with a repo secret, or local: `node scripts/xrpl-live-probe.mjs`
 */
import { Client } from "xrpl";

const url = (process.env.XRPL_WSS_URL || "").trim();
if (!url) {
  console.error("xrpl-live-probe: XRPL_WSS_URL is empty; set it to a testnet/devnet WSS URL.");
  process.exit(2);
}

const timeout = Math.max(5_000, Number(process.env.XRPL_REQUEST_TIMEOUT_MS || 15_000));

async function main() {
  const client = new Client(url, { timeout });
  try {
    await client.connect();
    const res = await client.request({ command: "server_info" });
    const build = res.result?.info?.build_version;
    console.log(
      JSON.stringify({
        ok: true,
        serverInfo: true,
        buildVersion: build ?? null,
      }),
    );
  } finally {
    try {
      await client.disconnect();
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }),
  );
  process.exit(1);
});
