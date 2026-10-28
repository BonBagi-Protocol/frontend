// The desk beside the register: a live trace of the steps this tab really ran (with their
// real timings) and a result panel with the real members, shares and amounts.
// Lines stream in like API calls, but every one is a local step: there is no server.

export type TraceStatus = "ok" | "no" | "wait" | "info" | "edit";
export interface TraceLine {
  done(status: TraceStatus, detail: string | null, ms?: number | null, html?: string): void;
}
export interface Trace {
  push(name: string, method?: string): TraceLine;
  note(text: string): void;
  clear(): void;
}

const LABEL: Record<TraceStatus, string> = { ok: "ok", no: "✗ fail", wait: "waiting", info: "note", edit: "edited" };

/** Exact ZEC with at least four decimals: 400000n -> "0.0040", 87000n -> "0.00087" (never rounded). */
export function zecMin4(z: bigint): string {
  const N = 100000000n;
  const frac = (z % N).toString().padStart(8, "0").replace(/0+$/, "").padEnd(4, "0");
  return `${z / N}.${frac}`;
}

export const fmtMs = (ms: number | null | undefined) =>
  ms == null ? "" : ms < 0.1 ? "<0.1 ms" : ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;

export function createTrace(list: HTMLElement, head: HTMLElement, count: HTMLElement, jump: HTMLButtonElement, reduced: boolean): Trace {
  let t0 = 0, n = 0, live = 0, stick = true, user = 0;
  const clock = () => {
    if (!t0) t0 = performance.now();
    const ms = performance.now() - t0;
    return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${((ms / 1000) % 60).toFixed(3).padStart(6, "0")}`;
  };
  const follow = () => {
    if (!stick) { jump.hidden = false; return; }
    list.scrollTo({ top: list.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  };
  // only the reader's own scrolling (wheel, touch, keys, scrollbar) can unstick the log from the bottom
  for (const ev of ["wheel", "touchstart", "pointerdown", "keydown"]) list.addEventListener(ev, () => { user = performance.now(); }, { passive: true });
  list.addEventListener("scroll", () => {
    if (performance.now() - user > 1200) return;
    stick = list.scrollHeight - list.scrollTop - list.clientHeight < 36;
    if (stick) jump.hidden = true;
  });
  jump.addEventListener("click", () => { stick = true; jump.hidden = true; follow(); });
  const setLive = (d: number) => { live = Math.max(0, live + d); head.classList.toggle("is-live", live > 0); };
  const typeText = (node: HTMLElement, text: string) => {
    if (reduced) { node.textContent = text; return; }
    let i = 0;
    const step = Math.max(2, Math.ceil(text.length / 24));
    const tick = () => {
      i = Math.min(text.length, i + step);
      node.textContent = text.slice(0, i);
      if (i < text.length) requestAnimationFrame(tick);
      else follow();
    };
    requestAnimationFrame(tick);
  };
  return {
    push(name, method = "LOCAL") {
      const li = document.createElement("li");
      li.className = "k-tl is-pend";
      li.innerHTML = `<span class="k-tt"></span><span class="k-tm"></span><span class="k-tn"></span><span class="k-ts"><i class="k-spin" aria-hidden="true"></i></span><span class="k-td"></span><div class="k-tr"></div>`;
      li.querySelector(".k-tt")!.textContent = clock();
      li.querySelector(".k-tm")!.textContent = method;
      li.querySelector(".k-tn")!.textContent = name;
      list.append(li);
      n++;
      count.textContent = `${n} step${n === 1 ? "" : "s"}`;
      setLive(1);
      follow();
      let closed = false;
      return {
        done(status, detail, ms, html) {
          if (closed) return;
          closed = true;
          setLive(-1);
          li.classList.remove("is-pend");
          li.classList.add(`is-${status}`, "is-fresh");
          setTimeout(() => li.classList.remove("is-fresh"), 900);
          const st = document.createElement("b");
          st.className = `k-st k-${status}`;
          st.textContent = LABEL[status];
          li.querySelector(".k-ts")!.replaceChildren(st);
          li.querySelector(".k-td")!.textContent = fmtMs(ms);
          const tr = li.querySelector<HTMLElement>(".k-tr")!;
          if (html) tr.innerHTML = html;
          else if (detail) typeText(tr, detail);
          follow();
        },
      };
    },
    note(text) {
      const li = document.createElement("li");
      li.className = "k-tl k-sep";
      li.textContent = text;
      list.append(li);
      follow();
    },
    clear() {
      list.replaceChildren();
      t0 = 0; n = 0; live = 0; stick = true;
      head.classList.remove("is-live");
      jump.hidden = true;
      count.textContent = "0 steps";
    },
  };
}

/* ---------------------------------------------------------------- result panel */
export interface ResultMember { label: string; bps: number; address: string }
export type RowStatus = "waiting" | "signed" | "broken" | "missing" | "in request" | "sealed" | "wallet";
export interface Result {
  members(list: ResultMember[], initialOf: (l: string) => string, colour: (i: number) => string): void;
  status(i: number, s: RowStatus): void;
  amounts(zat: bigint[]): void;
  memos(memos: string[], sealed: boolean): void;
  totals(total: string, fee: string, tx: string): void;
  badge(text: string, tone?: "gold" | "mint" | "red"): void;
  refused(on: boolean, why?: string): void;
  clear(): void;
}

const STATUS: Record<RowStatus, [string, string]> = {
  waiting: ["waiting", ""],
  signed: ["signed ✓", "gold"],
  broken: ["✗ broken", "red"],
  missing: ["✗ missing", "red"],
  "in request": ["in request", ""],
  sealed: ["sealed", "mint"],
  wallet: ["to your wallet", "gold"],
};

export function createResult(root: HTMLElement): Result {
  const rows = root.querySelector<HTMLElement>("[data-rows]")!;
  const badgeEl = root.querySelector<HTMLElement>("[data-badge]")!;
  const stamp = root.querySelector<HTMLElement>("[data-stamp]")!;
  const tot = root.querySelector<HTMLElement>("[data-total]")!, fee = root.querySelector<HTMLElement>("[data-fee]")!, tx = root.querySelector<HTMLElement>("[data-tx]")!;
  let names: string[] = [];
  const row = (i: number) => rows.children[i] as HTMLElement | undefined;
  const clear = () => {
    rows.replaceChildren();
    names = [];
    const p = document.createElement("p");
    p.className = "k-empty";
    p.textContent = "Load a charter to see who gets what.";
    rows.append(p);
    tot.textContent = fee.textContent = tx.textContent = "—";
    stamp.hidden = true;
    badgeEl.textContent = "waiting";
    badgeEl.className = "k-badge";
  };
  clear();
  return {
    members(list, initialOf, colour) {
      rows.replaceChildren();
      // a long list scrolls inside the panel; make that scroll box reachable by keyboard
      if (list.length > 3) { rows.tabIndex = 0; rows.setAttribute("role", "region"); rows.setAttribute("aria-label", `All ${list.length} members`); }
      else { rows.removeAttribute("tabindex"); rows.removeAttribute("role"); rows.removeAttribute("aria-label"); }
      names = list.map((m) => m.label);
      list.forEach((m, i) => {
        const r = document.createElement("div");
        r.className = "k-row";
        r.innerHTML = `<div class="k-rn"><span class="mchip"><i aria-hidden="true"></i><span></span></span><span class="k-ra"></span></div><div class="k-rp"></div><div class="k-rz"><span class="k-cnt">—</span><small>ZEC</small></div><div class="k-rm"><span class="k-memo is-none">memo appears when the receipt is printed</span></div><div class="k-rs"><span class="k-pill">waiting</span></div>`;
        r.querySelector(".mchip")!.classList.add(colour(i));
        r.querySelector(".mchip i")!.textContent = initialOf(m.label);
        r.querySelector(".mchip span")!.textContent = m.label;
        const a = m.address;
        r.querySelector(".k-ra")!.textContent = a.length <= 20 ? a : `${a.slice(0, 10)}…${a.slice(-6)}`;
        r.querySelector(".k-rp")!.textContent = `${(m.bps / 100).toFixed(m.bps % 100 ? 2 : 0)}%`;
        rows.append(r);
      });
    },
    status(i, s) {
      const p = row(i)?.querySelector<HTMLElement>(".k-pill");
      if (!p) return;
      const [t, tone] = STATUS[s];
      p.textContent = t;
      p.className = "k-pill" + (tone ? ` is-${tone}` : "");
      row(i)?.classList.toggle("is-bad", s === "broken" || s === "missing");
    },
    amounts(zat) {
      zat.forEach((z, i) => {
        const c = row(i)?.querySelector<HTMLElement>(".k-cnt");
        if (c) c.textContent = zecMin4(z);
      });
    },
    memos(memos, sealed) {
      memos.forEach((m, i) => {
        const el = row(i)?.querySelector<HTMLElement>(".k-memo");
        if (!el) return;
        el.title = m;
        if (sealed) {
          el.className = "k-memo is-sealed";
          el.innerHTML = `<svg viewBox="0 0 11 12" aria-hidden="true"><rect x="1" y="5" width="9" height="7" rx="1.5" fill="currentColor"/><path d="M3 5V3.6a2.5 2.5 0 015 0V5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span></span>`;
          el.querySelector("span")!.textContent = `only ${names[i] ?? "this member"} can read`;
        } else {
          el.className = "k-memo is-built";
          el.textContent = m;
        }
      });
    },
    totals(t, f, x) { tot.textContent = t; fee.textContent = f; tx.textContent = x; },
    badge(text, tone) { badgeEl.textContent = text; badgeEl.className = "k-badge" + (tone ? ` is-${tone}` : ""); },
    refused(on, why = "the charter changed after signing") {
      stamp.hidden = !on;
      const s = stamp.querySelector("small");
      if (s) s.textContent = why;
    },
    clear,
  };
}
