// Pay links: a signed charter (and optionally a price) carried in the URL
// fragment, e.g. https://…/#c=<base64url JSON>&p=0.01. Browsers never send
// the fragment to the server, so whoever hosts the page does not learn the
// members' addresses. Everything here is pure so it can be unit-tested.

import { parseCharterFile, type SignedCharter } from "./charter.ts";
import { base64url, fromBase64url } from "./memo.ts";
import { formatZec, parseZec } from "./zatoshi.ts";

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });

/** Fragment (without "#") for a pay link. Price is optional and not signed: it only pre-fills the form. */
export function encodePayFragment(signed: SignedCharter, priceZat?: bigint): string {
  const body = base64url(enc.encode(JSON.stringify({ charter: signed.charter, signatures: signed.signatures })));
  return priceZat === undefined ? `c=${body}` : `c=${body}&p=${formatZec(priceZat)}`;
}

export interface PayFragment {
  signed: SignedCharter;
  priceZat?: bigint;
}

/** Reads "#c=…&p=…" (leading "#" optional). Returns null when there is no charter in the fragment. */
export function decodePayFragment(hash: string): PayFragment | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const c = params.get("c");
  if (!c) return null;
  let text: string;
  try {
    text = dec.decode(fromBase64url(c));
  } catch {
    throw new Error("the charter in this link is damaged (not valid base64url text) — ask the seller for the link again");
  }
  const signed = parseCharterFile(text);
  const p = params.get("p");
  return p ? { signed, priceZat: parseZec(p) } : { signed };
}

/** Full pay-page URL for a charter, given the page's base URL (no fragment). */
export function payLink(pageUrl: string, signed: SignedCharter, priceZat?: bigint): string {
  return `${pageUrl.replace(/#.*$/, "")}#${encodePayFragment(signed, priceZat)}`;
}

/**
 * Rough ZIP-317 fee for paying `outputs` recipients from one shielded pool:
 * 5,000 zat per logical action, at least 2, counting one extra output for change.
 * The wallet computes the exact fee (more inputs or mixed pools cost more) and shows it before sending.
 */
export function estimateFeeZat(outputs: number): bigint {
  return 5_000n * BigInt(Math.max(2, outputs + 1));
}

const ORDER_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Random order reference such as "ord-k7m2qx9p"; contains no personal data. */
export function newOrderId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return "ord-" + [...random(8)].map((b) => ORDER_ALPHABET[b % ORDER_ALPHABET.length]).join("");
}

/** Shortens an address for display: first 10 + last 6 characters. The full address is still in the request. */
export function shortAddress(addr: string): string {
  return addr.length <= 20 ? addr : `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}
