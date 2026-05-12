import type { Memo } from 'xrpl';
import { utf8ToHex } from './hex';

/**
 * Memo encoding for the Payment + Memo flow (§2.2 utility bill, §4
 * dispute evidence pointers, etc.). XRPL stores Memo fields as hex.
 */

export interface MemoInput {
  type?: string;            // e.g. "UTILITY_BILL"
  data?: string | Buffer;   // raw payload — hashes/JSON
  format?: string;          // e.g. "application/json", "text/sha256-hex"
}

export function encodeMemo({ type, data, format }: MemoInput): Memo {
  const memo: Memo['Memo'] = {};
  if (type)   memo.MemoType   = utf8ToHex(type);
  if (format) memo.MemoFormat = utf8ToHex(format);
  if (data !== undefined) {
    memo.MemoData = typeof data === 'string'
      ? utf8ToHex(data)
      : Buffer.from(data).toString('hex').toUpperCase();
  }
  return { Memo: memo };
}

export function encodeMemos(inputs: MemoInput[]): Memo[] {
  return inputs.map(encodeMemo);
}

/** Build a Memo carrying SHA-256 hashes for monthly utility settlement. */
export function utilityBillMemo(args: {
  yearMonth: string;          // "YYYY-MM"
  kepcoUsageHashHex: string;  // SHA-256 of kWh reading payload
  billHashHex: string;        // SHA-256 of landlord's invoice
}): Memo {
  const payload = JSON.stringify({
    ym:    args.yearMonth,
    kepco: args.kepcoUsageHashHex.toLowerCase(),
    bill:  args.billHashHex.toLowerCase(),
  });
  return encodeMemo({
    type:   'UTILITY_BILL',
    format: 'application/json',
    data:   payload,
  });
}
