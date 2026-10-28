// Raw request tool: two or three addresses + amounts -> one ZIP-321 request, rebuilt on every
// keystroke and shown parameter by parameter (one colour per recipient), plus its QR.
// Runs entirely client-side; inputs are never stored or transmitted. Addresses can be
// prefilled from the link fragment (#to=u1...,u1...), which browsers never send to a server.

import "./fx.ts";
import qrcode from "qrcode-generator";
import { assertShielded } from "@bonbagi/core";
import { estimateFeeZat } from "@bonbagi/core";
import { formatZec, parseZec } from "@bonbagi/core";
import { buildUri, type Payment } from "@bonbagi/core";

// Demo collective (Dex 23 Oct): two members, 60/40, 0.001 ZEC in total for the gate test.
const DEFAULTS = ["0.0006", "0.0004", "0.0002"];
const MAX = 3;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sentence = (e: unknown) => {
  const s = e instanceof Error ? e.message : String(e);
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? "" : "."}`;
};

const rows = $<HTMLDivElement>("#rows");
const note = $<HTMLInputElement>("#note");
const addBtn = $<HTMLButtonElement>("#addrow");
const uriBox = $<HTMLPreElement>("#uri");
const sum = $<HTMLParagraphElement>("#sum");
const qrBox = $<HTMLDivElement>("#qr");
const copyBtn = $<HTMLButtonElement>("#copy");
const openA = $<HTMLAnchorElement>("#open");
const printer = document.querySelector<HTMLElement>("#gprinter");
const prefill = new URLSearchParams(location.hash.slice(1)).get("to")?.split(",").map((a) => a.trim()).filter(Boolean).slice(0, MAX) ?? [];
/** Fields the person has left at least once: their errors show from then on, not while typing the first time. */
const touched = new Set<string>();
let current = "";

function addRow(i: number) {
  const row = document.createElement("fieldset");
  row.className = "rcp";
  row.innerHTML = `
    <legend><i class="dot c${i}"></i>Recipient ${i + 1}</legend>
    <div class="rcp-grid">
      <div><label for="a${i}">Shielded address</label><input id="a${i}" spellcheck="false" placeholder="u1… or zs1…" aria-describedby="a${i}-err" /><p class="field-err" id="a${i}-err" hidden></p></div>
      <div><label for="z${i}">ZEC</label><input id="z${i}" inputmode="decimal" value="${DEFAULTS[i]}" aria-describedby="z${i}-err" /><p class="field-err" id="z${i}-err" hidden></p></div>
    </div>
    ${i === MAX - 1 ? `<p class="m-remove"><button type="button" class="ghost small" id="rm">Remove recipient 3</button></p>` : ""}`;
  rows.append(row);
  $<HTMLInputElement>(`#a${i}`).value = prefill[i] ?? "";
  row.querySelector("#rm")?.addEventListener("click", () => {
    row.remove();
    touched.delete("a2");
    touched.delete("z2");
    addBtn.hidden = false;
    update();
    addBtn.focus();
  });
}
const count = () => rows.querySelectorAll(".rcp").length;
for (let i = 0; i < Math.max(2, prefill.length); i++) addRow(i);
addBtn.hidden = count() >= MAX;
addBtn.addEventListener("click", () => {
  addRow(count());
  addBtn.hidden = count() >= MAX;
  $<HTMLInputElement>(`#a${count() - 1}`).focus();
  update();
});

function showError(id: string, msg: string | null) {
  const input = $<HTMLInputElement>(`#${id}`);
  const err = $<HTMLElement>(`#${id}-err`);
  const show = msg !== null && touched.has(id);
  err.hidden = !show;
  if (show) err.textContent = msg;
  if (show) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

/** One coloured line per parameter: address / amount / memo for recipient 0, then .1, .2. */
function colourUri(uri: string): string {
  const [head, query = ""] = uri.split("?");
  const lines = query.split("&").map((p, n) => {
    const i = Number(/^[a-z]+\.(\d+)=/.exec(p)?.[1] ?? 0);
    return `${n ? '<span class="kq">&amp;</span>' : ""}<span class="k${i}">${esc(p)}</span>`;
  });
  return `<span class="kq">${esc(head!)}?</span>${lines.join("\n")}`;
}

/** A QR of exactly `text`, or null when it cannot hold it (medium error correction first, then low). */
function qrFor(text: string): ReturnType<typeof qrcode> | null {
  if (/[^\x20-\x7e]/.test(text)) return null;
  for (const level of ["M", "L"] as const) {
    try {
      const qr = qrcode(0, level);
      qr.addData(text, "Byte");
      qr.make();
      return qr;
    } catch {
      /* too long at this level */
    }
  }
  return null;
}

function update() {
  const n = count();
  /** Problems in fields the person has left are red; the rest just say what is still missing. */
  const problems: { text: string; red: boolean }[] = [];
  const payments: Payment[] = [];
  let network: string | undefined;
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const a = $<HTMLInputElement>(`#a${i}`).value.trim();
    let aErr: string | null = null;
    if (!a) aErr = "Paste a shielded address (u1… or zs1…).";
    else {
      try {
        const info = assertShielded(a);
        network ??= info.network;
        if (info.network !== network) aErr = `This is a ${info.network}net address; recipient 1 is on ${network}net.`;
        else if (seen.has(a)) aErr = `Recipient ${seen.get(a)! + 1} already uses this address.`;
      } catch (e) {
        aErr = sentence(e);
      }
      seen.set(a, i);
    }
    let zat = 0n;
    let zErr: string | null = null;
    try {
      zat = parseZec($<HTMLInputElement>(`#z${i}`).value);
      if (zat === 0n) zErr = "Use an amount above 0.";
    } catch {
      zErr = "Use a ZEC amount such as 0.0005.";
    }
    showError(`a${i}`, aErr);
    showError(`z${i}`, zErr);
    const lower = (s: string) => `${s.charAt(0).toLowerCase()}${s.slice(1)}`;
    if (aErr) problems.push(touched.has(`a${i}`) ? { text: `Recipient ${i + 1}: ${lower(aErr)}`, red: true } : { text: `Recipient ${i + 1}: waiting for an address`, red: false });
    if (zErr) problems.push(touched.has(`z${i}`) ? { text: `Recipient ${i + 1} amount: ${lower(zErr)}`, red: true } : { text: `Recipient ${i + 1}: waiting for an amount`, red: false });
    payments.push({ address: a, amountZat: zat, memo: `${note.value.trim() || "bonbagi gate test"} ${i + 1}/${n}` });
  }

  const before = current;
  current = "";
  if (!problems.length) {
    try {
      current = buildUri(payments);
    } catch (e) {
      problems.push({ text: sentence(e), red: true });
    }
  }
  // the printer's LED is lit while the bon holds a complete request; a new request inks in fresh
  printer?.classList.toggle("ok", Boolean(current));
  if (current && current !== before) {
    uriBox.classList.remove("fresh");
    void uriBox.offsetWidth;
    uriBox.classList.add("fresh");
  }
  if (!current) {
    uriBox.classList.add("waiting");
    uriBox.innerHTML = `<span class="kq">zcash:?</span>…\n${problems.map((p) => `<span class="${p.red ? "miss" : "todo"}">${esc(p.text)}</span>`).join("\n")}`;
    sum.textContent = `${n} recipients · the request appears once every address and amount is valid.`;
    qrBox.hidden = true;
    copyBtn.disabled = true;
    openA.removeAttribute("href");
    openA.setAttribute("aria-disabled", "true");
    return;
  }
  const total = payments.reduce((t, p) => t + p.amountZat, 0n);
  uriBox.classList.remove("waiting");
  uriBox.innerHTML = colourUri(current);
  sum.textContent = `Total ${formatZec(total)} ZEC · ${n} shielded outputs in one transaction · + network fee ≈ ${formatZec(estimateFeeZat(n))} ZEC, added by your wallet.`;
  // The QR must hold exactly the request shown above. Too long for one code (very long addresses),
  // or not plain ASCII (the QR library would mangle it): no QR, and the summary says so.
  const qr = qrFor(current);
  if (qr) {
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    qrBox.hidden = false;
  } else {
    qrBox.replaceChildren();
    qrBox.hidden = true;
    sum.textContent += ` This request (${current.length} characters) is too long for one QR code: use Copy request or Open in wallet.`;
  }
  copyBtn.disabled = false;
  openA.href = current;
  openA.removeAttribute("aria-disabled");
}

let timer = 0;
$("#f").addEventListener("input", () => {
  clearTimeout(timer);
  timer = window.setTimeout(update, 120);
});
$("#f").addEventListener("focusout", (e) => {
  const id = (e.target as HTMLElement).id;
  if (/^[az]\d$/.test(id)) {
    touched.add(id);
    update();
  }
});
$("#f").addEventListener("submit", (e) => e.preventDefault());
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(current);
    copyBtn.textContent = "Copied";
  } catch {
    getSelection()?.selectAllChildren(uriBox);
    copyBtn.textContent = "Press Ctrl+C";
  }
  setTimeout(() => (copyBtn.textContent = "Copy request"), 1800);
});
update();
