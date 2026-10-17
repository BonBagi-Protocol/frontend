// Build and parse ZIP-321 payment request URIs (https://zips.z.cash/zip-0321).
// BonBagi emits one URI carrying every member's share, so the buyer's wallet
// creates one transaction with one shielded output per member.

import { assertShielded, type Network } from "./address.ts";
import { encodeMemo, fromBase64url, MAX_MEMO_BYTES } from "./memo.ts";
import { formatZec, parseZec } from "./zatoshi.ts";

export interface Payment {
  address: string;
  amountZat: bigint;
  /** Plain-text memo; encoded to base64url in the URI. */
  memo?: string;
  label?: string;
}

const MAX_INDEX = 9999;

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Payments are written as index 0 (unindexed), .1, .2, … in charter order.
 * All recipients must be shielded and on the same network.
 */
export function buildUri(payments: readonly Payment[], message?: string): string {
  if (payments.length === 0) throw new Error("no payments");
  if (payments.length > MAX_INDEX + 1) throw new Error("too many payments");
  let network: Network | undefined;
  const seen = new Set<string>();
  const params: string[] = [];
  payments.forEach((p, i) => {
    const info = assertShielded(p.address);
    if (network && info.network !== network) throw new Error("recipients are on different networks");
    network = info.network;
    if (seen.has(p.address)) throw new Error("the same address appears twice; each member needs a distinct address");
    seen.add(p.address);
    if (p.amountZat <= 0n) throw new Error("each amount must be positive");
    const sfx = i === 0 ? "" : `.${i}`;
    params.push(`address${sfx}=${p.address}`, `amount${sfx}=${formatZec(p.amountZat)}`);
    if (p.memo !== undefined) params.push(`memo${sfx}=${encodeMemo(p.memo)}`);
    if (p.label !== undefined) params.push(`label${sfx}=${pct(p.label)}`);
  });
  if (message !== undefined) params.push(`message=${pct(message)}`);
  return `zcash:?${params.join("&")}`;
}

export interface ParsedPayment {
  address: string;
  amountZat?: bigint;
  memo?: Uint8Array;
  label?: string;
  message?: string;
}

const PARAM_RE = /^([A-Za-z0-9-]+)(?:\.([1-9][0-9]{0,3}))?$/;
const KNOWN = new Set(["address", "amount", "memo", "label", "message"]);

/** Strict parser, used to check our own output and to read pasted requests. */
export function parseUri(uri: string): ParsedPayment[] {
  if (!uri.startsWith("zcash:")) throw new Error("not a zcash: URI");
  let rest = uri.slice("zcash:".length);
  if (rest.startsWith("//")) throw new Error("authority component not allowed");
  const q = rest.indexOf("?");
  const pathAddr = q === -1 ? rest : rest.slice(0, q);
  const query = q === -1 ? "" : rest.slice(q + 1);
  const byIndex = new Map<number, Record<string, string>>();
  const put = (idx: number, name: string, value: string) => {
    const rec = byIndex.get(idx) ?? {};
    if (name in rec) throw new Error(`duplicate parameter ${name}${idx ? "." + idx : ""}`);
    rec[name] = value;
    byIndex.set(idx, rec);
  };
  if (pathAddr) put(0, "address", pathAddr);
  if (query) {
    for (const part of query.split("&")) {
      const eq = part.indexOf("=");
      if (eq <= 0) throw new Error(`malformed parameter "${part}"`);
      const m = PARAM_RE.exec(part.slice(0, eq));
      if (!m) throw new Error(`malformed parameter name "${part.slice(0, eq)}"`);
      const name = m[1]!;
      if (name.startsWith("req-")) throw new Error(`unsupported required parameter ${name}`);
      if (!KNOWN.has(name)) continue;
      put(m[2] ? Number(m[2]) : 0, name, part.slice(eq + 1));
    }
  }
  const out: ParsedPayment[] = [];
  for (const [idx, rec] of [...byIndex.entries()].sort((a, b) => a[0] - b[0])) {
    if (!rec.address) throw new Error(`payment ${idx} has parameters but no address`);
    const p: ParsedPayment = { address: rec.address };
    if (rec.amount !== undefined) p.amountZat = parseZec(rec.amount);
    if (rec.memo !== undefined) {
      const bytes = fromBase64url(rec.memo);
      if (bytes.length > MAX_MEMO_BYTES) throw new Error("memo longer than 512 bytes");
      p.memo = bytes;
    }
    if (rec.label !== undefined) p.label = decodeURIComponent(rec.label);
    if (rec.message !== undefined) p.message = decodeURIComponent(rec.message);
    out.push(p);
  }
  return out;
}
