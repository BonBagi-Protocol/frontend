// Charter page: create a key, draft a charter, sign it, check it.
// Client-side only; nothing is stored or transmitted.

import { addSignature, charterHash, newPrivateKey, parseCharterFile, publicKeyOf, verifyCharter, type Charter, type SignedCharter } from "./core/charter.ts";
import { percentToBps } from "./core/split.ts";
import { formatZec, parseZec } from "./core/zatoshi.ts";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const errBox = (e: unknown) => `<p class="err">${esc(e instanceof Error ? e.message : String(e))}</p>`;
const pretty = (f: SignedCharter) => JSON.stringify(f, null, 2);

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function fileOutput(target: HTMLElement, file: SignedCharter, note: string) {
  const text = pretty(file);
  target.innerHTML = `${note}
    <textarea readonly spellcheck="false">${esc(text)}</textarea>
    <p><button type="button" class="ghost" data-copy>Copy</button> <button type="button" class="ghost" data-dl>Download</button></p>`;
  target.querySelector("[data-copy]")!.addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(text);
    (e.target as HTMLButtonElement).textContent = "Copied";
  });
  target.querySelector("[data-dl]")!.addEventListener("click", () => download("bonbagi-charter.json", text));
}

// 1 · key
$("#genkey").addEventListener("click", async () => {
  const priv = newPrivateKey();
  const pub = await publicKeyOf(priv);
  $("#keyout").innerHTML = `
    <label>Public key — share this with the group</label>
    <textarea readonly spellcheck="false" style="min-height:48px">${pub}</textarea>
    <label>Private key — keep it secret, you need it to sign</label>
    <textarea readonly spellcheck="false" style="min-height:48px">${priv}</textarea>
    <p><button type="button" class="ghost" id="dlkey">Download private key</button></p>
    <p class="sub">Lose it and you cannot sign this charter again; anyone who has it can sign as you. It is not stored in this page.</p>`;
  $("#dlkey").addEventListener("click", () => download("bonbagi-private-key.txt", `${priv}\n`));
});

// 2 · draft
let memberCount = 0;
function addMemberRow() {
  const i = memberCount++;
  const row = document.createElement("div");
  row.className = "member";
  row.innerHTML = `
    <label>Member ${i + 1}</label>
    <div class="row">
      <input data-f="label" placeholder="Name or role" maxlength="40" />
      <input data-f="pct" placeholder="Share %" inputmode="decimal" />
    </div>
    <input data-f="address" placeholder="Shielded address (u1… or zs1…)" spellcheck="false" style="margin-top:8px" />
    <input data-f="pubkey" placeholder="Public key (64 hex)" spellcheck="false" style="margin-top:8px" />`;
  $("#members").append(row);
}
for (let i = 0; i < 3; i++) addMemberRow();
$("#addmember").addEventListener("click", addMemberRow);

$("#draft").addEventListener("click", async () => {
  const out = $("#draftout");
  try {
    const members = [...document.querySelectorAll<HTMLDivElement>("#members .member")]
      .map((row) => {
        const v = (f: string) => row.querySelector<HTMLInputElement>(`[data-f="${f}"]`)!.value.trim();
        return { label: v("label"), pct: v("pct"), address: v("address"), pubkey: v("pubkey").toLowerCase() };
      })
      .filter((m) => m.label || m.pct || m.address || m.pubkey)
      .map((m) => ({ label: m.label, address: m.address, bps: percentToBps(m.pct), pubkey: m.pubkey }));
    const charter: Charter = {
      bonbagi: 1,
      network: $<HTMLSelectElement>("#network").value as Charter["network"],
      title: $<HTMLInputElement>("#title").value.trim(),
      minShareZat: parseZec($<HTMLInputElement>("#minshare").value).toString(),
      members,
    };
    const file: SignedCharter = { charter, signatures: [] };
    await verifyCharter(file); // structural validation (throws with a readable reason)
    fileOutput(out, file, `<p class="ok">Charter ready — fingerprint ${(await charterHash(charter)).slice(0, 16)}. Send this file to every member to sign.</p>`);
    $<HTMLTextAreaElement>("#signin").value = pretty(file);
  } catch (e) {
    out.innerHTML = errBox(e);
  }
});

// 3 · sign
$("#sign").addEventListener("click", async () => {
  const out = $("#signout");
  const privInput = $<HTMLInputElement>("#priv");
  try {
    const priv = privInput.value.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(priv)) throw new Error("private key must be 64 hex characters");
    const signed = await addSignature(parseCharterFile($<HTMLTextAreaElement>("#signin").value), priv);
    privInput.value = "";
    const { unsigned } = await verifyCharter(signed);
    const left = unsigned.map((i) => signed.charter.members[i]!.label);
    fileOutput(out, signed, `<p class="ok">Signed. ${left.length ? `Still waiting for: ${esc(left.join(", "))}.` : "Every member has signed — this charter is ready for the pay page."}</p>`);
    $<HTMLTextAreaElement>("#signin").value = pretty(signed);
    $<HTMLTextAreaElement>("#verin").value = pretty(signed);
  } catch (e) {
    out.innerHTML = errBox(e);
  }
});

// 4 · check
$("#verify").addEventListener("click", async () => {
  const out = $("#verout");
  try {
    const file = parseCharterFile($<HTMLTextAreaElement>("#verin").value);
    const { hash, unsigned } = await verifyCharter(file);
    const c = file.charter;
    out.innerHTML = `
      <p class="${unsigned.length ? "err" : "ok"}">${unsigned.length ? `Not ready: ${unsigned.length} of ${c.members.length} signatures missing or invalid.` : "All signatures valid."}</p>
      <p class="sub">${esc(c.title)} · ${c.network}net · min ${formatZec(BigInt(c.minShareZat))} ZEC per member · fingerprint ${hash.slice(0, 16)}</p>
      <table>
        <tr><th>Member</th><th class="num">Share</th><th>Signature</th></tr>
        ${c.members.map((m, i) => `<tr><td>${esc(m.label)}<div class="addr">${esc(m.address)}</div></td><td class="num">${(m.bps / 100).toFixed(2)}%</td><td>${unsigned.includes(i) ? '<span class="err">missing / invalid</span>' : '<span class="ok">valid</span>'}</td></tr>`).join("")}
      </table>`;
  } catch (e) {
    out.innerHTML = errBox(e);
  }
});
