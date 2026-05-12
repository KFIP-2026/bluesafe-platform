/** Convert a UTF-8 string into uppercase hex (XRPL Memo / URI fields use hex). */
export function utf8ToHex(s: string): string {
  return Buffer.from(s, 'utf8').toString('hex').toUpperCase();
}

export function hexToUtf8(h: string): string {
  return Buffer.from(h, 'hex').toString('utf8');
}

export function bytesToHex(b: Buffer | Uint8Array): string {
  return Buffer.from(b).toString('hex').toUpperCase();
}
