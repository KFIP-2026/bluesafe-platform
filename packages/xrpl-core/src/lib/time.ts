/**
 * Ripple Epoch helpers.
 *
 * XRPL stores time as seconds since 2000-01-01 UTC, not the UNIX epoch.
 * The offset is 946,684,800 seconds. Forgetting to subtract it locks an
 * Escrow ~30 years into the future — one of the spec's "주요 함정".
 */

export const RIPPLE_EPOCH_OFFSET = 946_684_800;

export function unixToRippleEpoch(unixSeconds: number): number {
  if (!Number.isFinite(unixSeconds) || unixSeconds < RIPPLE_EPOCH_OFFSET) {
    throw new RangeError(`unix seconds out of range for Ripple Epoch: ${unixSeconds}`);
  }
  return Math.floor(unixSeconds) - RIPPLE_EPOCH_OFFSET;
}

export function rippleEpochToUnix(rippleSeconds: number): number {
  return rippleSeconds + RIPPLE_EPOCH_OFFSET;
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function addDaysUnix(unixSeconds: number, days: number): number {
  return unixSeconds + days * 86_400;
}
