/**
 * W4: short soak — polls `/health?deep=1` while the API runs its XRPL subscribe worker
 * (ledger + account streams). Emits a one-line JSON summary for logs / CI artifacts.
 *
 *   SMOKE_PORT=3100 node scripts/subscribe-soak.mjs
 *
 * Env: `SUBSCRIBE_SOAK_JSON=1` (default) prints final summary JSON to stdout.
 */
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.SMOKE_PORT || 3100);
const ITERATIONS = Math.max(5, Number(process.env.SUBSCRIBE_SOAK_ITERATIONS || 30));
const INTERVAL_MS = Math.max(200, Number(process.env.SUBSCRIBE_SOAK_INTERVAL_MS || 1000));
const RUN_SERVER = process.env.RUN_SERVER === "1";
const EMIT_JSON = process.env.SUBSCRIBE_SOAK_JSON !== "0";
const REPORT_PATH = process.env.SUBSCRIBE_SOAK_REPORT_PATH?.trim();

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: "localhost", port: PORT, path }, (res) => {
        let out = "";
        res.on("data", (c) => {
          out += c.toString("utf8");
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: out ? JSON.parse(out) : null });
          } catch {
            resolve({ status: res.statusCode, body: out });
          }
        });
      })
      .on("error", reject);
  });
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const started = Date.now();
  let child;
  if (RUN_SERVER) {
    child = spawn(process.execPath, ["dist/index.js"], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: "ignore",
    });
    for (let i = 0; i < 40; i += 1) {
      try {
        const h = await get("/health");
        if (h.status === 200) break;
      } catch {
        /* keep waiting */
      }
      await sleep(250);
    }
  }

  let ok = 0;
  let fail = 0;
  const deepDbOk = [];
  const deepXrpl = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    try {
      const h = await get("/health?deep=1");
      if (h.status === 200 && h.body?.ok) {
        ok += 1;
        if (h.body?.db === "ok") deepDbOk.push(1);
        if (h.body?.xrpl === "ok") deepXrpl.push(1);
      } else fail += 1;
    } catch {
      fail += 1;
    }
    process.stdout.write(`\rsubscribe-soak ${i + 1}/${ITERATIONS} ok=${ok} fail=${fail}`);
    await sleep(INTERVAL_MS);
  }
  console.log("");

  const elapsedMs = Date.now() - started;
  const summary = {
    script: "subscribe-soak",
    port: PORT,
    iterations: ITERATIONS,
    intervalMs: INTERVAL_MS,
    ok,
    fail,
    successRate: ITERATIONS ? ok / ITERATIONS : 0,
    elapsedMs,
    deepDbOkSamples: deepDbOk.length,
    deepXrplOkSamples: deepXrpl.length,
    runServer: RUN_SERVER,
  };

  if (EMIT_JSON) {
    const line = JSON.stringify(summary);
    console.log(line);
    if (REPORT_PATH) {
      fs.writeFileSync(REPORT_PATH, `${line}\n`, "utf8");
    }
  }

  if (fail > 0) {
    process.exitCode = 1;
  }
  if (child) child.kill();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
