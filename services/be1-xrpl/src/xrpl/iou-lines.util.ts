import type { Client } from 'xrpl';
import type { IssuedCurrencyAmount } from 'xrpl';

/** XRPL issued currency: 3-letter ISO-style code or 40-char uppercase hex. */
export function normalizeIouCurrencyCode(raw: string): string {
  const c = raw.trim().toUpperCase();
  if (/^[A-Z0-9]{3}$/.test(c)) return c;
  if (/^[0-9A-F]{40}$/.test(c)) return c;
  throw new Error(`Invalid IOU currency code (use 3-letter code or 40-char hex): ${raw}`);
}

export function buildIouAmount(
  issuer: string,
  currency: string,
  value: string,
): IssuedCurrencyAmount {
  return {
    issuer: issuer.trim(),
    currency: normalizeIouCurrencyCode(currency),
    value: value.trim(),
  };
}

export async function findTrustLine(
  client: Client,
  account: string,
  issuer: string,
  currency: string,
): Promise<{ limit: string; balance: string; currency: string } | null> {
  const want = normalizeIouCurrencyCode(currency);
  const res = await client.request({
    command: 'account_lines',
    account,
    peer: issuer,
    ledger_index: 'validated',
  });
  const lines = res.result.lines ?? [];
  for (const line of lines) {
    const lineCur = (line.currency ?? '').toUpperCase();
    if (lineCur === want) {
      return {
        limit: line.limit ?? '0',
        balance: line.balance ?? '0',
        currency: line.currency ?? '',
      };
    }
  }
  return null;
}

/** Sum two positive IOU decimal strings (MVP; typical RLUSD-scale amounts). */
export function sumIouValueStrings(a: string, b: string): string {
  const x = parseFloat(a) + parseFloat(b);
  if (!Number.isFinite(x) || x < 0) {
    throw new Error('Invalid IOU amount sum');
  }
  return x.toFixed(15).replace(/\.?0+$/, '') || '0';
}

export function iouValueGte(limit: string, need: string): boolean {
  return parseFloat(limit) >= parseFloat(need);
}
