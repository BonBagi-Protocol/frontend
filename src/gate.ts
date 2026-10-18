// Day-1 gate tool: three addresses + amounts → one ZIP-321 request (text + QR).
// Runs entirely client-side; inputs are never stored or transmitted.

import "./fx.ts";
import qrcode from "qrcode-generator";
import { formatZec, parseZec } from "./core/zatoshi.ts";
import { buildUri, type Payment } from "./core/zip321.ts";

const DEFAULTS = ["0.0005", "0.0003", "0.0002"];
const rows = document.querySelector<HTMLDivElement>("#rows")!;
const out = document.querySelector<HTMLDivElement>("#out")!;
const form = document.querySelector<HTMLFormElement>("#f")!;
const note = document.querySelector<HTMLInputElement>("#note")!;

rows.innerHTML = DEFAULTS.map(
  (amt, i) => `
  <div class="row">
    <div><label for="a${i}">Recipient ${i + 1} — shielded address (u1… or zs1…)</label>
      <input id="a${i}" spellcheck="false" required /></div>
    <div><label for="z${i}">Amount (ZEC)</label>
      <input id="z${i}" inputmode="decimal" value="${amt}" required /></div>
  </div>`,
).join("");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    const payments: Payment[] = [0, 1, 2].map((i) => ({
      address: document.querySelector<HTMLInputElement>(`#a${i}`)!.value.trim(),
      amountZat: parseZec(document.querySelector<HTMLInputElement>(`#z${i}`)!.value),
      memo: `${note.value.trim() || "bonbagi gate test"} ${i + 1}/3`,
    }));
    const uri = buildUri(payments);
    const total = payments.reduce((a, p) => a + p.amountZat, 0n);
    const qr = qrcode(0, "M");
    qr.addData(uri, "Byte");
    qr.make();
    out.innerHTML = `
      <div class="card">
        <p class="ok">Request built — ${payments.length} shielded outputs, total ${formatZec(total)} ZEC (+ network fee).</p>
        <table>
          <tr><th>#</th><th>Address</th><th class="num">ZEC</th></tr>
          ${payments.map((p, i) => `<tr><td>${i + 1}</td><td class="addr">${esc(p.address)}</td><td class="num">${formatZec(p.amountZat)}</td></tr>`).join("")}
        </table>
        <label for="uri">Payment request (paste into the wallet's send / pay-URI field)</label>
        <textarea id="uri" readonly>${esc(uri)}</textarea>
        <p><button type="button" id="copy">Copy request</button> <button type="button" class="ghost" id="clear">Clear</button></p>
        <div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
      </div>`;
    document.querySelector("#copy")!.addEventListener("click", async (ev) => {
      await navigator.clipboard.writeText(uri);
      (ev.target as HTMLButtonElement).textContent = "Copied";
    });
    document.querySelector("#clear")!.addEventListener("click", () => {
      out.innerHTML = "";
      form.reset();
    });
  } catch (err) {
    out.innerHTML = `<div class="card"><p class="err">${esc(err instanceof Error ? err.message : String(err))}</p></div>`;
  }
});
