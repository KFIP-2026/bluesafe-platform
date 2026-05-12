import { createHash, randomBytes } from 'crypto';
import { bytesToHex } from './hex';

/**
 * PREIMAGE-SHA-256 crypto-conditions — the only condition type
 * EscrowFinish supports. We hand-roll the DER encoding to avoid pulling
 * the sprawling `five-bells-condition` runtime; the format is fixed
 * and the math is short.
 *
 * Layout reference (interledger crypto-conditions draft):
 *   condition  : A0 25 80 20 <SHA256 hash:32> 81 01 <preimage_len:1>
 *   fulfillment: A0 22 80 20 <preimage:32>                          (for 32B preimage)
 *
 * Restriction: preimage length must be in [1, 127] bytes so the DER
 * length and INTEGER cost both fit in one byte.
 */

export interface PreimageCondition {
  preimage: Buffer;       // keep secret until EscrowFinish
  condition: string;      // hex, embedded in EscrowCreate.Condition
  fulfillment: string;    // hex, revealed in EscrowFinish.Fulfillment
}

export function buildPreimageCondition(preimage: Buffer): PreimageCondition {
  if (preimage.length === 0 || preimage.length > 127) {
    throw new RangeError('preimage must be 1..127 bytes');
  }

  const hash = createHash('sha256').update(preimage).digest();

  // condition: SEQUENCE { fingerprint OCTET_STRING(32), cost INTEGER }
  const condition = Buffer.concat([
    Buffer.from([0xa0, 0x25, 0x80, 0x20]),
    hash,
    Buffer.from([0x81, 0x01, preimage.length]),
  ]);

  // fulfillment: SEQUENCE { preimage OCTET_STRING }
  const inner = Buffer.concat([Buffer.from([0x80, preimage.length]), preimage]);
  const fulfillment = Buffer.concat([Buffer.from([0xa0, inner.length]), inner]);

  return {
    preimage,
    condition: bytesToHex(condition),
    fulfillment: bytesToHex(fulfillment),
  };
}

/** Generate a fresh 32-byte random preimage. */
export function newRandomPreimage(): PreimageCondition {
  return buildPreimageCondition(randomBytes(32));
}

/**
 * Build a deterministic preimage from a checklist payload (e.g. JSON of
 * the move-out checklist signed by both parties off-chain). Same input
 * yields the same condition, so the parties can reproduce the
 * fulfillment without coordinating storage.
 */
export function checklistPreimage(canonicalJson: string): PreimageCondition {
  const buf = createHash('sha256').update(canonicalJson, 'utf8').digest();
  return buildPreimageCondition(buf);
}
