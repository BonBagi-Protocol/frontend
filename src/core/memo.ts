// Memos travel encrypted inside each shielded output; only that output's
// recipient can read them. BonBagi puts no personal data in them — just an
// order reference and a short charter fingerprint so members can reconcile.

export const MAX_MEMO_BYTES = 512;

const enc = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("memo is not unpadded base64url");
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** ZIP-321 memo parameter value for a UTF-8 text memo. */
export function encodeMemo(text: string): string {
  const bytes = enc.encode(text);
  if (bytes.length > MAX_MEMO_BYTES) throw new Error(`memo is ${bytes.length} bytes, maximum is ${MAX_MEMO_BYTES}`);
  return base64url(bytes);
}

const ORDER_RE = /^[A-Za-z0-9-]{1,32}$/;

/** "bonbagi:v1 o=<orderId> c=<charter fingerprint> m=<member n>/<of>" */
export function bonbagiMemo(orderId: string, charterHashHex: string, member: number, of: number): string {
  if (!ORDER_RE.test(orderId)) throw new Error("order ID must be 1–32 letters, digits or dashes");
  if (!/^[0-9a-f]{64}$/.test(charterHashHex)) throw new Error("charter hash must be 64 lowercase hex characters");
  return `bonbagi:v1 o=${orderId} c=${charterHashHex.slice(0, 16)} m=${member}/${of}`;
}
