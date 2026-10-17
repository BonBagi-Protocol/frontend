import { describe, expect, it } from "vitest";
import { classifyAddress } from "../src/core/address.ts";
import { newPrivateKey, publicKeyOf, signCharter, verifyCharter, type Charter, type SignedCharter } from "../src/core/charter.ts";
import { encodeMemo, fromBase64url } from "../src/core/memo.ts";
import { buildPaymentRequest } from "../src/core/request.ts";
import { splitAmount, SplitError } from "../src/core/split.ts";
import { formatZec, parseZec } from "../src/core/zatoshi.ts";
import { buildUri, parseUri } from "../src/core/zip321.ts";

// Syntactically plausible fake addresses (not real wallets).
const fake = (hrp: string, seed: string, len: number) => hrp + "1" + (seed + "qpzry9x8gf2tvdw0s3jn54khce6mua7l".repeat(6)).slice(0, len);
const U1 = fake("u", "aaa", 100);
const U2 = fake("u", "ccc", 100);
const U3 = fake("u", "ddd", 100);
const ZS = fake("zs", "eee", 75);
const UT = fake("utest", "fff", 100);

describe("zatoshi", () => {
  it("round-trips decimal ZEC", () => {
    expect(parseZec("1.5")).toBe(150_000_000n);
    expect(parseZec("0.00000001")).toBe(1n);
    expect(formatZec(150_000_000n)).toBe("1.5");
    expect(formatZec(100_000_000n)).toBe("1");
    expect(formatZec(1n)).toBe("0.00000001");
  });
  it("rejects malformed amounts", () => {
    for (const bad of ["1.", ".5", "1,5", "1.123456789", "-1", "1e3", "21000000.00000001"]) expect(() => parseZec(bad)).toThrow();
  });
});

describe("split", () => {
  it("is exact and deterministic for uneven shares", () => {
    const out = splitAmount(100_000_000n, [3334, 3333, 3333]);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(100_000_000n);
    expect(out).toEqual([33_340_000n, 33_330_000n, 33_330_000n]);
  });
  it("gives leftover zatoshi to the largest remainders, ties to the first member", () => {
    const out = splitAmount(1_000_001n, [5000, 5000], 1n);
    expect(out).toEqual([500_001n, 500_000n]);
    expect(splitAmount(1_000_002n, [3333, 3333, 3334], 1n).reduce((a, b) => a + b, 0n)).toBe(1_000_002n);
  });
  it("enforces 100% and the minimum share", () => {
    expect(() => splitAmount(1_000_000n, [5000, 4000])).toThrow(SplitError);
    expect(() => splitAmount(15_000n, [5000, 5000])).toThrow(/below the minimum/);
  });
});

describe("address", () => {
  it("classifies by prefix", () => {
    expect(classifyAddress(U1)).toEqual({ kind: "unified", network: "main" });
    expect(classifyAddress(UT)).toEqual({ kind: "unified", network: "test" });
    expect(classifyAddress(ZS)).toEqual({ kind: "sapling", network: "main" });
    expect(classifyAddress("t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs").kind).toBe("transparent");
    expect(() => classifyAddress("u1Bad!")).toThrow();
  });
});

describe("zip321", () => {
  it("builds a 3-recipient URI that parses back exactly", () => {
    const uri = buildUri([
      { address: U1, amountZat: 50_000n, memo: "hello" },
      { address: U2, amountZat: 30_000n },
      { address: ZS, amountZat: 20_000n, label: "Mentor C & co" },
    ], "Class #1");
    expect(uri.startsWith(`zcash:?address=${U1}&amount=0.0005&memo=`)).toBe(true);
    expect(uri).toContain(`&address.1=${U2}&amount.1=0.0003`);
    expect(uri).toContain("label.2=Mentor%20C%20%26%20co");
    const back = parseUri(uri);
    expect(back.map((p) => [p.address, p.amountZat])).toEqual([[U1, 50_000n], [U2, 30_000n], [ZS, 20_000n]]);
    expect(new TextDecoder().decode(back[0]!.memo)).toBe("hello");
    expect(back[2]!.label).toBe("Mentor C & co");
  });
  it("refuses transparent, duplicate and mixed-network recipients", () => {
    expect(() => buildUri([{ address: "t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs", amountZat: 1n }])).toThrow(/transparent/);
    expect(() => buildUri([{ address: U1, amountZat: 1n }, { address: U1, amountZat: 1n }])).toThrow(/twice/);
    expect(() => buildUri([{ address: U1, amountZat: 1n }, { address: UT, amountZat: 1n }])).toThrow(/networks/);
  });
  it("memo is unpadded base64url within 512 bytes", () => {
    const m = encodeMemo("ab?>");
    expect(m).not.toMatch(/[+/=]/);
    expect(new TextDecoder().decode(fromBase64url(m))).toBe("ab?>");
    expect(() => encodeMemo("x".repeat(513))).toThrow();
  });
  it("parser rejects malformed requests", () => {
    expect(() => parseUri(`zcash:?address=${U1}&address=${U2}`)).toThrow(/duplicate/);
    expect(() => parseUri(`zcash:?address=${U1}&amount.01=1`)).toThrow();
    expect(() => parseUri(`zcash:?amount.1=1`)).toThrow(/no address/);
    expect(() => parseUri(`zcash:?address=${U1}&req-foo=1`)).toThrow(/required/);
  });
});

async function makeCharter(): Promise<{ charter: Charter; keys: string[] }> {
  const keys = [newPrivateKey(), newPrivateKey(), newPrivateKey()];
  const pubs = await Promise.all(keys.map(publicKeyOf));
  const charter: Charter = {
    bonbagi: 1,
    network: "main",
    title: "Intro to Zcash — 3 mentors",
    minShareZat: "10000",
    members: [
      { label: "Mentor A", address: U1, bps: 5000, pubkey: pubs[0]! },
      { label: "Mentor B", address: U2, bps: 3000, pubkey: pubs[1]! },
      { label: "Mentor C", address: U3, bps: 2000, pubkey: pubs[2]! },
    ],
  };
  return { charter, keys };
}

describe("charter", () => {
  it("verifies when every member signed", async () => {
    const { charter, keys } = await makeCharter();
    const signed: SignedCharter = { charter, signatures: await Promise.all(keys.map((k) => signCharter(charter, k))) };
    const r = await verifyCharter(signed);
    expect(r.unsigned).toEqual([]);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("reports missing signatures", async () => {
    const { charter, keys } = await makeCharter();
    const signed = { charter, signatures: [await signCharter(charter, keys[0]!)] };
    expect((await verifyCharter(signed)).unsigned).toEqual([1, 2]);
  });
  it("any edit after signing breaks the signatures (swapped address, changed share)", async () => {
    const { charter, keys } = await makeCharter();
    const sigs = await Promise.all(keys.map((k) => signCharter(charter, k)));
    const swapped = structuredClone(charter);
    swapped.members[2]!.address = ZS;
    expect((await verifyCharter({ charter: swapped, signatures: sigs })).unsigned).toEqual([0, 1, 2]);
    const reshared = structuredClone(charter);
    reshared.members[0]!.bps = 6000;
    reshared.members[2]!.bps = 1000;
    expect((await verifyCharter({ charter: reshared, signatures: sigs })).unsigned).toEqual([0, 1, 2]);
  });
  it("key order in the JSON does not matter (canonical form)", async () => {
    const { charter, keys } = await makeCharter();
    const sigs = await Promise.all(keys.map((k) => signCharter(charter, k)));
    const reordered = JSON.parse(JSON.stringify({ members: charter.members, title: charter.title, network: charter.network, minShareZat: charter.minShareZat, bonbagi: 1 }));
    expect((await verifyCharter({ charter: reordered, signatures: sigs })).unsigned).toEqual([]);
  });
  it("rejects a signature from an outsider", async () => {
    const { charter } = await makeCharter();
    await expect(signCharter(charter, newPrivateKey())).rejects.toThrow(/does not belong/);
  });
});

describe("payment request", () => {
  it("builds one URI with every share and a memo per output", async () => {
    const { charter, keys } = await makeCharter();
    const signed = { charter, signatures: await Promise.all(keys.map((k) => signCharter(charter, k))) };
    const req = await buildPaymentRequest(signed, parseZec("0.01"), "ORDER-1");
    expect(req.lines.map((l) => l.amountZat)).toEqual([500_000n, 300_000n, 200_000n]);
    const parsed = parseUri(req.uri);
    expect(parsed).toHaveLength(3);
    expect(parsed.reduce((a, p) => a + (p.amountZat ?? 0n), 0n)).toBe(1_000_000n);
    const memo = new TextDecoder().decode(parsed[1]!.memo);
    expect(memo).toBe(`bonbagi:v1 o=ORDER-1 c=${req.charterHash.slice(0, 16)} m=2/3`);
  });
  it("refuses to build when a member has not signed", async () => {
    const { charter, keys } = await makeCharter();
    const signed = { charter, signatures: [await signCharter(charter, keys[0]!), await signCharter(charter, keys[1]!)] };
    await expect(buildPaymentRequest(signed, parseZec("0.01"), "X")).rejects.toThrow(/Mentor C/);
  });
});

import { addSignature, parseCharterFile } from "../src/core/charter.ts";
import { percentToBps } from "../src/core/split.ts";

describe("charter file helpers", () => {
  it("percentToBps", () => {
    expect(percentToBps("50")).toBe(5000);
    expect(percentToBps("33.33")).toBe(3333);
    expect(percentToBps("0.5")).toBe(50);
    for (const bad of ["0", "101", "33.333", "abc", ""]) expect(() => percentToBps(bad)).toThrow();
  });
  it("round-trips through JSON and collects signatures one by one", async () => {
    const { charter, keys } = await makeCharter();
    let file = parseCharterFile(JSON.stringify({ charter, signatures: [] }));
    for (const k of keys) file = parseCharterFile(JSON.stringify(await addSignature(file, k)));
    expect(file.signatures).toHaveLength(3);
    expect((await verifyCharter(file)).unsigned).toEqual([]);
    // signing twice replaces, not duplicates
    file = await addSignature(file, keys[0]!);
    expect(file.signatures).toHaveLength(3);
  });
  it("rejects garbage", () => {
    expect(() => parseCharterFile("nope")).toThrow(/JSON/);
    expect(() => parseCharterFile("{}")).toThrow();
    expect(() => parseCharterFile(JSON.stringify({ charter: { members: [{}] } }))).toThrow(/label/);
  });
});
