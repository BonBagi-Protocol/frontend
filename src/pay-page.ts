// Pay page: load a signed charter (link fragment, paste or file), verify every
// signature in this browser, then build one ZIP-321 request for the price.
// Client-side only; nothing is stored, logged or transmitted.

import "./fx.ts";
import qrcode from "qrcode-generator";
import * as ed from "@noble/ed25519";
import { newPrivateKey, parseCharterFile, publicKeyOf, signCharter, verifyCharter, type Charter, type SignedCharter } from "@bonbagi/core";
import { charterMessage, splitAmount, validateCharter } from "@bonbagi/core";
import { decodePayFragment, estimateFeeZat, newOrderId, shortAddress } from "@bonbagi/core";
import { buildPaymentRequest, type PaymentRequest } from "@bonbagi/core";
import { formatZec, parseZec } from "@bonbagi/core";
import { createRegister, type ShareEdit } from "./kasir/register.ts";
import { createResult, createTrace, fmtMs, type TraceLine } from "./kasir/trace.ts";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const paste = $<HTMLTextAreaElement>("#paste");
const check = $("#check");
const order = $("#order");
const pay = $("#pay");
const price = $<HTMLInputElement>("#price");
const orderId = $<HTMLInputElement>("#orderid");

let current: SignedCharter | null = null;
/** Bumped on every load: an older load's async result is ignored. */
let loadGen = 0;
/** The register's current story (check, then print, then split): the next one waits for it. */
let deskBusy: Promise<void> = Promise.resolve();
/** The signed sample as loaded: "Cheat" always edits this original, so it can be pressed again. */
let sampleText: string | null = null;

const ICON_BAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>`;
const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const errCard = (title: string, detail = "") => `<section class="slip"><div class="banner err">${ICON_BAD}<div>${title}${detail ? `<span>${detail}</span>` : ""}</div></div></section>`;
const colour = (i: number) => `c${i % 6}`;
/** One letter per member: "Mentor A (host)" -> "A", "Hans" -> "H". */
const initial = (label: string) => label.match(/\b([A-Z0-9])\b/)?.[1] ?? (Array.from(label.trim())[0]?.toUpperCase() || "?");
/** A member as a sticker chip (the landing's Ayu / Bima / Citra), colour by position. */
const chip = (i: number, label: string) => `<span class="mchip ${colour(i)}"><i aria-hidden="true">${esc(initial(label))}</i><span>${esc(label)}</span></span>`;
/** The thermal printer the receipts come out of; the LED shows the verdict. */
const printer = (state: "ok" | "bad") => `<div class="printer ${state}" aria-hidden="true"><i class="led"></i><span class="slot"></span></div>`;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The red rubber stamp (same ink grain as the landing's LUNAS stamp), as SVG: attributes only, so the strict CSP allows it. */
const rubberStamp = (word: string) => `
  <svg class="rstamp" viewBox="0 0 300 112" aria-hidden="true">
    <defs><filter id="ink-grain" x="-4%" y="-6%" width="108%" height="112%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.25" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="s"/><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="2" result="w"/><feDisplacementMap in="s" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
    <g filter="url(#ink-grain)">
      <rect x="7" y="7" width="286" height="98" rx="16" fill="none" stroke="#c0341d" stroke-width="7"/>
      <rect x="19" y="19" width="262" height="74" rx="8" fill="none" stroke="#c0341d" stroke-width="2.4"/>
      <text class="rstamp-t" x="150" y="81" text-anchor="middle" fill="#c0341d" textLength="232" lengthAdjust="spacingAndGlyphs">${word}</text>
    </g>
  </svg>`;
/** Share bar as SVG rects: widths are attributes, so the strict CSP (no inline styles) allows it. */
function shareBar(bps: number[]): string {
  let x = 0;
  const rects = bps.map((b, i) => {
    const r = `<rect class="${colour(i)}" x="${x / 100}%" y="0" width="${b / 100}%" height="100%"/>`;
    x += b;
    return r;
  });
  return `<svg class="sharebar" aria-hidden="true">${rects.join("")}</svg>`;
}

/* ---------------------------------------------------------------------------------------------
   The register desk at the top of the page: the 3D register, its step strip, the live trace and
   the result panel. It only shows what this page really does: every line in the trace is a step
   that just ran in this tab (with its measured time), every number comes from the charter, the
   split and the ZIP-321 request. Paying is the buyer's own wallet: the register waits for it and
   never claims a payment happened.
   --------------------------------------------------------------------------------------------- */
const kasir = $("#kasir");
const kstate = $("#kstate");
const ks = {
  load: $<HTMLButtonElement>("#ks-load"),
  check: $("#ks-check"),
  ring: $("#ks-ring"),
  print: $<HTMLButtonElement>("#ks-print"),
  pay: $<HTMLAnchorElement>("#ks-pay"),
  split: $<HTMLButtonElement>("#ks-split"),
  cheat: $<HTMLButtonElement>("#ks-cheat"),
};
const trace = createTrace($("#ktlist"), $("#kth"), $("#ktcount"), $<HTMLButtonElement>("#kjump"), reduced());
const result = createResult($("#kres"));
const reg = createRegister($("#kstage"), { reducedMotion: reduced(), onKey: onRegisterKey });
let showGen = 0;
let deskHasCard = false;
let lastShares: bigint[] = [];
let lastReq: PaymentRequest | null = null;
let buildFromDesk = false;
let lastSource = "";

type DeskState = "idle" | "checking" | "verified" | "refused" | "error" | "printing" | "awaiting";
let deskNow: DeskState = "idle";
const sampleish = () => document.body.classList.contains("is-try") || lastSource === "the sample" || lastSource === "the edited charter";
function deskState(s: DeskState, uri?: string) {
  deskNow = s;
  const mark = (el: HTMLElement, cls: "" | "is-next" | "is-done" | "is-bad" | "is-wait", text: string, n: string) => {
    el.classList.remove("is-next", "is-done", "is-bad", "is-wait");
    if (cls) el.classList.add(cls);
    el.querySelector("span")!.textContent = text;
    el.querySelector("i")!.textContent = n;
  };
  const bad = s === "refused" || s === "error";
  const printed = s === "printing" || s === "awaiting";
  const checked = s === "verified" || printed;
  mark(ks.load, s === "idle" ? "is-next" : bad ? "" : "is-done", s === "idle" ? "Try a sample charter" : bad && sampleish() ? "Start over with the sample" : "Load another charter", s !== "idle" && !bad ? "✓" : "1");
  mark(ks.check, bad ? "is-bad" : s === "checking" ? "is-wait" : checked ? "is-done" : "",
    s === "refused" ? "Refused: signatures broken" : s === "error" ? "Cannot read the charter" : s === "checking" ? "Checking signatures…" : "Check signatures", bad ? "✗" : checked ? "✓" : "2");
  mark(ks.ring, printed ? "is-done" : "", "Ring up the price", printed ? "✓" : "3");
  ks.print.disabled = !checked;
  mark(ks.print, s === "verified" ? "is-next" : printed ? "is-done" : "", printed ? "Print again" : "Print the receipt", printed ? "✓" : "4");
  if (printed && uri) ks.pay.href = uri;
  if (!printed) ks.pay.removeAttribute("href");
  ks.pay.setAttribute("aria-disabled", String(!printed));
  mark(ks.pay, s === "awaiting" ? "is-next" : s === "printing" ? "is-wait" : "", s === "awaiting" ? "Pay in your wallet" : "Pay in your wallet", "5");
  ks.split.disabled = s !== "awaiting";
  mark(ks.split, s === "awaiting" ? "is-done" : "", s === "awaiting" ? "Replay the split" : "How it splits", s === "awaiting" ? "✓" : "6");
  ks.cheat.hidden = $("#cheat").hidden || s === "idle" || bad;
  const word: Record<DeskState, [string, string]> = {
    idle: ["Ready", ""], checking: ["Checking", ""], verified: ["Verified", "is-gold"], refused: ["Refused", "is-red"],
    error: ["Can't read", "is-red"], printing: ["Printing", ""], awaiting: ["Your wallet", "is-mint"],
  };
  kstate.textContent = word[s][0];
  kstate.className = word[s][1];
}

/** Bring the register into view when an action below would change it. */
function showDesk() {
  const r = kasir.getBoundingClientRect();
  if (r.top < 0 || r.top > innerHeight * 0.35) kasir.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}

/** Each signature again, one by one, only to time it for the trace (verifyCharter stays the verdict). */
async function timedSignatures(signed: SignedCharter): Promise<{ ms: number; has: boolean }[]> {
  const bytes = charterMessage(signed.charter);
  const out: { ms: number; has: boolean }[] = [];
  for (const m of signed.charter.members) {
    const s = signed.signatures.find((x) => x.pubkey === m.pubkey);
    const t = performance.now();
    if (s && /^[0-9a-f]{128}$/.test(s.sig)) {
      try {
        await ed.verifyAsync(ed.etc.hexToBytes(s.sig), bytes, ed.etc.hexToBytes(m.pubkey));
      } catch {
        /* the verdict comes from verifyCharter */
      }
    }
    out.push({ ms: performance.now() - t, has: !!s });
  }
  return out;
}

async function showLoad(signed: SignedCharter, hash: string, unsigned: number[], tampered: number[], source: string, verifyMs: number, edits?: ShareEdit[]) {
  const g = ++showGen;
  const stale = () => g !== showGen;
  const c = signed.charter;
  const n = c.members.length;
  const ready = unsigned.length === 0;
  lastSource = source;
  lastShares = [];
  lastReq = null;
  trace.clear();
  trace.note(`charter from ${source}`);
  result.clear();
  result.members(c.members.map((m) => ({ label: m.label, bps: m.bps, address: m.address })), initial, colour);
  result.badge("checking");
  deskState("checking");
  let t = performance.now();
  const bytes = charterMessage(c);
  const readMs = performance.now() - t;
  const l1 = trace.push("charter.read");
  if (edits && deskHasCard) await reg.tamper(edits);
  else await reg.loadCharter(c.members.map((m) => ({ label: m.label, bps: m.bps })), hash, c.title);
  deskHasCard = true;
  if (stale()) return;
  l1.done("ok", `${bytes.length} bytes each member signed · ${n} members · ${c.network === "main" ? "mainnet" : "testnet"}`, readMs);
  if (edits) {
    trace.push("charter.edit").done("edit", `${edits.map((x) => `${c.members[x.index]?.label ?? "member"} ${x.fromBps / 100}% → ${x.toBps / 100}%`).join(" · ")} · after everyone signed`, null);
  }
  t = performance.now();
  validateCharter(c);
  const vMs = performance.now() - t;
  trace.push("charter.validate").done("ok", `shares ${c.members.map((m) => `${m.bps / 100}%`).join(" + ")} = 100% · fingerprint ${hash.slice(0, 8)}…`, vMs);
  const timed = await timedSignatures(signed);
  if (stale()) return;
  const results = c.members.map((_, i) => !unsigned.includes(i));
  const label = (i: number) => c.members[i]?.label ?? `member ${i + 1}`;
  // up to five members: one line per signature; a bigger collective gets one grouped line with the details folded
  const grouped = n > 5;
  let pending: TraceLine | null = trace.push(grouped ? `ed25519.verify ×${n}` : `ed25519.verify ${label(0)}`);
  let seen = 0;
  const onEach = (i: number) => {
    if (stale()) return;
    const ok = results[i] ?? false;
    const tm = timed[i];
    result.status(i, ok ? "signed" : tampered.includes(i) ? "broken" : "missing");
    seen++;
    if (grouped) {
      if (seen === n) {
        const okN = results.filter(Boolean).length;
        const total = timed.reduce((a, x) => a + x.ms, 0);
        const rows = c.members.map((m, j) => `<li>${esc(m.label)} ${results[j] ? "✓" : "✗"} · ${fmtMs(timed[j]?.ms)}</li>`).join("");
        pending?.done(okN === n ? "ok" : "no", null, total,
          `<span class="k-rq k-wrap">${okN} ✓${okN < n ? ` · ${n - okN} ✗` : ""} · ${n} signatures checked one by one</span><details class="k-more"><summary>Show all ${n}</summary><ol>${rows}</ol></details>`);
      }
    } else {
      pending?.done(ok ? "ok" : "no", ok ? `${label(i)} ✓ · key ${c.members[i]?.pubkey.slice(0, 6) ?? ""}…` : tm?.has ? `${label(i)} ✗ · the signed bytes differ` : `${label(i)} ✗ · no signature yet`, tm?.ms);
      pending = i + 1 < n ? trace.push(`ed25519.verify ${label(i + 1)}`) : null;
    }
    if (seen === n) {
      const st = trace.push("charter.state");
      if (ready) st.done("ok", `→ VERIFIED · ${n} of ${n} signatures match this exact charter`, verifyMs);
      else st.done("no", tampered.length ? `→ REFUSED · ${tampered.length} of ${n} signatures broke: the charter changed after signing · drawer locked` : `→ REFUSED · ${unsigned.length} of ${n} signatures missing · drawer locked`, verifyMs);
    }
  };
  if (ready) {
    await reg.verified(results, onEach);
    if (stale()) return;
    result.badge("verified", "gold");
    deskState("verified");
  } else {
    result.badge("refused", "red");
    result.refused(true, tampered.length ? "the charter changed after signing" : "not every member has signed");
    deskState("refused");
    await reg.refused(results, tampered.length ? "REFUSED" : "UNSIGNED", onEach);
  }
}

function deskError(step: string, why: string) {
  ++showGen;
  deskHasCard = false;
  lastReq = null;
  trace.clear();
  trace.push(step).done("no", why, null);
  result.clear();
  result.badge("cannot read", "red");
  reg.error("CANNOT READ THIS CHARTER");
  deskState("error");
}

async function showPrint(signed: SignedCharter, req: PaymentRequest, priceZat: bigint, buildMs: number, feeZat: bigint, feeMs: number, qr: ReturnType<typeof qrcode> | null) {
  const g = ++showGen;
  const stale = () => g !== showGen;
  const c = signed.charter;
  const n = req.lines.length;
  deskState("printing", req.uri);
  const t = performance.now();
  const shares = splitAmount(priceZat, c.members.map((m) => m.bps), BigInt(c.minShareZat));
  const splitMs = performance.now() - t;
  const floor = c.members.reduce((a, m) => a + (priceZat * BigInt(m.bps)) / 10000n, 0n);
  lastShares = shares;
  const l1 = trace.push("split.zat");
  await reg.ringUp(priceZat, shares);
  if (stale()) return;
  l1.done("ok", `${priceZat} → ${shares.join(" / ")} · remainder ${priceZat - floor} zat · every share ≥ ${c.minShareZat} zat`, splitMs);
  result.amounts(shares);
  const params = new URLSearchParams(req.uri.slice(req.uri.indexOf("?") + 1));
  const cut = (s: string, k = 22) => { const cp = Array.from(s); return cp.length > k ? `${cp.slice(0, k).join("")}…` : s; };
  const rq = req.lines
    .slice(0, 3)
    .map((l, i) => {
      const sfx = i ? `.${i}` : "";
      return `<span class="k-rq">${i ? "&amp;" : ""}<span class="k-k">address${sfx}=</span><span class="k-v">${esc(shortAddress(l.address))}</span>&amp;<span class="k-k">amount${sfx}=</span><span class="k-v">${formatZec(l.amountZat)}</span></span><span class="k-rq k-ind">&amp;<span class="k-k">memo${sfx}=</span>${esc(cut(params.get(`memo${sfx}`) ?? ""))}</span>`;
    })
    .join("") + (n > 3 ? `<span class="k-rq">… +${n - 3} more payments in the same request</span>` : "");
  trace.push("zip321.build").done("ok", null, buildMs,
    `<span class="k-rq k-wrap">→ ${n} outputs · 1 request · ${req.uri.length} characters</span><span class="k-rq k-wrap">memo ${esc(req.lines[0]?.memo.replace(/m=1\//, "m=…/") ?? "")}</span><span class="k-rq">zcash:?</span>${rq}`);
  result.memos(req.lines.map((l) => l.memo), false);
  req.lines.forEach((_, i) => result.status(i, "in request"));
  trace.push("fee.zip317").done("ok", `≈ ${formatZec(feeZat)} ZEC · 5000 zat × max(2, ${n} outputs + 1) · added by your wallet`, feeMs);
  result.totals(`${formatZec(req.totalZat)} ZEC`, `≈ ${formatZec(feeZat)} ZEC`, `1 tx · ${n} shielded outputs`);
  const l4 = trace.push("receipt.print");
  await reg.printReceipt({
    title: c.title, orderId: orderId.value.trim(), fingerprint: req.charterHash, testnet: c.network !== "main",
    lines: req.lines.map((l) => ({ label: l.label, bps: l.bps, amountZat: l.amountZat })), totalZat: req.totalZat, feeZat,
    ...(qr ? { qr: { size: qr.getModuleCount(), isDark: (r: number, col: number) => qr.isDark(r, col) } } : {}),
  });
  if (stale()) return;
  l4.done("ok", qr ? `${n} lines + QR · the scannable QR is on the paper receipt below` : `${n} lines · too long for one QR code: use Open in wallet or Copy request`, null);
  await playSplit(g, req);
}

async function playSplit(g: number, req: PaymentRequest) {
  const stale = () => g !== showGen;
  const l = trace.push("split.preview");
  await reg.split(lastShares);
  if (stale()) return;
  const first = req.lines.slice(0, 3).map((x) => `${x.label} ${formatZec(x.amountZat)}`).join(" · ");
  l.done("info", `how the one payment will split: ${first}${req.lines.length > 3 ? ` · +${req.lines.length - 3} more` : ""} ZEC, each in its own shielded output with a memo only that member can read`, null);
  result.memos(req.lines.map((x) => x.memo), true);
  req.lines.forEach((_, i) => result.status(i, "wallet"));
  reg.awaitingWallet(req.totalZat);
  trace.push("wallet", "YOU").done("wait", "waiting for your wallet · open the request, check every recipient and amount, then confirm there. Nothing has been paid.", null);
  result.badge("your wallet", "gold");
  lastReq = req;
  deskState("awaiting", req.uri);
}

function onRegisterKey(k: string) {
  if (k === "LOAD") ks.load.click();
  else if ((k === "TOTAL" || k === "PRINT") && !ks.print.disabled) ks.print.click();
  else if (k === "PAY" && ks.pay.href) ks.pay.click();
  else if (k === "OPEN" && !ks.split.disabled) ks.split.click();
  else if (k === "CHEAT" && !ks.cheat.hidden) ks.cheat.click();
  else if (/^([0-9]|DOT|C)$/.test(k) && !order.hidden) {
    // the keypad types into the real price field
    price.value = k === "C" ? "" : `${price.value}${k === "DOT" ? "." : k}`;
    reg.lcd("PRICE · THEN PRINT", price.value || "0");
  }
}

ks.load.addEventListener("click", () => {
  if (deskNow === "idle" || ((deskNow === "refused" || deskNow === "error") && sampleish())) {
    $("#sample").click();
    return;
  }
  $<HTMLDetailsElement>("#rawbox").open = true;
  $("#load").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  paste.focus({ preventScroll: true });
});
ks.print.addEventListener("click", () => {
  if (!current) return;
  if (!price.value.trim()) {
    order.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
    price.focus({ preventScroll: true });
    return;
  }
  buildFromDesk = true;
  $("#build").click();
});
ks.pay.addEventListener("click", (e) => {
  if (!ks.pay.href) {
    e.preventDefault();
    return;
  }
  trace.push("wallet.open", "YOU").done("wait", "handed the request to your wallet app · confirm there; this page never sees the payment", null);
});
ks.split.addEventListener("click", () => {
  if (!lastReq || !lastShares.length) return;
  const g = ++showGen;
  deskState("printing", lastReq.uri);
  deskBusy = playSplit(g, lastReq).catch(() => undefined);
});
ks.cheat.addEventListener("click", () => $("#cheat").click());

function reset() {
  ++loadGen;
  current = null;
  lastReq = null;
  order.hidden = true;
  pay.innerHTML = "";
}

async function load(signed: SignedCharter, source: string, priceZat?: bigint, edits?: ShareEdit[]) {
  reset();
  const g = loadGen;
  try {
    const t0 = performance.now();
    const { hash, unsigned } = await verifyCharter(signed);
    if (g !== loadGen) return; // a newer charter was loaded meanwhile
    const verifyMs = performance.now() - t0;
    const c = signed.charter;
    const ready = unsigned.length === 0;
    const signedBy = new Set(signed.signatures.map((sg) => sg.pubkey));
    const tampered = unsigned.filter((i) => signedBy.has(c.members[i]!.pubkey));
    const n = c.members.length;
    const [title, detail] = ready
      ? [`Verified in your browser — signed by ${n === 2 ? "both" : `all ${n}`} members.`, "Any change to an address or a share after signing breaks the signatures, and this page refuses to continue. Signatures prove the listed members agreed to this exact split; compare the fingerprint above with the one the seller published to know it is their collective."]
      : tampered.length > 0
        ? [`Not payable: the charter was changed after it was signed.`, `${tampered.length} of ${n} signatures no longer match this exact text (${esc(tampered.map((i) => c.members[i]!.label).join(", "))}). Someone edited an address, a share or another field. Do not pay; ask the seller for the original link.`]
        : [`Not payable: ${unsigned.length} of ${n} signatures missing.`, `Waiting for ${esc(unsigned.map((i) => c.members[i]!.label).join(", "))}. Every member must sign before anyone can pay. Ask the seller for the fully signed charter.`];
    // The check prints as a receipt: a gold VERIFIED sticker when every signature holds,
    // a red rubber stamp slammed on it when the charter was edited or is unsigned.
    check.innerHTML = `
      <div class="till">
        ${printer(ready ? "ok" : "bad")}
        <div class="feed">
          <section class="receipt ${ready ? "is-ok" : "is-bad"}" aria-labelledby="check-title">
            <p class="r-brand">BONBAGI</p>
            <p class="r-sub">Charter check · in your browser</p>
            <h2 class="r-title" id="check-title">${esc(c.title)}</h2>
            <p class="r-meta">${c.network === "main" ? "Mainnet" : "Testnet"} · fingerprint <code>${hash.slice(0, 32)}</code><br />loaded from ${esc(source)}</p>
            <div class="r-rule"></div>
            ${shareBar(c.members.map((m) => m.bps))}
            <ul class="r-lines" aria-label="Members and signatures">
              ${c.members
                .map((m, i) => {
                  const st = !unsigned.includes(i) ? '<span class="tag ok">valid</span>' : tampered.includes(i) ? '<span class="tag err">broken</span>' : '<span class="tag err">missing</span>';
                  return `<li class="r-line${tampered.includes(i) ? " broken" : ""}">${chip(i, m.label)}<span class="num">${(m.bps / 100).toFixed(2)}%</span><span class="addr">${esc(shortAddress(m.address))}</span>${st}</li>`;
                })
                .join("")}
            </ul>
            <div class="r-rule2"></div>
            ${ready ? `<div class="vstamp" aria-hidden="true"><b>Verified</b><small>${n}/${n} signed</small></div>` : `<div class="stamp-zone">${rubberStamp(tampered.length > 0 ? "REFUSED" : "UNSIGNED")}</div>`}
            <p class="r-verdict"><strong>${title}</strong>${detail}</p>
          </section>
        </div>
      </div>`;
    deskBusy = showLoad(signed, hash, unsigned, tampered, source, verifyMs, edits).catch(() => undefined);
    if (!ready) return;
    current = signed;
    order.hidden = false;
    price.value = priceZat === undefined ? "" : formatZec(priceZat);
    orderId.value = newOrderId();
    // focus the next step without scrolling past the verdict: the buyer should see the receipt first
    (priceZat === undefined ? price : $("#build")).focus({ preventScroll: true });
  } catch (e) {
    if (g !== loadGen) return;
    check.innerHTML = errCard("This charter cannot be used.", esc(msg(e)));
    deskError("charter.validate", msg(e));
  }
}

function loadText(text: string, source: string, edits?: ShareEdit[]) {
  reset();
  try {
    void load(parseCharterFile(text), source, undefined, edits);
  } catch (e) {
    check.innerHTML = errCard("Could not read the charter.", esc(msg(e)));
    deskError("charter.read", msg(e));
  }
}

function loadFromFragment() {
  try {
    const frag = decodePayFragment(location.hash);
    if (!frag) return;
    $("#loadstate").textContent = "Charter loaded from the pay link you opened.";
    // a buyer who opened a pay link goes straight to the verification
    const hero = document.querySelector<HTMLElement>("#hero");
    if (hero) hero.hidden = true;
    $<HTMLDetailsElement>("#rawbox").open = false;
    document.body.classList.add("is-link"); // the receipt comes first; the load card moves down

    void load(frag.signed, "the pay link", frag.priceZat);
  } catch (e) {
    reset();
    check.innerHTML = errCard("This pay link does not work.", esc(msg(e)));
    deskError("paylink.decode", msg(e));
  }
}

$("#loadbtn").addEventListener("click", () => {
  sampleText = null;
  loadText(paste.value, "pasted text");
});
$<HTMLInputElement>("#file").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  if (f.size > 100_000) {
    check.innerHTML = errCard("That file is too large to be a charter.");
    return;
  }
  paste.value = await f.text();
  sampleText = null;
  loadText(paste.value, "an uploaded file");
});

// Dev builds only (Vite drops this in production): pay.html?members=N signs an N-member sample (2–50)
// so big collectives can be tested; shares are uneven and each is at least 1%.
const DEV_MEMBERS = import.meta.env.DEV ? Math.min(50, Math.max(0, Number(new URLSearchParams(location.search).get("members")) || 0)) : 0;
function devShares(n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => (i === 0 ? 6 : i < 3 ? 4 : i % 4 === 0 ? 2 : 1));
  const sum = w.reduce((a, b) => a + b, 0);
  const bps = w.map((x) => Math.max(100, Math.floor((x / sum) * 10000)));
  bps[0] = (bps[0] ?? 0) + 10000 - bps.reduce((a, b) => a + b, 0);
  return bps;
}

// Sample: three throwaway keys sign a testnet charter with made-up addresses.
// Wallets reject these addresses (bad checksum), so the sample cannot move funds.
$("#sample").addEventListener("click", async () => {
  const fakeAddr = (seed: string) => {
    const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const tail = [...crypto.getRandomValues(new Uint8Array(94))].map((b) => alphabet[b % 32]).join("");
    return `utest1${seed}${tail}`.slice(0, 106);
  };
  const n = DEV_MEMBERS || 3;
  const keys = Array.from({ length: n }, () => newPrivateKey());
  const pubs = await Promise.all(keys.map(publicKeyOf));
  const charter: Charter = {
    bonbagi: 1,
    network: "test",
    title: n === 3 ? "SAMPLE · Intro to Zcash class (3 mentors)" : `SAMPLE · ${n}-member collective (dev)`,
    minShareZat: "10000",
    members:
      n === 3
        ? [
            { label: "Mentor A (host)", address: fakeAddr("sample"), bps: 4000, pubkey: pubs[0]! },
            { label: "Mentor B", address: fakeAddr("sample"), bps: 3000, pubkey: pubs[1]! },
            { label: "Mentor C", address: fakeAddr("sample"), bps: 3000, pubkey: pubs[2]! },
          ]
        : devShares(n).map((bps, i) => ({ label: i === 0 ? "Mentor A (host)" : i === 1 ? "Mentor B" : `Member ${i + 1}`, address: fakeAddr("sample"), bps, pubkey: pubs[i]! })),
  };
  const signed: SignedCharter = { charter, signatures: await Promise.all(keys.map((k) => signCharter(charter, k))) };
  paste.value = JSON.stringify(signed, null, 2);
  sampleText = paste.value;
  $("#loadstate").textContent = "Sample charter with made-up testnet addresses, signed by all three mentors. Press “Cheat” to move 10% from Mentor B to Mentor A after signing, or edit any address or share in the charter text and press “Check charter”.";
  $("#cheat").hidden = false;
  showDesk();
  await load(signed, "the sample", parseZec("0.01"));
});

// "Try to cheat the split": the host quietly moves 10% from Mentor B to himself.
// The total stays 100%, so only the signatures can catch it.
$("#cheat").addEventListener("click", () => {
  try {
    // always from the signed original: pressing it again shows the same refusal, never an invalid charter
    const signed = JSON.parse(sampleText ?? paste.value) as SignedCharter;
    const [a, b] = signed.charter.members;
    if (!a || !b || b.bps <= 1000) throw new Error("load the sample charter first");
    const edits: ShareEdit[] = [
      { index: 0, fromBps: a.bps, toBps: a.bps + 1000 },
      { index: 1, fromBps: b.bps, toBps: b.bps - 1000 },
    ];
    a.bps += 1000;
    b.bps -= 1000;
    paste.value = JSON.stringify(signed, null, 2);
    loadText(paste.value, "the edited charter", edits);
    $("#loadstate").textContent = `Changed after signing: Mentor A ${a.bps / 100}%, Mentor B ${b.bps / 100}%. Still 100% in total, yet every signature breaks.`;
    // the register is where the stamp comes down
    showDesk();
  } catch (e) {
    check.innerHTML = errCard("Could not edit the sample.", esc(msg(e)));
  }
});

// /try (redirects to pay.html?try; pay.html#try also works): load the sample and show the cheat button.
// The first card becomes the cheat desk; the raw charter text folds away (still one tap to edit).
if (location.hash === "#try" || new URLSearchParams(location.search).has("try")) {
  const hero = document.querySelector<HTMLElement>("#hero");
  if (hero) hero.hidden = true;
  document.body.classList.add("is-try");
  $<HTMLDetailsElement>("#rawbox").open = false;
  $("#cheat").hidden = false;
  $("#sample").click();
}

$("#orderid").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#build").click();
});
price.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#build").click();
});

$("#build").addEventListener("click", async () => {
  if (!current) return;
  const fromDesk = buildFromDesk;
  buildFromDesk = false;
  const g = loadGen;
  // one story at a time on the register: let the signature check (or the last print) finish first
  await deskBusy;
  if (g !== loadGen || !current) return;
  const signed = current;
  try {
    const priceZat = parseZec(price.value);
    const tb = performance.now();
    const req = await buildPaymentRequest(signed, priceZat, orderId.value.trim());
    if (g !== loadGen) return;
    const buildMs = performance.now() - tb;
    const n = req.lines.length;
    // a big collective's request can be longer than one QR code holds: then the receipt says so
    // and the buyer uses Open in wallet / Copy request
    let qr: ReturnType<typeof qrcode> | null = qrcode(0, "L");
    try {
      qr.addData(req.uri, "Byte");
      qr.make();
    } catch {
      qr = null;
    }
    const c = signed.charter;
    const svgSmall = qr ? qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) : "";
    const tf = performance.now();
    const feeZat = estimateFeeZat(n);
    const feeMs = performance.now() - tf;
    const fee = formatZec(feeZat);
    // The order prints as a receipt out of the printer slot (QR on the paper, frosted until tapped);
    // beside it, the pay desk: the total, the wallet buttons, and the sealed memo.
    pay.innerHTML = `
      <div class="paywrap">
        <div class="till">
          ${printer("ok")}
          <div class="feed">
            <section class="receipt" aria-labelledby="bon-title">
              <div class="bagi" aria-hidden="true"><b>Split ×${n}</b><small>signed · checked</small></div>
              <p class="r-brand">BONBAGI</p>
              <p class="r-sub">Receipt · bagi = split</p>
              <h2 class="r-title" id="bon-title">${esc(c.title)}</h2>
              <p class="r-meta">${esc(orderId.value.trim())} · charter ${req.charterHash.slice(0, 8)} · ${c.network === "main" ? "mainnet" : "testnet"}</p>
              <div class="r-rule"></div>
              <ul class="r-lines" aria-label="Who gets what">
                ${req.lines.map((l, i) => `<li class="r-line">${chip(i, l.label)}<span class="num">${(l.bps / 100).toFixed(2)}%</span><span class="addr">${esc(shortAddress(l.address))}</span><span class="amt">${formatZec(l.amountZat)}</span></li>`).join("")}
              </ul>
              <div class="r-rule2"></div>
              <div class="r-total"><span class="lab">Total · ${n} members</span><span class="big">${formatZec(req.totalZat)}<small>ZEC</small></span></div>
              <p class="r-fine"><span>+ network fee, estimate; your wallet sets the final fee (ZIP-317)</span><span>≈ ${fee} ZEC</span></p>
              <p class="r-fine"><span>One transaction · ${n} shielded outputs</span></p>
              <div class="r-rule"></div>
              ${qr ? `<button type="button" class="qrveil" id="qrveil" aria-expanded="false"><span class="qrimg" role="img" aria-label="QR code of the payment request">${svgSmall}</span><em>Tap to show QR</em></button>` : `<p class="r-fine c">This request (${n} payments, ${req.uri.length} characters) is too long for one QR code. Use “Open in wallet” or “Copy request”.</p>`}
              <p class="r-fine c">✓ Signed by ${n === 2 ? "both" : `all ${n}`} members · checked in your browser · charter ${req.charterHash.slice(0, 8)}</p>
              <div class="r-perf" aria-hidden="true"></div>
              <p class="r-thanks" aria-hidden="true">thank you!</p>
            </section>
          </div>
        </div>
        <section class="paydesk" aria-labelledby="w-title">
          <h2 class="kicker" id="w-title">Pay ${n} members in one transaction</h2>
          <div class="w-amt" aria-label="Total ${formatZec(req.totalZat)} ZEC">${formatZec(req.totalZat)}<small>ZEC</small></div>
          <p class="actions"><a class="button" id="open" href="${esc(req.uri)}">Open in wallet</a> <button type="button" class="ghost" id="copy">Copy request</button>${qr ? ` <button type="button" class="ghost" id="bigqr">Full-screen QR</button>` : ""}</p>
          <div class="note"><strong>Before you confirm,</strong> check that your wallet lists all ${n} recipients and amounts. If it shows only one, stop and use a wallet that supports multi-recipient requests (e.g. Zingo PC or Zkool).</div>
          <div><label for="uri">Payment request (ZIP-321)</label>
          <textarea id="uri" readonly spellcheck="false">${esc(req.uri)}</textarea></div>
          <div class="sealed"><p class="sk">${ICON_LOCK}Encrypted memo · only each member can read theirs</p><code>${esc(req.lines[0]!.memo.replace(/m=1\//, "m=…/"))}</code></div>
        </section>
      </div>`;
    $("#copy").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget as HTMLButtonElement;
      try {
        await navigator.clipboard.writeText(req.uri);
        btn.textContent = "Copied";
      } catch {
        // no clipboard access (old browser, http, denied): select the request so the buyer can copy it
        const box = $<HTMLTextAreaElement>("#uri");
        box.focus();
        box.select();
        btn.textContent = "Selected: copy it";
      }
    });
    $("#uri").addEventListener("focus", (ev) => (ev.target as HTMLTextAreaElement).select());
    // A 3-member request is ~1,000 characters (≈109×109 modules); at thumbnail size a phone
    // camera struggles, so let the buyer show it full-screen on a white background.
    const svg = qr ? qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }) : "";
    const openBig = () => {
      const full = document.createElement("div");
      full.className = "qr-full";
      full.setAttribute("role", "dialog");
      full.setAttribute("aria-label", "Payment request QR, full screen. Tap to close.");
      full.tabIndex = 0;
      full.innerHTML = `${svg}<p>Tap anywhere to close</p>`;
      const close = () => full.remove();
      full.addEventListener("click", close);
      full.addEventListener("keydown", (k) => { if (k.key === "Escape" || k.key === "Enter") close(); });
      document.body.append(full);
      full.focus();
    };
    // The QR holds every member's address, so it sits under frost until the buyer taps it
    // (a glance over the shoulder shows nothing); a second tap shows it full screen.
    if (qr) {
      $("#bigqr").addEventListener("click", openBig);
      const reveal = $<HTMLButtonElement>("#qrveil");
      reveal.addEventListener("click", () => {
        if (reveal.classList.contains("open")) return openBig();
        reveal.classList.add("open");
        reveal.setAttribute("aria-expanded", "true");
        reveal.querySelector("em")!.textContent = "Tap again for full screen";
      });
    }
    deskBusy = showPrint(signed, req, priceZat, buildMs, feeZat, feeMs, qr).catch(() => undefined);
    // pressed on the register: stay with the register; pressed in the order form: go to the receipt
    if (!fromDesk) pay.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  } catch (e) {
    pay.innerHTML = errCard("Could not create the payment request.", esc(msg(e)));
    const l = trace.push("zip321.build");
    l.done("no", msg(e));
  }
});

window.addEventListener("hashchange", loadFromFragment);
loadFromFragment();
