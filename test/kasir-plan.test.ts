import { describe, expect, it } from "vitest";
import { coinCounts, compartments, drawerWidths, initialOf } from "../src/kasir/plan.ts";

describe("register plan", () => {
  it("gives the 40/30/30 sample 4/3/3 coins", () => {
    expect(coinCounts([4000, 3000, 3000])).toEqual([4, 3, 3]);
  });

  it("always adds up to the coins in the drawer and keeps one coin per share", () => {
    for (const bps of [[5000, 5000], [9800, 100, 100], [3334, 3333, 3333], [2500, 2500, 2500, 2500], [100, 100, 100, 100, 100, 9500]]) {
      const c = coinCounts(bps);
      expect(c.reduce((a, b) => a + b, 0)).toBe(10);
      expect(c.every((n) => n >= 1)).toBe(true);
    }
  });

  it("keeps up to five members as their own compartments", () => {
    const m = [40, 30, 30].map((p, i) => ({ label: `Mentor ${"ABC"[i]}`, bps: p * 100 }));
    const c = compartments(m);
    expect(c.map((x) => x.label)).toEqual(["Mentor A", "Mentor B", "Mentor C"]);
    expect(c.map((x) => x.initial)).toEqual(["A", "B", "C"]);
  });

  it("never draws more than five compartments, largest shares first, the rest as one", () => {
    const m = Array.from({ length: 50 }, (_, i) => ({ label: `Member ${i + 1}`, bps: i === 7 ? 1200 : i === 3 ? 900 : i < 2 ? 300 : 0 }));
    const fill = 10000 - m.reduce((a, x) => a + x.bps, 0);
    const small = m.filter((x) => x.bps === 0);
    small.forEach((x, k) => (x.bps = Math.floor(fill / small.length) + (k < fill % small.length ? 1 : 0)));
    const c = compartments(m);
    expect(c).toHaveLength(5);
    expect(c.slice(0, 2).map((x) => x.label)).toEqual(["Member 8", "Member 4"]);
    expect(c.at(-1)!.label).toBe("+46 more");
    expect(c.reduce((a, x) => a + x.bps, 0)).toBe(10000);
    expect(c.flatMap((x) => x.members).sort((a, b) => a - b)).toEqual(m.map((_, i) => i));
    expect(coinCounts(c.map((x) => x.bps)).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("keeps charter order for small collectives", () => {
    expect(compartments([{ label: "Hans", bps: 2000 }, { label: "Dex", bps: 8000 }]).map((x) => x.label)).toEqual(["Hans", "Dex"]);
  });

  it("sizes compartments by share but keeps small ones visible", () => {
    expect(drawerWidths([4000, 3000, 3000], 388, 58).map((w) => Math.round(w))).toEqual([155, 116, 116]);
    const w = drawerWidths([870, 547, 547, 547, 7489], 388, 58);
    expect(w.slice(0, 4).every((x) => x >= 58)).toBe(true);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(388, 6);
  });

  it("reads initials like the pay page", () => {
    expect(initialOf("Mentor A (host)")).toBe("A");
    expect(initialOf("hans")).toBe("H");
  });
});
