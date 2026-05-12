/** In-process snapshot for `/health?deep=1` (W4 observability). */

const state = {
  started: false,
  connected: false,
  lastConnectedAt: undefined as string | undefined,
  lastDisconnectedAt: undefined as string | undefined,
  accountsSubscribed: 0,
  ledgerStreamSubscribed: false,
  lastLedgerIndex: undefined as number | undefined,
  ledgerClosedEvents: 0,
  disconnectCycles: 0,
  transactionStreamProcessed: 0,
  transactionStreamThrottled: 0,
};

/** V7-B: wall-clock spacing between validated `ledgerClosed` events (SLO / Alertmanager). */
let lastLedgerCloseWallSec = 0;
let ledgerCloseIntervalSumSec = 0;
let ledgerCloseIntervalSampleCount = 0;

export function markXrplSubscribeWorkerStarted(): void {
  state.started = true;
}

export function markXrplSubscribeConnected(): void {
  state.connected = true;
  state.lastConnectedAt = new Date().toISOString();
}

export function markXrplSubscribeDisconnected(): void {
  state.connected = false;
  state.lastDisconnectedAt = new Date().toISOString();
  state.disconnectCycles += 1;
  state.accountsSubscribed = 0;
  state.ledgerStreamSubscribed = false;
}

export function setXrplSubscribeSyncSnapshot(accountsSubscribed: number, ledgerStreamSubscribed: boolean): void {
  state.accountsSubscribed = accountsSubscribed;
  state.ledgerStreamSubscribed = ledgerStreamSubscribed;
}

export function recordXrplSubscribeLedgerClosed(ledgerIndex: number): void {
  state.lastLedgerIndex = ledgerIndex;
  state.ledgerClosedEvents += 1;
  const now = Date.now() / 1000;
  if (lastLedgerCloseWallSec > 0) {
    ledgerCloseIntervalSumSec += now - lastLedgerCloseWallSec;
    ledgerCloseIntervalSampleCount += 1;
  }
  lastLedgerCloseWallSec = now;
}

export function recordXrplSubscribeTransactionProcessed(): void {
  state.transactionStreamProcessed += 1;
}

export function recordXrplSubscribeTransactionThrottled(): void {
  state.transactionStreamThrottled += 1;
}

export function getXrplSubscribeHealthSnapshot(): Record<string, unknown> {
  const intervalAvgSec =
    ledgerCloseIntervalSampleCount > 0 ? ledgerCloseIntervalSumSec / ledgerCloseIntervalSampleCount : null;
  return {
    ...state,
    connectedGauge: state.connected ? 1 : 0,
    lastLedgerCloseUnixtime: lastLedgerCloseWallSec,
    ledgerCloseIntervalAvgSec: intervalAvgSec,
    ledgerCloseIntervalSampleCount,
  };
}
