// Deterministic split of a price into member shares.
//
// Shares are given in basis points (1 bp = 0.01%) and must sum to 10_000.
// Each member first gets floor(total * bp / 10_000). The leftover zatoshi
// (at most members - 1) go one each to the members with the largest
// remainders; ties go to the member listed first in the charter. Every
// client therefore computes exactly the same outputs for the same charter.

export const TOTAL_BPS = 10_000;

/** Default floor per output: 0.0001 ZEC. Smaller shares are mostly eaten by fees and bloat the recipient's wallet with tiny notes. */
export const DEFAULT_MIN_SHARE_ZAT = 10_000n;

export class SplitError extends Error {}

export function splitAmount(totalZat: bigint, bps: readonly number[], minShareZat = DEFAULT_MIN_SHARE_ZAT): bigint[] {
  if (bps.length === 0) throw new SplitError("no members");
  for (const b of bps) {
    if (!Number.isInteger(b) || b <= 0) throw new SplitError(`share must be a positive whole number of basis points, got ${b}`);
  }
  const sum = bps.reduce((a, b) => a + b, 0);
  if (sum !== TOTAL_BPS) throw new SplitError(`shares must add up to 100% (10000 bp), got ${sum}`);
  if (totalZat <= 0n) throw new SplitError("price must be positive");

  const T = BigInt(TOTAL_BPS);
  const parts = bps.map((b, i) => {
    const num = totalZat * BigInt(b);
    return { i, zat: num / T, rem: num % T };
  });
  let left = totalZat - parts.reduce((a, p) => a + p.zat, 0n);
  const order = [...parts].sort((a, b) => (b.rem === a.rem ? a.i - b.i : b.rem > a.rem ? 1 : -1));
  for (const p of order) {
    if (left === 0n) break;
    p.zat += 1n;
    left -= 1n;
  }
  const out = parts.map((p) => p.zat);
  const tooSmall = out.findIndex((z) => z < minShareZat);
  if (tooSmall !== -1) {
    throw new SplitError(`member ${tooSmall + 1} would receive ${out[tooSmall]} zat, below the minimum of ${minShareZat} zat — raise the price or merge small shares`);
  }
  return out;
}

/** "33.33" → 3333 bp. At most two decimals, 0 < p ≤ 100. */
export function percentToBps(text: string): number {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) throw new SplitError(`invalid percentage "${text}" (use e.g. 50 or 33.33)`);
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (bps <= 0 || bps > TOTAL_BPS) throw new SplitError(`percentage must be between 0 and 100, got ${text}`);
  return bps;
}
