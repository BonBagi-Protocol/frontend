// Charter page: one board shows the charter open in this tab, with one ice block per
// member that freezes once that member's signature checks out. Members create a key,
// one person drafts the charter, everyone signs the same file, then a pay link is made.
// Client-side only; nothing is stored or transmitted, keys live only in this tab's memory.

import "./fx.ts";
import { assertShielded } from "@bonbagi/core";
import { addSignature, charterHash, newPrivateKey, parseCharterFile, publicKeyOf, signCharter, verifyCharter, type Charter, type SignedCharter } from "@bonbagi/core";
import { payLink, shortAddress } from "@bonbagi/core";
import { percentToBps, TOTAL_BPS } from "@bonbagi/core";
import { parseZec } from "@bonbagi/core";

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const colour = (i: number) => `c${i % 6}`;
const pct = (bps: number) => `${Number.isInteger(bps / 100) ? bps / 100 : (bps / 100).toFixed(2)}%`;
const HEX64 = /^[0-9a-f]{64}$/;

/** Core errors are short lowercase phrases; show them as sentences, with a few rewritten for people. */
function human(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const known: Record<string, string> = {
    "not valid JSON": "That is not a charter file: it is not valid JSON.",
    "this key does not belong to any member of the charter": "This key does not belong to any member of this charter. Check that you opened your own key file for this charter.",
    "signature from a key that is not a member": "The file has a signature from someone who is not a member. Ask for the original file.",
  };
  const s = known[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function download(name: string, text: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Copy with visible feedback; if the clipboard is refused, select the text so the person can copy it. */
async function copy(btn: HTMLButtonElement, text: string, fallback?: HTMLInputElement | HTMLTextAreaElement) {
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied";
  } catch {
    fallback?.select();
    btn.textContent = "Press Ctrl+C";
  }
  setTimeout(() => (btn.textContent = label), 1800);
}

/** One letter per member for the wax seal: "Mentor B" -> "B", "Hans" -> "H". */
const initial = (label: string) => label.match(/\b([A-Z0-9])\b/)?.[1] ?? (label.trim().charAt(0).toUpperCase() || "?");
/** A gold wax seal (the landing's closing scene); gradients and the wax filter live in charter.html. */
const sealSvg = (label: string, cracked = false) => {
  const ini = esc(initial(label));
  return (
    `<svg class="seal${cracked ? " cracked" : ""}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<circle class="spill" cx="50" cy="51" r="44" fill="url(#ws-wax)" filter="url(#ws-wx)"/>` +
    `<circle cx="50" cy="50" r="34.5" fill="url(#ws-face)"/>` +
    `<circle cx="50" cy="50" r="34.5" fill="none" stroke="url(#ws-rim-out)" stroke-width="2.6"/>` +
    `<circle cx="50" cy="50" r="31" fill="none" stroke="url(#ws-rim-in)" stroke-width="1.4" opacity=".9"/>` +
    `<circle cx="50" cy="50" r="27.2" fill="none" stroke="#a86c08" stroke-opacity=".6" stroke-width="1.3" stroke-dasharray=".1 3.05" stroke-linecap="round"/>` +
    `<text class="ini-hi" x="50.9" y="64.2" text-anchor="middle">${ini}</text>` +
    `<text class="ini" x="50" y="63" text-anchor="middle">${ini}</text>` +
    `<ellipse cx="37" cy="29" rx="17" ry="9" fill="url(#ws-gloss)" opacity=".75"/>` +
    (cracked ? `<path class="crack" d="M30 16l12 20-9 11 19 15-5 22"/>` : "") +
    `</svg>`
  );
};
const ICON_BAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>`;

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

// ---------- state ----------
const board = $("#board");
let file: SignedCharter | null = null;
/** A key made (or handed out by the demo) in this tab, so its owner can sign without opening a file. */
let myKey: { priv: string; pub: string; source: "made" | "demo" } | null = null;
let justSigned: string | null = null;
let notice = "";

function setFile(next: SignedCharter | null, note = "") {
  file = next;
  notice = note;
  void render();
}

// ---------- the board ----------
async function render() {
  if (!file) {
    board.innerHTML = `
      <div><span class="b-kick">Charter · signature board</span><h2 id="board-title" class="b-title">No charter open</h2></div>
      <p class="b-lede">Got a charter file from your group? Open it here to see who has signed and to add your signature. Starting a new collective? Create your key and draft the charter below.</p>
      <p class="actions">
        <button type="button" id="openbtn">Open charter file</button>
        <button type="button" class="ghost" id="pastebtn" aria-expanded="false" aria-controls="pastebox">Paste charter text</button>
        <button type="button" class="ghost" id="demo">Try a demo charter</button>
      </p>
      <input type="file" id="openfile" accept=".json,application/json" hidden />
      <div id="pastebox" hidden>
        <label for="pastein">Charter text</label>
        <textarea id="pastein" spellcheck="false" placeholder='{"charter":{…},"signatures":[…]}'></textarea>
        <p class="actions"><button type="button" id="pasteok">Open this charter</button></p>
      </div>
      ${notice ? `<div class="banner err" role="alert">${ICON_BAD}<div>${esc(notice)}</div></div>` : ""}`;
    wireEmpty();
    return;
  }

  const f = file;
  let res: Awaited<ReturnType<typeof verifyCharter>>;
  try {
    res = await verifyCharter(f);
  } catch (e) {
    setFile(null, `This charter cannot be used. ${human(e)}`);
    return;
  }
  if (f !== file) return; // a newer file arrived while this one was being checked
  const c = f.charter;
  const n = c.members.length;
  const done = n - res.unsigned.length;
  const ready = res.unsigned.length === 0;
  const sigKeys = new Set(f.signatures.map((s) => s.pubkey));
  const broken = res.unsigned.filter((i) => sigKeys.has(c.members[i]!.pubkey));
  const waiting = res.unsigned.filter((i) => !broken.includes(i));
  const mine = myKey ? c.members.findIndex((m) => m.pubkey === myKey!.pub) : -1;
  const canSignMine = mine >= 0 && res.unsigned.includes(mine);

  board.innerHTML = `
    <div class="b-head">
      <div><span class="b-kick">Charter · signature board</span><h2 id="board-title" class="b-title">${esc(c.title)}</h2></div>
      <span class="b-meta">${c.network === "main" ? "Mainnet" : "Testnet"} · fingerprint <code>${res.hash.slice(0, 8)}</code></span>
    </div>
    <p class="b-count${ready ? " ready" : ""}"><span class="n">${done}/${n}</span><span class="l">${ready ? "signed · ready to sell" : "signed"}</span></p>
    ${shareBar(c.members.map((m) => m.bps))}
    <ul class="blocks" aria-label="Signatures">
      ${c.members
        .map((m, i) => {
          const st = !res.unsigned.includes(i) ? "y" : broken.includes(i) ? "x" : "n";
          const line =
            st === "y" ? `<small class="st ok">Signed · key ${m.pubkey.slice(0, 8)}</small>`
            : st === "x" ? `<small class="st bad">Signature broken: the file changed after signing</small>`
            : `<small class="st wt">Waiting for ${esc(m.label)}</small>`;
          // signed = gold wax seal pressed on the sheet; waiting = an empty "sign here" ring; broken = a cracked seal
          const slot =
            st === "y" ? `<span class="seal-slot">${sealSvg(m.label)}</span>`
            : st === "x" ? `<span class="seal-slot broken">${sealSvg(m.label, true)}</span>`
            : `<span class="seal-slot empty" aria-hidden="true"><em>sign here</em></span>`;
          return `<li class="blk ${st}${justSigned === m.pubkey ? " just" : ""}">${slot}<b><i class="dot ${colour(i)}"></i>${esc(m.label)}</b><small>${esc(shortAddress(m.address))}</small>${line}<span class="share"><span class="sr-only">share </span>${pct(m.bps).replace("%", "")}<small>%</small></span></li>`;
        })
        .join("")}
    </ul>
    ${
      broken.length
        ? `<div class="banner err">${ICON_BAD}<div>This file was changed after ${esc(broken.map((i) => c.members[i]!.label).join(" and "))} signed.<span>An address, a share or another field no longer matches what they signed. Do not use this file; ask the group for the original.</span></div></div>`
        : ""
    }
    ${notice ? `<p class="b-note" role="status">${esc(notice)}</p>` : ""}
    ${
      ready
        ? `<div class="paylink">
            <h3>Create the pay link</h3>
            <p class="sub tight">The charter rides in the link's <code>#</code> part, which browsers never send to a server. Anyone with the link sees every member's address and share, so give it only to buyers.</p>
            <label for="price">Price in ZEC (optional; buyers can still change it)</label>
            <div class="inline"><input id="price" inputmode="decimal" placeholder="0.01" autocomplete="off" aria-describedby="price-err" /><button type="button" id="mklink">Create pay link</button></div>
            <p class="field-err" id="price-err" hidden></p>
            <div id="linkout"></div>
          </div>`
        : `<div class="signzone">
            <h3>Sign as a member</h3>
            <p class="sub tight">${waiting.length ? `Still waiting for ${esc(waiting.map((i) => c.members[i]!.label).join(", "))}.` : ""} Open your key file or paste your private key; the page finds your name from the key.</p>
            ${canSignMine ? `<p class="actions"><button type="button" id="signmine">Sign as ${esc(c.members[mine]!.label)} with ${myKey!.source === "demo" ? "the demo key" : "the key you just made"}</button></p>` : ""}
            <p class="actions"><button type="button" class="${canSignMine ? "ghost" : ""}" id="keyfilebtn">Open my key file</button></p>
            <input type="file" id="keyfile" accept=".txt,text/plain" hidden />
            <label for="priv">Or paste your private key (64 characters)</label>
            <div class="inline"><input id="priv" type="password" spellcheck="false" autocomplete="off" aria-describedby="priv-err" /><button type="button" class="ghost" id="signbtn">Sign</button></div>
            <p class="field-err" id="priv-err" hidden></p>
          </div>`
    }
    <p class="actions b-file">
      <button type="button" class="ghost" id="copyfile">Copy charter file</button>
      <button type="button" class="ghost" id="dlfile">Download file</button>
      <button type="button" class="ghost" id="closefile">Close</button>
    </p>
    <textarea class="b-raw" id="rawfile" readonly spellcheck="false" aria-label="Charter file" hidden></textarea>`;
  justSigned = null;
  wireLoaded(f, ready);
}

function wireEmpty() {
  const input = $<HTMLInputElement>("#openfile", board);
  $("#openbtn", board).addEventListener("click", () => input.click());
  input.addEventListener("change", () => void openFile(input.files?.[0]));
  const box = $("#pastebox", board);
  const toggle = $<HTMLButtonElement>("#pastebtn", board);
  toggle.addEventListener("click", () => {
    box.hidden = !box.hidden;
    toggle.setAttribute("aria-expanded", String(!box.hidden));
    if (!box.hidden) $<HTMLTextAreaElement>("#pastein", board).focus();
  });
  $("#pasteok", board).addEventListener("click", () => openText($<HTMLTextAreaElement>("#pastein", board).value));
  $("#demo", board).addEventListener("click", () => void demo());
}

function wireLoaded(f: SignedCharter, ready: boolean) {
  const text = JSON.stringify(f, null, 2);
  const raw = $<HTMLTextAreaElement>("#rawfile", board);
  $<HTMLButtonElement>("#copyfile", board).addEventListener("click", (e) => {
    raw.value = text;
    raw.hidden = false;
    void copy(e.currentTarget as HTMLButtonElement, text, raw);
  });
  $("#dlfile", board).addEventListener("click", () => download(`bonbagi-charter-${f.signatures.length}of${f.charter.members.length}.json`, text));
  $("#closefile", board).addEventListener("click", () => setFile(null));

  if (ready) {
    const price = $<HTMLInputElement>("#price", board);
    const make = () => {
      const err = $("#price-err", board);
      err.hidden = true;
      price.removeAttribute("aria-invalid");
      let zat: bigint | undefined;
      try {
        zat = price.value.trim() ? parseZec(price.value) : undefined;
        if (zat === 0n) throw new Error("a price must be more than 0");
      } catch (e) {
        err.textContent = `${human(e)} Use a number such as 0.01, or leave it empty.`;
        err.hidden = false;
        price.setAttribute("aria-invalid", "true");
        price.focus();
        return;
      }
      const link = payLink(new URL("./pay.html", location.href).href, f, zat);
      const out = $("#linkout", board);
      // the pay link prints as a ticket: a gold stub, the link on paper
      out.innerHTML = `
        <div class="ticket">
          <div class="t-stub" aria-hidden="true"><b>Pay</b><small>link</small><small>${zat === undefined ? "any price" : `${esc(price.value.trim())} ZEC`}</small></div>
          <div class="t-body">
            <label for="link">Pay link · give it only to buyers</label>
            <input id="link" readonly spellcheck="false" value="${esc(link)}" />
            <p class="actions"><button type="button" id="copylink">Copy link</button> <a class="button ghost" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open the pay page</a></p>
          </div>
        </div>`;
      const linkIn = $<HTMLInputElement>("#link", out);
      $<HTMLButtonElement>("#copylink", out).addEventListener("click", (e) => void copy(e.currentTarget as HTMLButtonElement, link, linkIn));
      // one gold button at a time: once a link exists, copying it is the next step
      const mk = $<HTMLButtonElement>("#mklink", board);
      mk.classList.add("ghost");
      mk.textContent = "Update link";
    };
    $("#mklink", board).addEventListener("click", make);
    price.addEventListener("keydown", (e) => e.key === "Enter" && make());
    return;
  }

  const fail = (msg: string) => {
    const err = $("#priv-err", board);
    err.textContent = msg;
    err.hidden = false;
    $("#priv", board).setAttribute("aria-invalid", "true");
  };
  const signWith = async (privRaw: string) => {
    const priv = privRaw.trim().toLowerCase();
    if (!HEX64.test(priv)) return fail("A private key is 64 characters, using only 0–9 and a–f. Open the key file this page gave you, or paste its contents.");
    try {
      const signed = await addSignature(f, priv);
      const pub = await publicKeyOf(priv);
      const who = f.charter.members.find((m) => m.pubkey === pub)!;
      justSigned = pub;
      const left = f.charter.members.length - signed.signatures.length;
      setFile(signed, left > 0 ? `Signed as ${who.label}. Send this file to the next member: copy or download it below.` : `Signed as ${who.label}. Every member has signed.`);
    } catch (e) {
      fail(human(e));
    }
  };
  $("#signmine", board)?.addEventListener("click", () => myKey && void signWith(myKey.priv));
  $("#signbtn", board).addEventListener("click", () => {
    const input = $<HTMLInputElement>("#priv", board);
    void signWith(input.value);
    input.value = "";
  });
  $<HTMLInputElement>("#priv", board).addEventListener("keydown", (e) => e.key === "Enter" && $("#signbtn", board).click());
  const keyfile = $<HTMLInputElement>("#keyfile", board);
  $("#keyfilebtn", board).addEventListener("click", () => keyfile.click());
  keyfile.addEventListener("change", async () => {
    const k = keyfile.files?.[0];
    if (!k) return;
    if (k.size > 2_000) return fail("That file is too large to be a BonBagi key file.");
    const hex = /\b[0-9a-f]{64}\b/i.exec(await k.text())?.[0];
    if (!hex) return fail("No private key found in that file. Pick the key file this page downloaded for you.");
    await signWith(hex);
  });
}

async function openFile(f: File | undefined) {
  if (!f) return;
  if (f.size > 100_000) return setFile(null, "That file is too large to be a charter.");
  openText(await f.text());
}

function openText(text: string) {
  try {
    setFile(parseCharterFile(text));
  } catch (e) {
    setFile(null, `Could not read the charter. ${human(e)}`);
  }
  board.focus();
}

// Demo: two throwaway keys sign a testnet charter with made-up addresses (wallets reject them,
// so it cannot move funds). Mentor A has signed; the second key is handed to this tab so a
// visitor can sign as Mentor B and see the pay link appear.
async function demo() {
  const fakeAddr = () => {
    const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const tail = [...crypto.getRandomValues(new Uint8Array(94))].map((b) => alphabet[b % 32]).join("");
    return `utest1${tail}`.slice(0, 106);
  };
  try {
    await openDemo(fakeAddr);
  } catch (e) {
    setFile(null, `The demo could not start. ${human(e)}`);
  }
}

async function openDemo(fakeAddr: () => string) {
  const keys = [newPrivateKey(), newPrivateKey()];
  const pubs = await Promise.all(keys.map(publicKeyOf));
  const charter: Charter = {
    bonbagi: 1,
    network: "test",
    title: "DEMO · Intro to Zcash — 2 mentors",
    minShareZat: "10000",
    members: [
      { label: "Mentor A", address: fakeAddr(), bps: 6000, pubkey: pubs[0]! },
      { label: "Mentor B", address: fakeAddr(), bps: 4000, pubkey: pubs[1]! },
    ],
  };
  myKey = { priv: keys[1]!, pub: pubs[1]!, source: "demo" };
  setFile({ charter, signatures: [await signCharter(charter, keys[0]!)] }, "Demo charter with made-up testnet addresses. Mentor A has signed; sign as Mentor B to finish it.");
}

// ---------- 1 · key ----------
$("#genkey").addEventListener("click", async () => {
  const priv = newPrivateKey();
  const pub = await publicKeyOf(priv);
  myKey = { priv, pub, source: "made" };
  const out = $("#keyout");
  out.innerHTML = `
    <label for="pubout">Public key · send this to whoever drafts the charter</label>
    <div class="inline"><input id="pubout" readonly spellcheck="false" value="${pub}" /><button type="button" class="ghost" id="copypub">Copy</button></div>
    <label for="secret">Private key · only for signing</label>
    <div class="inline"><input id="secret" class="sealed-in" readonly spellcheck="false" value="${"•".repeat(24)}" aria-describedby="secret-note" /><button type="button" class="ghost" id="reveal" aria-pressed="false">Show</button></div>
    <p class="actions"><button type="button" id="dlkey">Download key file</button></p>
    <p class="sub tight" id="secret-note">Keep the file. Anyone who has it can sign as you, and without it you cannot sign this charter again. This page does not store it. "Replace my key" makes a new key; a charter drafted with this public key will not accept the new one.</p>`;
  const gen = $<HTMLButtonElement>("#genkey");
  gen.textContent = "Replace my key";
  gen.classList.add("ghost");
  const pubIn = $<HTMLInputElement>("#pubout", out);
  $<HTMLButtonElement>("#copypub", out).addEventListener("click", (e) => void copy(e.currentTarget as HTMLButtonElement, pub, pubIn));
  const secret = $<HTMLInputElement>("#secret", out);
  const reveal = $<HTMLButtonElement>("#reveal", out);
  reveal.addEventListener("click", () => {
    const show = reveal.getAttribute("aria-pressed") !== "true";
    secret.value = show ? priv : "•".repeat(24);
    reveal.textContent = show ? "Hide" : "Show";
    reveal.setAttribute("aria-pressed", String(show));
  });
  $("#dlkey", out).addEventListener("click", () => download(`bonbagi-key-${pub.slice(0, 8)}.txt`, `${priv}\n`, "text/plain"));
  fillMyKeyButtons();
  if (file) void render();
});

// ---------- 2 · draft ----------
const members = $("#members");
let seq = 0;

function addMemberRow() {
  const id = `m${seq++}`;
  const row = document.createElement("fieldset");
  row.className = "member";
  row.innerHTML = `
    <legend>Member</legend>
    <div class="row m-row">
      <div><label for="${id}-label">Name or role</label><input id="${id}-label" data-f="label" maxlength="40" aria-describedby="${id}-label-err" /><p class="field-err" id="${id}-label-err" hidden></p></div>
      <div><label for="${id}-pct">Share %</label><input id="${id}-pct" data-f="pct" inputmode="decimal" placeholder="50" aria-describedby="${id}-pct-err" /><p class="field-err" id="${id}-pct-err" hidden></p></div>
    </div>
    <label for="${id}-address">Shielded address</label>
    <input id="${id}-address" data-f="address" placeholder="u1… or zs1…" spellcheck="false" aria-describedby="${id}-address-err" />
    <p class="field-err" id="${id}-address-err" hidden></p>
    <label for="${id}-pubkey">Public key</label>
    <div class="inline"><input id="${id}-pubkey" data-f="pubkey" placeholder="64 characters, from their key" spellcheck="false" aria-describedby="${id}-pubkey-err" /><button type="button" class="ghost mine" hidden>Use my key</button></div>
    <p class="field-err" id="${id}-pubkey-err" hidden></p>
    <p class="m-remove"><button type="button" class="ghost small" data-remove>Remove member</button></p>`;
  members.append(row);
  row.querySelector("[data-remove]")!.addEventListener("click", () => {
    row.remove();
    relabel();
  });
  row.querySelector(".mine")!.addEventListener("click", () => {
    if (!myKey) return;
    $<HTMLInputElement>('[data-f="pubkey"]', row).value = myKey.pub;
    updateTotal();
  });
  relabel();
  fillMyKeyButtons();
}

/** Legends follow the order; the last two members cannot be removed (a collective needs two). */
function relabel() {
  const rows = [...members.querySelectorAll<HTMLFieldSetElement>(".member")];
  rows.forEach((r, i) => {
    r.querySelector("legend")!.textContent = `Member ${i + 1}`;
    r.querySelector<HTMLElement>(".m-remove")!.hidden = rows.length <= 2;
  });
  updateTotal();
}

function fillMyKeyButtons() {
  members.querySelectorAll<HTMLButtonElement>(".mine").forEach((b) => (b.hidden = !myKey || myKey.source !== "made"));
}

const rowValue = (row: Element, f: string) => row.querySelector<HTMLInputElement>(`[data-f="${f}"]`)!.value.trim();

function updateTotal() {
  const out = $("#total");
  let sum = 0;
  let bad = false;
  members.querySelectorAll(".member").forEach((r) => {
    const v = rowValue(r, "pct");
    if (!v) return;
    try {
      sum += percentToBps(v);
    } catch {
      bad = true;
    }
  });
  const ok = !bad && sum === TOTAL_BPS;
  out.className = `pill ${ok ? "ok" : sum > TOTAL_BPS || bad ? "err" : ""}`;
  out.textContent = bad ? "Shares: check the numbers" : ok ? "Shares: 100% ✓" : sum > TOTAL_BPS ? `Shares: ${pct(sum)} · ${pct(sum - TOTAL_BPS)} too much` : `Shares: ${pct(sum)} · ${pct(TOTAL_BPS - sum)} left`;
}

function fieldError(input: HTMLInputElement, msg: string) {
  input.setAttribute("aria-invalid", "true");
  const err = document.getElementById(`${input.id}-err`);
  if (err) {
    err.textContent = msg;
    err.hidden = false;
  }
}

function clearErrors() {
  document.querySelectorAll<HTMLElement>("#draft .field-err").forEach((e) => (e.hidden = true));
  document.querySelectorAll("#draft [aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
}

$<HTMLFormElement>("#draft").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  const form = e.currentTarget as HTMLFormElement;
  const network = $<HTMLSelectElement>("#network").value as Charter["network"];
  const title = $<HTMLInputElement>("#title");
  const minshare = $<HTMLInputElement>("#minshare");
  if (!title.value.trim()) fieldError(title, "Name what the collective sells, e.g. a class or a product.");
  let minZat = 0n;
  try {
    minZat = parseZec(minshare.value);
    if (minZat === 0n) throw new Error();
  } catch {
    fieldError(minshare, "Use a ZEC amount above 0, such as 0.0001.");
  }

  const seenAddr = new Map<string, number>();
  const seenKey = new Map<string, number>();
  let sum = 0;
  const list = [...members.querySelectorAll(".member")].map((row, i) => {
    const input = (f: string) => row.querySelector<HTMLInputElement>(`[data-f="${f}"]`)!;
    const label = rowValue(row, "label");
    const address = rowValue(row, "address");
    const pubkey = rowValue(row, "pubkey").toLowerCase();
    let bps = 0;
    if (!label) fieldError(input("label"), "Add a name or role.");
    try {
      bps = percentToBps(rowValue(row, "pct"));
      sum += bps;
    } catch {
      fieldError(input("pct"), "0–100, e.g. 60");
    }
    if (!address) fieldError(input("address"), "Paste this member's shielded address.");
    else {
      try {
        const info = assertShielded(address);
        if (info.network !== network) fieldError(input("address"), `This is a ${info.network}net address; the charter is set to ${network}net.`);
        else if (seenAddr.has(address)) fieldError(input("address"), `Member ${seenAddr.get(address)! + 1} already uses this address. Each member needs their own.`);
      } catch (err) {
        fieldError(input("address"), human(err));
      }
      seenAddr.set(address, i);
    }
    if (!HEX64.test(pubkey)) fieldError(input("pubkey"), "A public key is 64 characters (0–9, a–f). Ask this member to create a key above and send you the public part.");
    else if (seenKey.has(pubkey)) fieldError(input("pubkey"), `Member ${seenKey.get(pubkey)! + 1} already uses this key. Each member signs with their own.`);
    seenKey.set(pubkey, i);
    return { label, address, bps, pubkey };
  });

  const firstBad = form.querySelector<HTMLInputElement>("[aria-invalid]");
  const err = $("#draft-err");
  if (!firstBad && sum !== TOTAL_BPS) {
    err.textContent = `The shares add up to ${pct(sum)}. They must add up to exactly 100%.`;
    err.hidden = false;
    return;
  }
  if (firstBad) {
    err.textContent = "Some fields need a fix. They are marked above.";
    err.hidden = false;
    firstBad.focus();
    return;
  }
  const charter: Charter = { bonbagi: 1, network, title: title.value.trim(), minShareZat: minZat.toString(), members: list };
  try {
    await verifyCharter({ charter, signatures: [] }); // anything the field checks missed
  } catch (e2) {
    err.textContent = human(e2);
    err.hidden = false;
    return;
  }
  setFile({ charter, signatures: [] }, `Charter created (fingerprint ${(await charterHash(charter)).slice(0, 8)}). Every member signs this same file: sign here, or copy or download it for the others.`);
  board.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  board.focus({ preventScroll: true });
});

$("#draft").addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.f === "pct") updateTotal();
  if (t.hasAttribute("aria-invalid")) {
    t.removeAttribute("aria-invalid");
    const err = document.getElementById(`${t.id}-err`);
    if (err) err.hidden = true;
  }
});
$("#addmember").addEventListener("click", () => {
  addMemberRow();
  members.querySelector<HTMLInputElement>(".member:last-of-type [data-f='label']")?.focus();
});

// Demo collective (Dex 23 Oct): two members.
addMemberRow();
addMemberRow();
void render();
