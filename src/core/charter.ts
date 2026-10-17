// The charter is the collective's agreement: who gets paid, to which shielded
// address, and what share. Every member signs the same canonical bytes with
// their own Ed25519 key. The pay page refuses to build a payment request
// unless every member's signature verifies — so nobody (including whoever
// hosts the page) can swap an address or change a percentage unnoticed.

import * as ed from "@noble/ed25519";
import { assertShielded, type Network } from "./address.ts";
import { TOTAL_BPS } from "./split.ts";

export const CHARTER_VERSION = 1;
const DOMAIN = "bonbagi-charter-v1\n";

export interface Member {
  label: string;
  address: string;
  /** Share in basis points (100 = 1%). */
  bps: number;
  /** Member's Ed25519 public key, 64 lowercase hex characters. */
  pubkey: string;
}

export interface Charter {
  bonbagi: typeof CHARTER_VERSION;
  network: Network;
  title: string;
  /** Minimum zatoshi per output, as a decimal string. */
  minShareZat: string;
  members: Member[];
}

export interface Signature {
  pubkey: string;
  sig: string;
}

export interface SignedCharter {
  charter: Charter;
  signatures: Signature[];
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const enc = new TextEncoder();

/** JSON with keys sorted at every level and no whitespace; strings NFC-normalised. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("charter numbers must be safe integers");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
  }
  throw new Error(`unsupported value in charter: ${typeof value}`);
}

/** Bytes every member signs. */
export function charterMessage(charter: Charter): Uint8Array {
  return enc.encode(DOMAIN + canonicalJson(charter));
}

export async function charterHash(charter: Charter): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", charterMessage(charter) as Uint8Array<ArrayBuffer>);
  return ed.etc.bytesToHex(new Uint8Array(digest));
}

/** Structural checks that do not need signatures. Throws with a human-readable reason. */
export function validateCharter(c: Charter): void {
  if (c.bonbagi !== CHARTER_VERSION) throw new Error(`unsupported charter version ${String(c.bonbagi)}`);
  if (c.network !== "main" && c.network !== "test") throw new Error("network must be main or test");
  if (!c.title.trim() || c.title.length > 80) throw new Error("title must be 1–80 characters");
  if (!/^[1-9][0-9]*$/.test(c.minShareZat)) throw new Error("minShareZat must be a positive whole number");
  if (c.members.length < 2) throw new Error("a collective needs at least two members");
  if (c.members.length > 50) throw new Error("at most 50 members");
  const addrs = new Set<string>();
  const keys = new Set<string>();
  let sum = 0;
  c.members.forEach((m, i) => {
    const who = `member ${i + 1} (${m.label})`;
    if (!m.label.trim() || m.label.length > 40) throw new Error(`${who}: label must be 1–40 characters`);
    const info = assertShielded(m.address);
    if (info.network !== c.network) throw new Error(`${who}: address is on ${info.network}net, charter is ${c.network}net`);
    if (addrs.has(m.address)) throw new Error(`${who}: address used twice`);
    addrs.add(m.address);
    if (!HEX64.test(m.pubkey)) throw new Error(`${who}: public key must be 64 lowercase hex characters`);
    if (keys.has(m.pubkey)) throw new Error(`${who}: public key used twice`);
    keys.add(m.pubkey);
    if (!Number.isInteger(m.bps) || m.bps <= 0) throw new Error(`${who}: share must be a positive whole number of basis points`);
    sum += m.bps;
  });
  if (sum !== TOTAL_BPS) throw new Error(`shares add up to ${sum / 100}%, must be exactly 100%`);
}

export function newPrivateKey(): string {
  return ed.etc.bytesToHex(ed.utils.randomPrivateKey());
}

export async function publicKeyOf(privHex: string): Promise<string> {
  return ed.etc.bytesToHex(await ed.getPublicKeyAsync(ed.etc.hexToBytes(privHex)));
}

/** A member signs the charter with their own private key. */
export async function signCharter(charter: Charter, privHex: string): Promise<Signature> {
  validateCharter(charter);
  const pubkey = await publicKeyOf(privHex);
  if (!charter.members.some((m) => m.pubkey === pubkey)) throw new Error("this key does not belong to any member of the charter");
  const sig = await ed.signAsync(charterMessage(charter), ed.etc.hexToBytes(privHex));
  return { pubkey, sig: ed.etc.bytesToHex(sig) };
}

export interface VerifyResult {
  hash: string;
  /** Members (by index) whose signature is missing or invalid. Empty = fully signed. */
  unsigned: number[];
}

/** Checks structure and every signature. Never throws on a bad signature — reports it. */
export async function verifyCharter(signed: SignedCharter): Promise<VerifyResult> {
  const { charter, signatures } = signed;
  validateCharter(charter);
  const msg = charterMessage(charter);
  const memberKeys = new Set(charter.members.map((m) => m.pubkey));
  for (const s of signatures) {
    if (!memberKeys.has(s.pubkey)) throw new Error("signature from a key that is not a member");
  }
  const unsigned: number[] = [];
  for (const [i, m] of charter.members.entries()) {
    const own = signatures.filter((s) => s.pubkey === m.pubkey);
    if (own.length > 1) throw new Error(`member ${i + 1} has more than one signature`);
    const s = own[0];
    let ok = false;
    if (s && HEX128.test(s.sig)) {
      try {
        ok = await ed.verifyAsync(ed.etc.hexToBytes(s.sig), msg, ed.etc.hexToBytes(m.pubkey));
      } catch {
        ok = false;
      }
    }
    if (!ok) unsigned.push(i);
  }
  return { hash: await charterHash(charter), unsigned };
}

/** Read a charter file someone pasted or uploaded. Checks shape only; call verifyCharter for the rest. */
export function parseCharterFile(text: string): SignedCharter {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("not valid JSON");
  }
  const o = raw as Partial<SignedCharter> | null;
  const c = o?.charter as Partial<Charter> | undefined;
  if (!o || typeof o !== "object" || !c || typeof c !== "object") throw new Error('expected {"charter": …, "signatures": […]}');
  if (!Array.isArray(c.members)) throw new Error("charter.members must be a list");
  for (const m of c.members as unknown[]) {
    const mm = m as Partial<Member>;
    if (typeof mm?.label !== "string" || typeof mm.address !== "string" || typeof mm.bps !== "number" || typeof mm.pubkey !== "string") {
      throw new Error("each member needs label, address, bps and pubkey");
    }
  }
  if (typeof c.title !== "string" || typeof c.minShareZat !== "string" || typeof c.network !== "string") throw new Error("charter needs title, network and minShareZat");
  const sigs = o.signatures ?? [];
  if (!Array.isArray(sigs) || sigs.some((s) => typeof s?.pubkey !== "string" || typeof s?.sig !== "string")) throw new Error("signatures must be a list of {pubkey, sig}");
  return { charter: c as Charter, signatures: sigs };
}

/** Add or replace this member's signature. */
export async function addSignature(file: SignedCharter, privHex: string): Promise<SignedCharter> {
  const s = await signCharter(file.charter, privHex);
  return { charter: file.charter, signatures: [...file.signatures.filter((x) => x.pubkey !== s.pubkey), s] };
}
