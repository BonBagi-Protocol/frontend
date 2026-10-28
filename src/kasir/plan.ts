// Pure layout helpers for the register (no DOM): how many drawer compartments to draw,
// and how many coins each one gets, so the picture follows the real shares.

export interface PlanMember {
  label: string;
  bps: number;
}

export interface Compartment {
  /** Text on the compartment tag, e.g. "Mentor A (host)" or "+3 others". */
  label: string;
  /** One letter for small places (LEDs), like the pay page's member chips. */
  initial: string;
  bps: number;
  /** Indexes of the charter members inside this compartment. */
  members: number[];
}

/** One letter per member: "Mentor A (host)" -> "A", "Hans" -> "H" (same rule as the pay page's chips). */
export function initialOf(label: string): string {
  return label.match(/\b([A-Z0-9])\b/)?.[1] ?? (label.trim().charAt(0).toUpperCase() || "?");
}

/**
 * Members as drawer compartments. A drawer has room for `max` compartments: up to `max` members keep
 * charter order; with more, the largest shares come first and everyone else shares the last
 * compartment ("+k more"), so the drawer never grows with the size of the collective.
 */
export function compartments(members: readonly PlanMember[], max = 5): Compartment[] {
  const one = (m: PlanMember, i: number): Compartment => ({ label: m.label, initial: initialOf(m.label), bps: m.bps, members: [i] });
  if (members.length <= max) return members.map(one);
  const ranked = members.map((m, i) => ({ m, i })).sort((a, b) => b.m.bps - a.m.bps || a.i - b.i);
  const out = ranked.slice(0, max - 1).map(({ m, i }) => one(m, i));
  const rest = ranked.slice(max - 1);
  out.push({
    label: `+${rest.length} more`,
    initial: "+",
    bps: rest.reduce((a, x) => a + x.m.bps, 0),
    members: rest.map((x) => x.i).sort((a, b) => a - b),
  });
  return out;
}

/**
 * Coins per compartment for a drawer that holds `total` coins, by largest remainder,
 * with at least one coin for every share when there are enough coins.
 */
export function coinCounts(bps: readonly number[], total = 10): number[] {
  const sum = bps.reduce((a, b) => a + b, 0);
  if (sum <= 0 || bps.length === 0) return bps.map(() => 0);
  const raw = bps.map((b) => (b / sum) * total);
  const out = raw.map((r) => Math.floor(r));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    left--;
  }
  if (bps.length <= total) {
    // every share shows at least one coin: take it from the largest pile
    for (let i = 0; i < out.length; i++) {
      if ((out[i] ?? 0) > 0) continue;
      let big = 0;
      out.forEach((c, j) => { if (c > (out[big] ?? 0)) big = j; });
      if ((out[big] ?? 0) <= 1) break;
      out[big] = (out[big] ?? 0) - 1;
      out[i] = 1;
    }
  }
  return out;
}

/**
 * Compartment widths across a drawer of `total` units: proportional to the shares, but never
 * narrower than `min`, so a 2% member still gets a compartment you can see a coin and a tag in.
 */
export function drawerWidths(bps: readonly number[], total: number, min: number): number[] {
  const n = bps.length;
  if (n === 0) return [];
  if (min * n >= total) return bps.map(() => total / n);
  const fixed = new Set<number>();
  let out = bps.map(() => 0);
  for (;;) {
    const freeBps = bps.reduce((a, b, i) => a + (fixed.has(i) ? 0 : b), 0);
    const freeW = total - fixed.size * min;
    out = bps.map((b, i) => (fixed.has(i) ? min : freeBps > 0 ? (b / freeBps) * freeW : freeW / (n - fixed.size)));
    const low = out.findIndex((w, i) => !fixed.has(i) && w < min);
    if (low < 0) return out;
    fixed.add(low);
  }
}
