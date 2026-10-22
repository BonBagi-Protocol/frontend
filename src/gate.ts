// Day-1 gate tool: two or three addresses + amounts -> one ZIP-321 request (text + QR).
// Runs entirely client-side; inputs are never stored or transmitted. Addresses can be
// prefilled from the link fragment (#to=u1...,u1...), which browsers never send to a server.

import "./fx.ts";
import qrcode from "qrcode-generator";
import { formatZec, parseZec } from "./core/zatoshi.ts";
import { buildUri, type Payment } from "./core/zip321.ts";

// Demo collective (Dex 23 Oct): two members, 60/40, 0.001 ZEC in total for the gate test.
const DEFAULTS = ["0.0006", "0.0004", "0.0002"];
const MAX = 3;
const rows = document.querySelector<HTMLDivElement>("#rows")!;
const out = document.querySelector<HTMLDivElement>("#out")!;
const form = document.querySelector<HTMLFormElement>("#f")!;
const note = document.querySelector<HTMLInputElement>("#note")!;
const addBtn = document.querySelector<HTMLButtonElement>("#addrow")!;
const prefill = new URLSearchParams(location.hash.slice(1)).get("to")?.split(",").map((a) => a.trim()).filter(Boolean).slice(0, MAX) ?? [];
let count = Math.max(2, prefill.length);

function addRow(i: number) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <div><label for="a${i}">Recipient ${i + 1} — shielded address (u1… or zs1…)</label>
      <input id="a${i}" spellcheck="false" required /></div>
    <div><label for="z${i}">Amount (ZEC)</label>
      <input id="z${i}" inputmode="decimal" value="${DEFAULTS[i]}" required /></div>`;
  rows.append(row);
  row.querySelector<HTMLInputElement>(`#a${i}`)!.value = prefill[i] ?? "";
}
for (let i = 0; i < count; i++) addRow(i);
addBtn.hidden = count >= MAX;
addBtn.addEventListener("click", () => {
  addRow(count++);
  addBtn.hidden = count >= MAX;
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    const payments: Payment[] = Array.from({ length: count }, (_, i) => ({
      address: document.querySelector<HTMLInputElement>(`#a${i}`)!.value.trim(),
      amountZat: parseZec(document.querySelector<HTMLInputElement>(`#z${i}`)!.value),
      memo: `${note.value.trim() || "bonbagi gate test"} ${i + 1}/${count}`,
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
