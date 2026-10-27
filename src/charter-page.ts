// Charter page: create a key, draft a charter, sign it, check it.
// Client-side only; nothing is stored or transmitted.

import "./fx.ts";
import { addSignature, charterHash, newPrivateKey, parseCharterFile, publicKeyOf, verifyCharter, type Charter, type SignedCharter } from "@bonbagi/core";
import { payLink } from "@bonbagi/core";
import { percentToBps } from "@bonbagi/core";
import { formatZec, parseZec } from "@bonbagi/core";

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

/** Once every member has signed: a link to the pay page with the charter in the URL fragment. */
function payLinkBlock(target: HTMLElement, file: SignedCharter) {
  const box = document.createElement("div");
  box.className = "note";
  box.innerHTML = `
    <strong>Ready to sell.</strong> Create the pay link buyers will open. The charter rides in the link's <code>#</code> part, which is never sent to the server.
    <label for="${target.id}-price">Price (ZEC, optional — buyers can still change it)</label>
    <input id="${target.id}-price" inputmode="decimal" placeholder="0.01" autocomplete="off" />
    <p class="actions"><button type="button" data-mk>Create pay link</button></p>
    <div data-link></div>`;
  target.append(box);
  box.querySelector("[data-mk]")!.addEventListener("click", () => {
    const out = box.querySelector<HTMLDivElement>("[data-link]")!;
    try {
      const p = box.querySelector<HTMLInputElement>("input")!.value.trim();
      const link = payLink(new URL("./pay.html", location.href).href, file, p ? parseZec(p) : undefined);
      out.innerHTML = `
        <textarea readonly spellcheck="false">${esc(link)}</textarea>
        <p class="actions"><button type="button" class="ghost" data-copy>Copy link</button> <a class="button" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open pay page</a></p>
        <p class="sub tight">Anyone with this link sees every member's address and share. Share it only with buyers, and use fresh addresses for each product or period.</p>`;
      out.querySelector("[data-copy]")!.addEventListener("click", async (e) => {
        await navigator.clipboard.writeText(link);
        (e.target as HTMLButtonElement).textContent = "Copied";
      });
    } catch (e) {
      out.innerHTML = errBox(e);
    }
  });
}

// 1 · key
$("#genkey").addEventListener("click", async () => {
  const priv = newPrivateKey();
  const pub = await publicKeyOf(priv);
  $("#keyout").innerHTML = `
    <label>Public key — share this with the group</label>
    <textarea class="key" readonly spellcheck="false">${pub}</textarea>
    <label>Private key — keep it secret, you need it to sign</label>
    <textarea class="key" readonly spellcheck="false">${priv}</textarea>
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
    <input data-f="address" placeholder="Shielded address (u1… or zs1…)" spellcheck="false" />
    <input data-f="pubkey" placeholder="Public key (64 hex)" spellcheck="false" />`;
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
    fileOutput(out, file, `<p class="ok">Charter ready — fingerprint ${(await charterHash(charter)).slice(0, 32)}. Send this file to every member to sign.</p>`);
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
    if (!left.length) payLinkBlock(out, signed);
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
      <p class="sub">${esc(c.title)} · ${c.network}net · min ${formatZec(BigInt(c.minShareZat))} ZEC per member · fingerprint ${hash.slice(0, 32)}</p>
      <table>
        <tr><th>Member</th><th class="num">Share</th><th>Signature</th></tr>
        ${c.members.map((m, i) => `<tr><td>${esc(m.label)}<div class="addr">${esc(m.address)}</div></td><td class="num">${(m.bps / 100).toFixed(2)}%</td><td>${unsigned.includes(i) ? '<span class="err">missing / invalid</span>' : '<span class="ok">valid</span>'}</td></tr>`).join("")}
      </table>`;
    if (!unsigned.length) payLinkBlock(out, file);
  } catch (e) {
    out.innerHTML = errBox(e);
  }
});
