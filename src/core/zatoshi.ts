// Amounts are handled as integer zatoshi (1 ZEC = 100_000_000 zat) to avoid
// floating-point rounding. Only the ZIP-321 text form uses decimal ZEC.

export const ZAT_PER_ZEC = 100_000_000n;
export const MAX_ZAT = 21_000_000n * ZAT_PER_ZEC;

const ZEC_RE = /^(\d+)(?:\.(\d{1,8}))?$/;

/** Parse a decimal ZEC string ("1.5", "0.00010000") into zatoshi. */
export function parseZec(text: string): bigint {
  const m = ZEC_RE.exec(text.trim());
  if (!m) throw new Error(`invalid ZEC amount: "${text}"`);
  const whole = BigInt(m[1]!);
  const frac = BigInt((m[2] ?? "").padEnd(8, "0"));
  const zat = whole * ZAT_PER_ZEC + frac;
  if (zat > MAX_ZAT) throw new Error("amount exceeds 21,000,000 ZEC");
  return zat;
}

/** Format zatoshi as the shortest decimal ZEC string ZIP-321 accepts. */
export function formatZec(zat: bigint): string {
  if (zat < 0n || zat > MAX_ZAT) throw new Error("amount out of range");
  const whole = zat / ZAT_PER_ZEC;
  const frac = (zat % ZAT_PER_ZEC).toString().padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
