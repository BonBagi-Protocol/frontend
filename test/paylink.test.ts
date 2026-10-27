import { describe, expect, it } from "vitest";
import { newPrivateKey, publicKeyOf, signCharter, verifyCharter, type Charter, type SignedCharter } from "@bonbagi/core";
import { base64url, bonbagiMemo, encodeMemo, fromBase64url } from "@bonbagi/core";
import { decodePayFragment, encodePayFragment, estimateFeeZat, newOrderId, payLink, shortAddress } from "@bonbagi/core";
import { buildPaymentRequest } from "@bonbagi/core";
import { splitAmount } from "@bonbagi/core";
import { parseZec } from "@bonbagi/core";
import { parseUri } from "@bonbagi/core";

const fake = (hrp: string, seed: string, len: number) => hrp + "1" + (seed + "qpzry9x8gf2tvdw0s3jn54khce6mua7l".repeat(6)).slice(0, len);
const ADDRS = [fake("u", "aaa", 100), fake("u", "ccc", 100), fake("u", "ddd", 100)];

async function signedCharter(signers = 3): Promise<SignedCharter> {
  const keys = [newPrivateKey(), newPrivateKey(), newPrivateKey()];
  const pubs = await Promise.all(keys.map(publicKeyOf));
  const charter: Charter = {
    bonbagi: 1,
    network: "main",
    title: "Ngaji Zcash — kelas #1",
    minShareZat: "10000",
    members: [
      { label: "Dex", address: ADDRS[0]!, bps: 4000, pubkey: pubs[0]! },
      { label: "Hans", address: ADDRS[1]!, bps: 3000, pubkey: pubs[1]! },
      { label: "Dave", address: ADDRS[2]!, bps: 3000, pubkey: pubs[2]! },
    ],
  };
  return { charter, signatures: await Promise.all(keys.slice(0, signers).map((k) => signCharter(charter, k))) };
}

describe("pay link fragment", () => {
  it("round-trips a signed charter and an optional price", async () => {
    const signed = await signedCharter();
    const plain = decodePayFragment("#" + encodePayFragment(signed));
    expect(plain?.signed).toEqual(signed);
    expect(plain?.priceZat).toBeUndefined();
    const priced = decodePayFragment(encodePayFragment(signed, parseZec("0.0123")));
    expect(priced?.priceZat).toBe(1_230_000n);
    expect((await verifyCharter(priced!.signed)).unsigned).toEqual([]);
  });
  it("keeps the charter in the fragment only (never in path or query)", async () => {
    const link = payLink("https://bonbagi.example/?ref=x#old", await signedCharter(), parseZec("0.01"));
    const u = new URL(link);
    expect(u.search).toBe("?ref=x");
    expect(u.hash.startsWith("#c=")).toBe(true);
    expect(u.pathname + u.search).not.toContain(ADDRS[0]!.slice(2, 20));
    expect(link.match(/#/g)).toHaveLength(1);
  });
  it("returns null when there is no charter, and a clear error when it is damaged", () => {
    expect(decodePayFragment("")).toBeNull();
    expect(decodePayFragment("#p=1")).toBeNull();
    expect(() => decodePayFragment("#c=***")).toThrow(/damaged/);
    expect(() => decodePayFragment("#c=" + base64url(new Uint8Array([0xff, 0xfe])))).toThrow(/damaged/);
    expect(() => decodePayFragment("#c=" + base64url(new TextEncoder().encode('{"a":1}')))).toThrow(/expected/);
  });
  it("a link edited to swap an address no longer verifies, so no request is built", async () => {
    const signed = await signedCharter();
    const json = JSON.stringify(signed).replace(ADDRS[2]!, fake("u", "eee", 100));
    const tampered = decodePayFragment("#c=" + base64url(new TextEncoder().encode(json)))!;
    expect((await verifyCharter(tampered.signed)).unsigned).toEqual([0, 1, 2]);
    await expect(buildPaymentRequest(tampered.signed, parseZec("0.01"), "ord-1")).rejects.toThrow(/not signed by every member/);
  });
  it("a partly signed charter in a link is refused by name", async () => {
    const frag = decodePayFragment(encodePayFragment(await signedCharter(2)))!;
    await expect(buildPaymentRequest(frag.signed, parseZec("0.01"), "ord-1")).rejects.toThrow(/Dave/);
  });
});

describe("pay page end to end (link → request)", () => {
  it("summary lines and the URI come from the same data", async () => {
    const frag = decodePayFragment(encodePayFragment(await signedCharter(), parseZec("0.01")))!;
    const req = await buildPaymentRequest(frag.signed, frag.priceZat!, "ord-abc23456");
    const parsed = parseUri(req.uri);
    expect(parsed.map((p) => [p.address, p.amountZat])).toEqual(req.lines.map((l) => [l.address, l.amountZat]));
    expect(req.lines.map((l) => l.amountZat)).toEqual([400_000n, 300_000n, 300_000n]);
    expect(parsed.reduce((a, p) => a + p.amountZat!, 0n)).toBe(req.totalZat);
    expect(parsed[0]!.message).toBe("Ngaji Zcash — kelas #1");
  });
  it("memos carry only the order ID, charter fingerprint and position — no names or addresses", async () => {
    const signed = await signedCharter();
    const req = await buildPaymentRequest(signed, parseZec("0.01"), "ord-abc23456");
    for (const [i, p] of parseUri(req.uri).entries()) {
      const memo = new TextDecoder().decode(p.memo);
      expect(memo).toBe(`bonbagi:v1 o=ord-abc23456 c=${req.charterHash.slice(0, 16)} m=${i + 1}/3`);
      for (const m of signed.charter.members) {
        expect(memo).not.toContain(m.label);
        expect(memo).not.toContain(m.address.slice(0, 12));
      }
    }
  });
  it("rejects order IDs that could smuggle personal data or break the memo", async () => {
    const signed = await signedCharter();
    for (const bad of ["", "jane@mail.com", "a b", "x".repeat(33)]) {
      await expect(buildPaymentRequest(signed, parseZec("0.01"), bad)).rejects.toThrow(/order ID/);
    }
  });
  it("refuses a price too small for every member to get the minimum share", async () => {
    await expect(buildPaymentRequest(await signedCharter(), parseZec("0.0002"), "ord-1")).rejects.toThrow(/below the minimum/);
  });
});

describe("helpers", () => {
  it("fee estimate follows ZIP-317 (5,000 zat per action, change counted, min 2)", () => {
    expect(estimateFeeZat(1)).toBe(10_000n);
    expect(estimateFeeZat(3)).toBe(20_000n);
    expect(estimateFeeZat(10)).toBe(55_000n);
  });
  it("order IDs are random, short and memo-safe", () => {
    const id = newOrderId();
    expect(id).toMatch(/^ord-[a-z2-9]{8}$/);
    expect(() => bonbagiMemo(id, "0".repeat(64), 1, 2)).not.toThrow();
    expect(newOrderId(() => new Uint8Array(8))).toBe("ord-aaaaaaaa");
    expect(new Set(Array.from({ length: 50 }, () => newOrderId())).size).toBe(50);
  });
  it("shortAddress keeps both ends", () => {
    expect(shortAddress(ADDRS[0]!)).toBe(`${ADDRS[0]!.slice(0, 10)}…${ADDRS[0]!.slice(-6)}`);
    expect(shortAddress("u1short")).toBe("u1short");
  });
});

describe("split & memo review (#4, #5)", () => {
  it("33.33 / 33.33 / 33.34 of an awkward price sums exactly and is stable", () => {
    const a = splitAmount(1_000_003n, [3333, 3333, 3334]);
    expect(a.reduce((x, y) => x + y, 0n)).toBe(1_000_003n);
    expect(splitAmount(1_000_003n, [3333, 3333, 3334])).toEqual(a);
  });
  it("leftover zatoshi never exceed members − 1 and every share stays within 1 zat of exact", () => {
    for (const total of [10_007n, 99_999n, 123_456_789n]) {
      const bps = [1, 2499, 2500, 5000];
      const out = splitAmount(total, bps, 1n);
      out.forEach((z, i) => {
        const exact = (total * BigInt(bps[i]!) * 1000n) / 10_000n;
        expect(z * 1000n - exact).toBeGreaterThan(-1000n);
        expect(z * 1000n - exact).toBeLessThan(1000n);
      });
    }
  });
  it("50 members (the charter maximum) with uneven shares sum exactly and are stable", () => {
    const bps = Array.from({ length: 50 }, (_, i) => (i < 49 ? 7 + (i % 5) * 40 : 0));
    bps[49] = 10_000 - bps.reduce((a, b) => a + b, 0);
    const total = 987_654_321n;
    const out = splitAmount(total, bps, 1n);
    expect(out).toHaveLength(50);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(total);
    expect(splitAmount(total, bps, 1n)).toEqual(out);
  });
  it("leftover zatoshi go to the earliest members when three or more remainders tie", () => {
    // 4 × 2500 bp of 10_003 zat: each exact share is 2500.75, so three leftovers go to members 1–3.
    expect(splitAmount(10_003n, [2500, 2500, 2500, 2500], 1n)).toEqual([2501n, 2501n, 2501n, 2500n]);
  });
  it("a price near the 21M ZEC supply cap splits without loss", () => {
    const total = 21_000_000n * 100_000_000n - 1n;
    const out = splitAmount(total, [3333, 3333, 3334]);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(total);
  });
  it("the charter's own minShareZat overrides the default minimum", async () => {
    const signed = await signedCharter();
    // 0.0002 ZEC → 8,000 / 6,000 / 6,000 zat: below the default 10,000, fine with a 5,000 floor.
    await expect(buildPaymentRequest(signed, parseZec("0.0002"), "ord-1")).rejects.toThrow(/below the minimum of 10000/);
    const keys = [newPrivateKey(), newPrivateKey(), newPrivateKey()];
    const pubs = await Promise.all(keys.map(publicKeyOf));
    const charter: Charter = { ...signed.charter, minShareZat: "5000", members: signed.charter.members.map((m, i) => ({ ...m, pubkey: pubs[i]! })) };
    const low = { charter, signatures: await Promise.all(keys.map((k) => signCharter(charter, k))) };
    const req = await buildPaymentRequest(low, parseZec("0.0002"), "ord-1");
    expect(req.lines.map((l) => l.amountZat)).toEqual([8_000n, 6_000n, 6_000n]);
  });
  it("the longest possible BonBagi memo fits easily in 512 bytes", () => {
    const memo = bonbagiMemo("x".repeat(32), "f".repeat(64), 50, 50);
    expect(fromBase64url(encodeMemo(memo)).length).toBeLessThan(100);
  });
});
