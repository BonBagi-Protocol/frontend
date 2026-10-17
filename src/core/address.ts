// Light address classification by human-readable prefix. This is a guard
// against obvious mistakes (pasting a transparent address, mixing networks),
// not full validation: Unified Address checksums (Bech32m + F4Jumble) are
// verified by the paying wallet.

export type Network = "main" | "test";
export type AddressKind = "unified" | "sapling" | "transparent";

export interface AddressInfo {
  kind: AddressKind;
  network: Network;
}

const BECH32_CHARS = /^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/;

export function classifyAddress(addr: string): AddressInfo {
  const a = addr.trim();
  if (a !== addr || a.length === 0) throw new Error("address has surrounding whitespace or is empty");
  const lower = a.toLowerCase();
  const bech = (hrp: string, kind: AddressKind, network: Network): AddressInfo | null => {
    if (!lower.startsWith(hrp + "1")) return null;
    if (a !== lower && a !== a.toUpperCase()) throw new Error("mixed-case Bech32 address");
    if (!BECH32_CHARS.test(lower.slice(hrp.length + 1))) throw new Error("address contains characters outside the Bech32 alphabet");
    return { kind, network };
  };
  const hit =
    bech("utest", "unified", "test") ??
    bech("u", "unified", "main") ??
    bech("ztestsapling", "sapling", "test") ??
    bech("zs", "sapling", "main");
  if (hit) return hit;
  if (/^t[13][1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return { kind: "transparent", network: "main" };
  if (/^t[m2][1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return { kind: "transparent", network: "test" };
  throw new Error("not a recognised Zcash address");
}

/** Members must be paid to shielded addresses only — a transparent output would publish who got how much. */
export function assertShielded(addr: string): AddressInfo {
  const info = classifyAddress(addr);
  if (info.kind === "transparent") throw new Error("transparent addresses are not allowed: every share must be shielded");
  return info;
}
