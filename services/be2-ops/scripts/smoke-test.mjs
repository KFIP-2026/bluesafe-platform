import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.SMOKE_PORT || 3100);

function jsonRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = { "Content-Type": "application/json" };
    if (data) headers["Content-Length"] = String(data.length);
    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let out = "";
        res.on("data", (chunk) => {
          out += chunk.toString("utf8");
        });
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode,
              body: out ? JSON.parse(out) : null,
            });
          } catch {
            resolve({
              status: res.statusCode,
              body: out,
            });
          }
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function textRequest(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path,
        method,
        headers: {},
      },
      (res) => {
        let out = "";
        res.on("data", (chunk) => {
          out += chunk.toString("utf8");
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: out,
            contentType: res.headers["content-type"],
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function uploadEvidence(contractId) {
  return new Promise((resolve, reject) => {
    const boundary = `----bs-${Date.now()}`;
    const file = fs.readFileSync("README.md");

    const pre = Buffer.from(
      [
        `--${boundary}`,
        'Content-Disposition: form-data; name="contractId"',
        "",
        contractId,
        `--${boundary}`,
        'Content-Disposition: form-data; name="category"',
        "",
        "other",
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="smoke.txt"',
        "Content-Type: text/plain",
        "",
        "",
      ].join("\r\n"),
      "utf8",
    );
    const post = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const body = Buffer.concat([pre, file, post]);

    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path: "/v1/evidences",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
      },
      (res) => {
        let out = "";
        res.on("data", (chunk) => {
          out += chunk.toString("utf8");
        });
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode,
              body: JSON.parse(out),
            });
          } catch {
            resolve({
              status: res.statusCode,
              body: out,
            });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function waitForServer() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const health = await jsonRequest("GET", "/health");
      if (health.status === 200) return;
    } catch {
      // keep polling until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Server did not become healthy in time");
}

async function runFlow() {
  const contract = await jsonRequest("POST", "/v1/contracts", {
    tenantId: "tenant_smoke",
    landlordId: "landlord_smoke",
  });
  if (contract.status !== 201) throw new Error(`contract create failed: ${JSON.stringify(contract)}`);

  const contractId = contract.body.id;

  const statusRes = await jsonRequest("PATCH", `/v1/contracts/${contractId}/status`, {
    status: "escrow_pending",
  });
  if (statusRes.status !== 200) throw new Error(`contract status patch failed: ${JSON.stringify(statusRes)}`);

  const contractsList = await jsonRequest(
    "GET",
    `/v1/contracts?limit=5&offset=0&tenantId=${encodeURIComponent("tenant_smoke")}`,
  );
  if (contractsList.status !== 200) throw new Error(`contracts list failed: ${JSON.stringify(contractsList)}`);
  if (typeof contractsList.body?.total !== "number" || !Array.isArray(contractsList.body?.items)) {
    throw new Error(`contracts list shape invalid: ${JSON.stringify(contractsList.body)}`);
  }

  const evidence = await uploadEvidence(contractId);
  if (evidence.status !== 201) throw new Error(`evidence upload failed: ${JSON.stringify(evidence)}`);

  const dispute = await jsonRequest("POST", "/v1/disputes", {
    contractId,
    raisedBy: "tenant",
    reasonCode: "UTILITY_OVERCHARGE",
    evidenceIds: [evidence.body.evidenceId],
  });
  if (dispute.status !== 201) throw new Error(`dispute create failed: ${JSON.stringify(dispute)}`);

  const toReview = await jsonRequest("PATCH", `/v1/disputes/${dispute.body.disputeId}/status`, {
    status: "under_review",
  });
  if (toReview.status !== 200) {
    throw new Error(`dispute -> under_review failed: ${JSON.stringify(toReview)}`);
  }

  const vote = await jsonRequest("POST", `/v1/disputes/${dispute.body.disputeId}/verifier-votes`, {
    verifierId: "verifier_smoke_1",
    recommendation: "cancel_to_owner",
  });
  if (vote.status !== 201) {
    throw new Error(`verifier vote failed: ${JSON.stringify(vote)}`);
  }

  const reviewState = await jsonRequest("GET", `/v1/disputes/${dispute.body.disputeId}/review-state`, undefined);
  if (reviewState.status !== 200) {
    throw new Error(`review-state failed: ${JSON.stringify(reviewState)}`);
  }
  if (reviewState.body?.quorumMet !== true) {
    throw new Error(`expected quorumMet true, got ${JSON.stringify(reviewState.body)}`);
  }

  const disputesList = await jsonRequest(
    "GET",
    `/v1/disputes?limit=10&contractId=${encodeURIComponent(contractId)}`,
  );
  if (disputesList.status !== 200) throw new Error(`disputes list failed: ${JSON.stringify(disputesList)}`);
  if (typeof disputesList.body?.total !== "number" || !Array.isArray(disputesList.body?.items)) {
    throw new Error(`disputes list shape invalid: ${JSON.stringify(disputesList.body)}`);
  }

  const decision = await jsonRequest("POST", `/v1/disputes/${dispute.body.disputeId}/decision`, {
    decision: "cancel_to_owner",
    memo: "smoke test decision",
  });
  if (decision.status !== 200) throw new Error(`decision failed: ${JSON.stringify(decision)}`);

  const execution = await jsonRequest("POST", `/v1/disputes/${dispute.body.disputeId}/execution`, {
    txType: "EscrowCancel",
    owner: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    offerSequence: 1,
    network: "testnet",
  });
  if (execution.status !== 202) throw new Error(`execution failed: ${JSON.stringify(execution)}`);

  const txHash = execution.body.txHash;

  const track = await jsonRequest("POST", "/v1/xrpl/track", {
    txHash,
    txType: "EscrowCancel",
    account: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    network: "testnet",
  });
  if (track.status !== 202) throw new Error(`track failed: ${JSON.stringify(track)}`);

  const xrplList = await jsonRequest(
    "GET",
    `/v1/xrpl/transactions?limit=20&account=${encodeURIComponent("rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe")}`,
  );
  if (xrplList.status !== 200) throw new Error(`xrpl tx list failed: ${JSON.stringify(xrplList)}`);
  if (typeof xrplList.body?.total !== "number" || !Array.isArray(xrplList.body?.items)) {
    throw new Error(`xrpl tx list shape invalid: ${JSON.stringify(xrplList.body)}`);
  }

  // First pass returns retryable(ter*) by policy, second pass resolves to tesSUCCESS.
  const backfillFirst = await jsonRequest("POST", "/v1/xrpl/backfill/account-tx", {
    account: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    resultCode: "tesSUCCESS",
  });
  if (backfillFirst.status !== 200) {
    throw new Error(`backfill first failed: ${JSON.stringify(backfillFirst)}`);
  }

  const backfillSecond = await jsonRequest("POST", "/v1/xrpl/backfill/account-tx", {
    account: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    resultCode: "tesSUCCESS",
  });
  if (backfillSecond.status !== 200) {
    throw new Error(`backfill second failed: ${JSON.stringify(backfillSecond)}`);
  }

  const tracked = await jsonRequest("GET", `/v1/xrpl/transactions/${txHash}`);
  const disputeNow = await jsonRequest("GET", `/v1/disputes/${dispute.body.disputeId}`);
  const events = await jsonRequest(
    "GET",
    `/v1/events?entityType=dispute&entityId=${encodeURIComponent(dispute.body.disputeId)}`,
  );

  const reportSum = await jsonRequest(
    "GET",
    `/v1/reports/summary?tenantId=${encodeURIComponent("tenant_smoke")}`,
  );
  if (reportSum.status !== 200) {
    throw new Error(`reports/summary failed: ${JSON.stringify(reportSum)}`);
  }
  if (!reportSum.body?.global || !reportSum.body?.scoped) {
    throw new Error(`reports/summary shape invalid: ${JSON.stringify(reportSum.body)}`);
  }

  const nd = await textRequest(
    "GET",
    `/v1/reports/audits.ndjson?limit=5000&entityType=${encodeURIComponent("dispute")}&entityId=${encodeURIComponent(dispute.body.disputeId)}`,
  );
  if (nd.status !== 200) {
    throw new Error(`reports/audits.ndjson failed: ${JSON.stringify(nd)}`);
  }
  if (!String(nd.contentType || "").toLowerCase().includes("ndjson")) {
    throw new Error(`unexpected content-type: ${nd.contentType}`);
  }
  const ndLines = nd.body.split("\n").filter((l) => l.length > 0);
  for (const line of ndLines) {
    JSON.parse(line);
  }

  const auditsKeyset = await jsonRequest("GET", "/v1/audits?limit=5");
  if (auditsKeyset.status !== 200) {
    throw new Error(`audits keyset failed: ${JSON.stringify(auditsKeyset)}`);
  }
  if (!("nextCursor" in auditsKeyset.body)) {
    throw new Error(`audits keyset missing nextCursor: ${JSON.stringify(auditsKeyset.body)}`);
  }
  if (auditsKeyset.body.nextCursor) {
    const p2 = await jsonRequest(
      "GET",
      `/v1/audits?limit=10&cursor=${encodeURIComponent(auditsKeyset.body.nextCursor)}`,
    );
    if (p2.status !== 200) {
      throw new Error(`audits cursor page failed: ${JSON.stringify(p2)}`);
    }
    if (p2.body.nextCursor != null && typeof p2.body.nextCursor !== "string") {
      throw new Error(`audits cursor nextCursor bad type: ${JSON.stringify(p2.body)}`);
    }
  }

  const evMeta = await jsonRequest(
    "PATCH",
    `/v1/operator/evidences/${encodeURIComponent(evidence.body.evidenceId)}/metadata`,
    { retentionClass: "regulated", jurisdiction: "smoke-jurisdiction" },
  );
  if (evMeta.status !== 200) {
    throw new Error(`evidence metadata patch failed: ${JSON.stringify(evMeta)}`);
  }
  if (evMeta.body?.retentionClass !== "regulated") {
    throw new Error(`evidence metadata response mismatch: ${JSON.stringify(evMeta.body)}`);
  }

  const csv = await textRequest(
    "GET",
    `/v1/reports/audits.csv?limit=200&entityType=${encodeURIComponent("dispute")}&entityId=${encodeURIComponent(dispute.body.disputeId)}`,
  );
  if (csv.status !== 200) {
    throw new Error(`reports/audits.csv failed: ${JSON.stringify(csv)}`);
  }
  if (!String(csv.contentType || "").toLowerCase().includes("csv")) {
    throw new Error(`unexpected csv content-type: ${csv.contentType}`);
  }
  const csvLines = csv.body.split("\n").filter((l) => l.length > 0);
  if (csvLines.length < 2) {
    throw new Error(`csv expected header+rows, got ${csvLines.length}`);
  }

  console.log(
    JSON.stringify(
      {
        contractId,
        disputeId: dispute.body.disputeId,
        txHash,
        trackedDisputeId: tracked.body?.disputeId || null,
        trackedOutcome: tracked.body?.outcomeClass || null,
        finalDisputeStatus: disputeNow.body?.status,
        eventCount: events.body?.count,
        retriesApplied: 2,
        reportAuditsNdjsonLines: ndLines.length,
        reportAuditsCsvLines: csvLines.length,
        auditsKeysetCount: auditsKeyset.body?.count,
      },
      null,
      2,
    ),
  );
}

async function runNotificationSmoke() {
  const post = await jsonRequest("POST", "/v1/notifications", {
    eventType: "smoke.ping",
    recipientId: "user_smoke",
    channel: "inapp",
    payload: { hello: 1 },
  });
  if (post.status !== 202) {
    throw new Error(`notification enqueue failed: ${JSON.stringify(post)}`);
  }
  if (post.body?.status !== "queued") {
    throw new Error(`expected status queued, got ${JSON.stringify(post.body)}`);
  }
  const id = post.body.id;
  for (let i = 0; i < 100; i += 1) {
    const g = await jsonRequest("GET", `/v1/notifications/${encodeURIComponent(id)}`);
    if (g.status !== 200) {
      throw new Error(`notification GET failed: ${JSON.stringify(g)}`);
    }
    if (g.body?.status === "sent") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("notification did not reach sent in time");
}

async function runV7Smoke() {
  const due = await jsonRequest("GET", "/v1/operator/evidences/retention-due");
  if (due.status !== 200) {
    throw new Error(`retention-due failed: ${JSON.stringify(due)}`);
  }
  if (typeof due.body?.count !== "number" || !Array.isArray(due.body?.items)) {
    throw new Error(`retention-due shape invalid: ${JSON.stringify(due.body)}`);
  }
  const reg = await jsonRequest("POST", "/v1/operator/dispute-verifier-registry", {
    verifierId: "v7_smoke_verifier",
    displayLabel: "Smoke verifier",
    active: true,
  });
  if (reg.status !== 201 && reg.status !== 200) {
    throw new Error(`verifier registry upsert failed: ${JSON.stringify(reg)}`);
  }
  const regList = await jsonRequest("GET", "/v1/operator/dispute-verifier-registry");
  if (regList.status !== 200 || !regList.body?.items?.some((x) => x.verifierId === "v7_smoke_verifier")) {
    throw new Error(`verifier registry list failed: ${JSON.stringify(regList)}`);
  }
  const xrplOps = await jsonRequest("GET", "/v1/operator/runtime/xrpl-operations");
  if (xrplOps.status !== 200 || xrplOps.body?.conditionalEscrowSupported !== false) {
    throw new Error(`xrpl-operations failed: ${JSON.stringify(xrplOps)}`);
  }
  const authProv = await jsonRequest("GET", "/v1/operator/runtime/auth-providers");
  if (authProv.status !== 200 || authProv.body?.headerRbac !== true) {
    throw new Error(`auth-providers failed: ${JSON.stringify(authProv)}`);
  }
  const dlq = await jsonRequest("GET", "/internal/reputation-delivery?limit=5");
  if (dlq.status !== 200 || !Array.isArray(dlq.body?.items)) {
    throw new Error(`reputation dlq list failed: ${JSON.stringify(dlq)}`);
  }
  const job = await jsonRequest("POST", "/v1/reports/export-jobs", {
    kind: "audits_ndjson",
    filter: {},
    maxExport: 200,
  });
  if (job.status !== 202) {
    throw new Error(`export job create failed: ${JSON.stringify(job)}`);
  }
  const jobId = job.body.jobId;
  let status = "pending";
  for (let i = 0; i < 80; i += 1) {
    const g = await jsonRequest("GET", `/v1/reports/export-jobs/${encodeURIComponent(jobId)}`);
    if (g.status !== 200) {
      throw new Error(`export job get failed: ${JSON.stringify(g)}`);
    }
    status = g.body.status;
    if (status === "completed" || status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (status !== "completed") {
    throw new Error(`export job did not complete: ${status}`);
  }
  const au = await jsonRequest("GET", `/v1/reports/export-jobs/${encodeURIComponent(jobId)}/artifact-url`);
  if (au.status !== 200) {
    throw new Error(`artifact-url failed: ${JSON.stringify(au)}`);
  }
  if (!au.body?.downloadPath || typeof au.body.downloadPath !== "string") {
    throw new Error(`artifact-url missing downloadPath: ${JSON.stringify(au.body)}`);
  }
  const dl = await textRequest("GET", au.body.downloadPath);
  if (dl.status !== 200) {
    throw new Error(`artifact download failed: ${dl.status}`);
  }
  if (!String(dl.contentType || "").toLowerCase().includes("ndjson")) {
    throw new Error(`artifact bad content-type: ${dl.contentType}`);
  }
}

async function run() {
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NOTIFICATION_WORKER_INTERVAL_MS: "100",
      EXPORT_JOB_WORKER_INTERVAL_MS: "50",
      BLUESAFE_EXPORT_ARTIFACT_SECRET: "smoke_export_secret",
    },
    stdio: "pipe",
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  try {
    await waitForServer();
    await runFlow();
    await runV7Smoke();
    await runNotificationSmoke();
  } catch (error) {
    if (stderr) {
      console.error(stderr);
    }
    throw error;
  } finally {
    child.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
