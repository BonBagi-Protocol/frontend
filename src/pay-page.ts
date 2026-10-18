// Pay page: load a signed charter (link fragment, paste or file), verify every
// signature in this browser, then build one ZIP-321 request for the price.
// Client-side only; nothing is stored, logged or transmitted.

import "./fx.ts";
import qrcode from "qrcode-generator";
import { newPrivateKey, parseCharterFile, publicKeyOf, signCharter, verifyCharter, type Charter, type SignedCharter } from "./core/charter.ts";
import { decodePayFragment, estimateFeeZat, newOrderId, shortAddress } from "./core/paylink.ts";
import { buildPaymentRequest } from "./core/request.ts";
import { formatZec, parseZec } from "./core/zatoshi.ts";

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

const ICON_OK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`;
const ICON_BAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>`;
const banner = (kind: "ok" | "err", title: string, detail = "") => `<div class="banner ${kind}">${kind === "ok" ? ICON_OK : ICON_BAD}<div>${title}${detail ? `<span>${detail}</span>` : ""}</div></div>`;
const errCard = (title: string, detail = "") => `<section class="card">${banner("err", title, detail)}</section>`;
const colour = (i: number) => `c${i % 6}`;
const who = (i: number, label: string, address: string) => `<div class="who"><span class="dot ${colour(i)}"></span><div>${esc(label)}<div class="addr">${esc(shortAddress(address))}</div></div></div>`;
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

function reset() {
  current = null;
  order.hidden = true;
  pay.innerHTML = "";
}

async function load(signed: SignedCharter, source: string, priceZat?: bigint) {
  reset();
  try {
    const { hash, unsigned } = await verifyCharter(signed);
    const c = signed.charter;
    const ready = unsigned.length === 0;
    const signedBy = new Set(signed.signatures.map((sg) => sg.pubkey));
    const tampered = unsigned.filter((i) => signedBy.has(c.members[i]!.pubkey));
    check.innerHTML = `
      <section class="card ${ready ? "done" : ""}">
        ${
          ready
            ? banner("ok", `Verified in your browser — signed by all ${c.members.length} members.`, "Any change to an address or a share after signing breaks the signatures, and this page refuses to continue. Signatures prove the listed members agreed to this exact split; compare the fingerprint below with the one the seller published to know it is their collective.")
            : tampered.length > 0
              ? banner(
                  "err",
                  `Not payable: the charter was changed after it was signed.`,
                  `${tampered.length} of ${c.members.length} signatures no longer match this exact text (${esc(tampered.map((i) => c.members[i]!.label).join(", "))}). Someone edited an address, a share or another field. Do not pay; ask the seller for the original link.`,
                )
              : banner(
                  "err",
                  `Not payable: ${unsigned.length} of ${c.members.length} signatures missing.`,
                  `Waiting for ${esc(unsigned.map((i) => c.members[i]!.label).join(", "))}. Every member must sign before anyone can pay. Ask the seller for the fully signed charter.`,
                )
        }
        <h2>${esc(c.title)}</h2>
        <p class="sub tight">${c.network === "main" ? "Mainnet" : "Testnet"} · fingerprint <code>${hash.slice(0, 16)}</code> · loaded from ${esc(source)}</p>
        ${shareBar(c.members.map((m) => m.bps))}
        <table>
          <tr><th>Member</th><th class="num">Share</th><th class="num">Signature</th></tr>
          ${c.members
            .map(
              (m, i) =>
                `<tr><td>${who(i, m.label, m.address)}</td><td class="num">${(m.bps / 100).toFixed(2)}%</td><td class="num">${
                  !unsigned.includes(i) ? '<span class="tag ok">valid</span>' : tampered.includes(i) ? '<span class="tag err">broken</span>' : '<span class="tag err">missing</span>'
                }</td></tr>`,
            )
            .join("")}
        </table>
      </section>`;
    if (!ready) return;
    current = signed;
    order.hidden = false;
    price.value = priceZat === undefined ? "" : formatZec(priceZat);
    orderId.value = newOrderId();
    (priceZat === undefined ? price : $("#build")).focus();
  } catch (e) {
    check.innerHTML = errCard("This charter cannot be used.", esc(msg(e)));
  }
}

function loadText(text: string, source: string) {
  reset();
  try {
    void load(parseCharterFile(text), source);
  } catch (e) {
    check.innerHTML = errCard("Could not read the charter.", esc(msg(e)));
  }
}

function loadFromFragment() {
  try {
    const frag = decodePayFragment(location.hash);
    if (!frag) return;
    $("#loadstate").textContent = "Charter loaded from the pay link you opened.";
    $("#hero").hidden = true;
    void load(frag.signed, "the pay link", frag.priceZat);
  } catch (e) {
    reset();
    check.innerHTML = errCard("This pay link does not work.", esc(msg(e)));
  }
}

$("#loadbtn").addEventListener("click", () => loadText(paste.value, "pasted text"));
$<HTMLInputElement>("#file").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  if (f.size > 100_000) {
    check.innerHTML = errCard("That file is too large to be a charter.");
    return;
  }
  paste.value = await f.text();
  loadText(paste.value, "an uploaded file");
});

// Sample: three throwaway keys sign a testnet charter with made-up addresses.
// Wallets reject these addresses (bad checksum), so the sample cannot move funds.
$("#sample").addEventListener("click", async () => {
  const fakeAddr = (seed: string) => {
    const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const tail = [...crypto.getRandomValues(new Uint8Array(94))].map((b) => alphabet[b % 32]).join("");
    return `utest1${seed}${tail}`.slice(0, 106);
  };
  const keys = [newPrivateKey(), newPrivateKey(), newPrivateKey()];
  const pubs = await Promise.all(keys.map(publicKeyOf));
  const charter: Charter = {
    bonbagi: 1,
    network: "test",
    title: "SAMPLE · Intro to Zcash class (3 mentors)",
    minShareZat: "10000",
    members: [
      { label: "Mentor A (host)", address: fakeAddr("sample"), bps: 4000, pubkey: pubs[0]! },
      { label: "Mentor B", address: fakeAddr("sample"), bps: 3000, pubkey: pubs[1]! },
      { label: "Mentor C", address: fakeAddr("sample"), bps: 3000, pubkey: pubs[2]! },
    ],
  };
  const signed: SignedCharter = { charter, signatures: await Promise.all(keys.map((k) => signCharter(charter, k))) };
  paste.value = JSON.stringify(signed, null, 2);
  $("#loadstate").textContent = "Sample charter with made-up testnet addresses. Edit any address or share above and press “Check charter” to see it rejected.";
  await load(signed, "the sample", parseZec("0.01"));
});

$("#orderid").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#build").click();
});
price.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#build").click();
});

$("#build").addEventListener("click", async () => {
  if (!current) return;
  try {
    const req = await buildPaymentRequest(current, parseZec(price.value), orderId.value.trim());
    const n = req.lines.length;
    const qr = qrcode(0, "L");
    qr.addData(req.uri, "Byte");
    qr.make();
    const c = current.charter;
    pay.innerHTML = `
      <section class="bon" aria-labelledby="bon-title">
        <span class="stamp">Signed ×${n}</span>
        <div class="head">
          <div class="brandline">BonBagi · receipt</div>
          <div class="title" id="bon-title">${esc(c.title)}</div>
          <div class="meta">${esc(orderId.value.trim())} · charter ${req.charterHash.slice(0, 8)} · ${c.network === "main" ? "mainnet" : "testnet"}</div>
        </div>
        <table>
          <tr><th>Recipient</th><th class="num">Share</th><th class="num">ZEC</th></tr>
          ${req.lines.map((l, i) => `<tr><td>${who(i, l.label, l.address)}</td><td class="num">${(l.bps / 100).toFixed(2)}%</td><td class="num">${formatZec(l.amountZat)}</td></tr>`).join("")}
        </table>
        <div class="grand"><span>Total to ${n} members</span><span class="amt">${formatZec(req.totalZat)} <small>ZEC</small></span></div>
        <p class="fee"><span>+ network fee, added by your wallet (ZIP-317)</span><span>≈ ${formatZec(estimateFeeZat(n))} ZEC</span></p>
        <div class="note inside"><strong>Before you confirm,</strong> check that your wallet lists all ${n} recipients and amounts above. If it shows only one, stop and use a wallet that supports multi-recipient requests (e.g. Zingo PC or Zkool).</div>
        <h2><span><span class="step">3</span> Pay with your wallet</span></h2>
        <div class="paygrid">
          <div class="qr" role="img" aria-label="QR code of the payment request">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
          <div>
            <p class="sub tight">Scan with a mobile wallet, open it in a desktop wallet, or copy the request into your wallet's “pay URI” field. One transaction, ${n} shielded outputs.</p>
            <p class="actions"><a class="button" id="open" href="${esc(req.uri)}">Open in wallet</a> <button type="button" class="ghost" id="copy">Copy request</button></p>
            <label for="uri">Payment request (ZIP-321)</label>
            <textarea id="uri" readonly spellcheck="false">${esc(req.uri)}</textarea>
          </div>
        </div>
        <p class="sub tight">Each member's encrypted memo (only they can read it): <code>${esc(req.lines[0]!.memo.replace(/m=1\//, "m=…/"))}</code></p>
      </section>`;
    $("#copy").addEventListener("click", async (ev) => {
      await navigator.clipboard.writeText(req.uri);
      (ev.target as HTMLButtonElement).textContent = "Copied";
    });
    $("#uri").addEventListener("focus", (ev) => (ev.target as HTMLTextAreaElement).select());
    pay.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    pay.innerHTML = errCard("Could not create the payment request.", esc(msg(e)));
  }
});

window.addEventListener("hashchange", loadFromFragment);
loadFromFragment();
