// Scene 1 · the bill prints, then the promise.
// On load a thermal printer feeds out one receipt (0.0100 ZEC for Ayu, Bima and
// Citra) line by line. The receipt then steps back out of focus behind the
// centred headline. On scroll it tears along its perforations, bottom share first,
// and the three shares tumble down out of frame into the next scene while the
// printer rises away and the counter-grey room warms to cream.
import "@fontsource-variable/martian-mono/standard.css"; // the wdth axis, for narrow receipt numerals
import "./sec-print.css";
import { scene, seg, easeInOut, easeOut, clamp, reduced } from "./scroll";

type Share = { no: string; name: string; pc: string; amt: string; memo: string; to: string };
const SHARES: Share[] = [
  { no: "01", name: "AYU", pc: "40%", amt: "0.0040", memo: "“thanks for october”", to: "utest1q8…m4f2" },
  { no: "02", name: "BIMA", pc: "30%", amt: "0.0030", memo: "“great feedback”", to: "utest1z3…k9wd" },
  { no: "03", name: "CITRA", pc: "30%", amt: "0.0030", memo: "“see you thursday”", to: "utest1p7…x2ra" },
];

const ARROW =
  '<svg class="pr-arw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

const strip = (s: Share, last: boolean) => `
  <div class="pr-piece pr-strip"><div class="pr-paper"><i class="pr-perf"></i>
    <div class="pr-row pr-hd"><span><span class="pr-no">${s.no}</span>${s.name}</span><span>${s.pc}</span></div>
    <div class="pr-amt">${s.amt}<small>ZEC</small></div>
    <div class="pr-row pr-sm"><span class="pr-k">MEMO</span><span>${s.memo}</span></div>
    <div class="pr-row pr-sm"><span class="pr-k">TO</span><span>${s.to}</span></div>${last ? '<i class="pr-curl"></i>' : ""}
  </div></div>`;

const TEMPLATE = `
<div class="stage">
  <div class="pr-light" aria-hidden="true"></div>
  <div class="pr-grid" aria-hidden="true"></div>
  <div class="pr-world" aria-hidden="true">
    <div class="pr-printer"><div class="pr-pbody"></div><i class="pr-pgrill"></i><i class="pr-pled"></i><i class="pr-pbtn"></i><i class="pr-pslot"></i></div>
    <div class="pr-feed">
      <div class="pr-receipt">
        <div class="pr-fsh"></div><div class="pr-fsh"></div><div class="pr-fsh"></div>
        <div class="pr-piece pr-stub"><div class="pr-paper">
          <div class="pr-brand">BONBAGI</div>
          <div class="pr-rule"></div>
          <div class="pr-row"><span class="pr-k">COLLECTIVE</span><span>DEMO · 3 MEMBERS</span></div>
          <div class="pr-row"><span class="pr-k">CHARTER</span><span>3/3 SIGNED</span></div>
          <div class="pr-row"><span class="pr-k">NETWORK</span><span>ZCASH TESTNET</span></div>
          <div class="pr-rule"></div>
          <div class="pr-total"><span class="pr-lab">TOTAL</span><span class="pr-big">0.0100<small>ZEC</small></span></div>
          <div class="pr-rule2"></div>
          <div class="pr-cap">1 TX · 3 SHIELDED OUTPUTS</div>
        </div></div>
        ${SHARES.map((s, i) => strip(s, i === SHARES.length - 1)).join("")}
      </div>
      <div class="pr-slotshade"></div>
    </div>
  </div>
  <div class="pr-copy">
    <h1 class="pr-hl" id="hero-title">
      <span class="pr-ln"><span class="pr-w">One payment.<i class="pr-u" aria-hidden="true"></i></span></span>
      <span class="pr-ln"><span class="pr-w">Every share.<i class="pr-u" aria-hidden="true"></i></span></span>
      <span class="pr-ln"><span class="pr-w">Nobody’s business.<i class="pr-u" aria-hidden="true"></i></span></span>
    </h1>
    <p class="pr-sub">One shielded Zcash payment pays every member of a collective in a single transaction. No treasurer, no custodian, and nobody outside learns who got what.</p>
    <div class="pr-cta">
      <a class="pr-btn pr-btn--pri" href="/try">Try to cheat the split${ARROW}</a>
      <a class="pr-btn pr-btn--sec" href="./pay.html">Pay a collective</a>
    </div>
  </div>
</div>`;

/* ---------- small helpers ---------- */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ss = (a: number, b: number, t: number) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const px = (n: number) => `${n.toFixed(2)}px`;
const mixRGB = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i] ?? v, t))).join(",")})`;
const COUNTER = [231, 231, 226], CREAM = [255, 253, 245];

/** Interlocking zig-zag clip so neighbouring pieces read as one perforated sheet until they tear. */
function zigzag(w: number, h: number, top: boolean, dz: number, tw: number): string {
  const half = tw / 2, tri = (x: number) => { const q = (x / tw) % 1; return q < 0.5 ? q * 2 : 2 - q * 2; };
  const pts: [number, number][] = [];
  if (top) { for (let x = 0; x < w; x += half) pts.push([x, tri(x) * dz]); pts.push([w, tri(w) * dz]); }
  else pts.push([0, 0], [w, 0]);
  const bot: [number, number][] = [];
  for (let x = 0; x < w; x += half) bot.push([x, h - dz + tri(x) * dz]);
  bot.push([w, h - dz + tri(w) * dz]);
  pts.push(...bot.reverse());
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(",")})`;
}

/** Writes a style value only when it changed (the tick runs every frame while in view). */
const cache = new WeakMap<HTMLElement, Record<string, string>>();
function put(el: HTMLElement, prop: string, val: string): void {
  let c = cache.get(el);
  if (!c) { c = {}; cache.set(el, c); }
  if (c[prop] === val) return;
  c[prop] = val;
  el.style.setProperty(prop, val);
}

export function mount(root: HTMLElement): void {
  root.innerHTML = TEMPLATE;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const $$ = <T extends HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const stage = $(".stage"), light = $(".pr-light"), grid = $(".pr-grid"), world = $(".pr-world"), printer = $(".pr-printer");
  const feed = $(".pr-feed"), receipt = $(".pr-receipt"), stub = $(".pr-stub");
  const strips = $$(".pr-strip"), pieces = $$(".pr-piece"), shadows = $$(".pr-fsh");
  const copy = $(".pr-copy"), hl = $(".pr-hl"), lines = $$(".pr-ln"), unders = $$(".pr-u");
  const sub = $(".pr-sub"), cta = $(".pr-cta");
  const q = new URLSearchParams(location.search);
  const frozen = q.has("print") ? clamp(Number(q.get("print")) || 0) : null;

  /* paper dust that flies off a tear */
  const bits = Array.from({ length: 14 }, () => {
    const el = document.createElement("i");
    el.className = "pr-bit";
    receipt.appendChild(el);
    return { el, t: 0, x0: 0, y0: 0, vx: 0, vy: 0, spin: 0, ph: 0 };
  });
  let bitN = 0;

  /* ---------- layout ---------- */
  const L = { vw: 0, vh: 0, mob: false, rs: 1, RW: 0, RH: 0, slotY: 0, rigL: 0, stubBottom: 0, dz: 0 };
  type Fall = { ot: number; w: number; h: number; sy: number; DX: number; LY: number; Z: number; RZ: number; RX: number; RY: number; sw: number; sf: number; ph: number };
  let F: Fall[] = [];

  function fitHeadline(maxW: number, cap: number): void {
    hl.style.setProperty("font-size", "100px");
    let w = 0;
    for (const l of lines) w = Math.max(w, (l.firstElementChild as HTMLElement).offsetWidth);
    hl.style.setProperty("font-size", px(Math.min(cap, (maxW * 0.985) / (w / 100))));
  }

  function layout(vw: number, vh: number): void {
    const mob = vw < 760;
    Object.assign(L, { vw, vh, mob });
    // the promise, centred
    const copyW = mob ? vw - 32 : Math.min(1000, vw - 2 * Math.max(24, vw * 0.06));
    fitHeadline(copyW, mob ? vw * 0.19 : clamp(vw * 0.084, 64, 126));
    const copyH = copy.offsetHeight;
    // the printer sits clear of the 64px nav
    const pTop = mob ? 74 : Math.round(clamp(vh * 0.088, 76, 92));
    const face = mob ? 40 : 48, below = mob ? 12 : 16;
    const slotY = pTop + face;
    // receipt scale: the stub must sit above the headline, the whole print must fit on screen
    root.style.setProperty("--print-rs", "1");
    const RW0 = receipt.offsetWidth, RH0 = receipt.offsetHeight, SH0 = stub.offsetHeight;
    const gapS = mob ? 16 : 24;
    let rs = Math.min((vh - (mob ? 22 : 30) - copyH - gapS - slotY) / SH0, (vh - 26 - slotY) / RH0, (mob ? vw * 0.74 : Math.min(vw * 0.34, 470)) / RW0);
    rs = clamp(rs, 0.5, 1.3);
    root.style.setProperty("--print-rs", rs.toFixed(4));
    const RW = receipt.offsetWidth, RH = receipt.offsetHeight, stubH = stub.offsetHeight;
    root.style.setProperty("--print-rw", px(RW));
    const rcx = vw / 2, rigL = rcx - RW / 2;
    put(feed, "left", px(rigL));
    put(feed, "top", px(slotY));
    const pw = RW + (mob ? 46 : 112);
    put(printer, "left", px(rcx - pw / 2));
    put(printer, "top", px(pTop));
    put(printer, "width", px(pw));
    put(printer, "height", px(face + below));
    root.style.setProperty("--print-slotb", px(below));
    receipt.style.setProperty("perspective", mob ? "1000px" : "1500px");
    const stubBottom = slotY + stubH;
    const room = vh - (mob ? 22 : 30) - stubBottom - gapS - copyH;
    put(copy, "top", px(stubBottom + gapS + Math.max(0, room * (mob ? 0.5 : 0.3))));
    // perforations
    const dz = 0.34 * rs * 10, tw = 1.1 * rs * 10;
    pieces.forEach((pc, k) => {
      const pa = pc.firstElementChild as HTMLElement;
      pa.style.setProperty("clip-path", zigzag(pa.offsetWidth, pa.offsetHeight, k > 0, dz, tw));
    });
    // falls (A, B, C): A drops straight and toward the camera, B drifts left and away, C swings right
    const W = mob ? vw : Math.min(vw, 1300);
    const DX = mob ? [vw * 0.03, -vw * 0.24, vw * 0.25] : [W * 0.05, -W * 0.33, W * 0.34];
    F = strips.map((s, i) => {
      const ot = s.offsetTop, w = s.offsetWidth, h = s.offsetHeight;
      // low point of the fall (screen space); afterwards the camera overtakes them into the next scene
      const LY = vh * ([0.68, 0.76, 0.82][i] ?? 0.74);
      shadows[i]!.style.setProperty("left", px(s.offsetLeft));
      shadows[i]!.style.setProperty("top", px(ot));
      shadows[i]!.style.setProperty("width", px(w));
      shadows[i]!.style.setProperty("height", px(h));
      return {
        ot, w, h, sy: slotY + ot + h / 2, DX: DX[i] ?? 0, LY,
        Z: [mob ? 260 : 360, mob ? -220 : -380, mob ? 120 : 180][i] ?? 0,
        RZ: [-7, -26, 32][i] ?? 0, RX: [22, 42, 30][i] ?? 0, RY: [14, -32, 24][i] ?? 0,
        sw: ([26, 34, 30][i] ?? 0) * (mob ? 0.55 : 1), sf: [2.1, 1.7, 2.4][i] ?? 2, ph: [0, 1.6, 3.1][i] ?? 0,
      };
    });
    Object.assign(L, { rs, RW, RH, slotY, rigL, stubBottom, dz });
  }

  /* ---------- the print (time based, plays once) ---------- */
  type Step = { t0: number; t1: number; y0: number; y1: number };
  const I = { state: "wait" as "wait" | "print" | "done", t0: 0, steps: [] as Step[], i: 0, end: 0, doneAt: -1e9, ready: false, natural: false };
  function buildPrint(): void {
    const st: Step[] = [], stepPx = Math.max(8, 21 * L.rs), bounds = strips.map((s) => L.RH - s.offsetTop);
    let t = 0, y = 0;
    while (y < L.RH - 0.01) {
      const len = Math.min(stepPx, L.RH - y), dur = 34 + Math.random() * 12;
      st.push({ t0: t, t1: t + dur, y0: y, y1: y + len });
      const ny = y + len;
      t += dur + 9 + Math.random() * 9;
      if (bounds.some((b) => b > y && b <= ny)) t += 120;
      y = ny;
    }
    I.steps = st; I.i = 0; I.end = t + 30;
  }
  function fedAt(tt: number): [number, boolean] {
    const st = I.steps;
    let i = I.i;
    while (i < st.length - 1 && tt >= st[i + 1]!.t0) i++;
    I.i = i;
    const s = st[i]!;
    if (tt < s.t0) return [s.y0, false];
    if (tt < s.t1) { const k = (tt - s.t0) / (s.t1 - s.t0); return [s.y0 + (s.y1 - s.y0) * (1 - (1 - k) * (1 - k)), true]; }
    return [s.y1, false];
  }
  const skipIntro = () => { I.state = "done"; I.doneAt = -1e9; I.natural = false; printer.classList.remove("is-on"); printer.classList.add("is-ready"); };

  /* ---------- tear + fall state ---------- */
  const TS = [0.2, 0.15, 0.1], TL = 0.06, FS = TS.map((t) => t + 0.03), LOW = 0.78;
  const tauPrev = [0, 0, 0];
  const kicks: { t: number; y: number; a: number }[] = [];

  layout(innerWidth, innerHeight);
  const fontsDone = () => { if (!I.ready) { I.ready = true; layout(innerWidth, innerHeight); } };
  if (document.fonts) { document.fonts.ready.then(fontsDone); setTimeout(fontsDone, 1200); } else fontsDone();
  if (reduced) skipIntro();

  scene(root, (p, { time: now, vw, vh }) => {
    if (vw !== L.vw || Math.abs(vh - L.vh) > 90) layout(vw, vh);
    const f = now / 1000;

    /* ---- intro ---- */
    if (I.state === "wait" && I.ready && frozen === null) {
      if (p > 0.01 || scrollY > root.offsetTop + 40) skipIntro();
      else { buildPrint(); I.state = "print"; I.t0 = now + 240; }
    }
    if (I.state === "print" && p > 0.01) skipIntro(); // the reader is scrolling: never block them
    let fed = L.RH, feeding = false;
    if (frozen !== null) { fed = frozen * L.RH; printer.classList.add("is-on"); }
    else if (I.state === "wait") fed = 0;
    else if (I.state === "print") {
      const tt = now - I.t0;
      if (tt < 0) { fed = 0; printer.classList.toggle("is-on", ((now / 140) | 0) % 2 === 0); }
      else if (tt >= I.end) { I.state = "done"; I.doneAt = now; I.natural = true; printer.classList.remove("is-on"); printer.classList.add("is-ready"); }
      else { [fed, feeding] = fedAt(tt); printer.classList.toggle("is-on", feeding || ((now / 120) | 0) % 2 === 0); }
    }
    // time since the print finished (negative while printing)
    const e = frozen !== null || I.state === "wait" ? -1e9 : I.state === "print" ? now - (I.t0 + I.end) : now - I.doneAt;

    /* ---- receipt: feed, jitter, cut jolt, sway, tear recoils ---- */
    let rx = 0, ry = fed - L.RH, rr = 0;
    if (!reduced) {
      if (feeding) { rx = 0.36 * Math.sin(now * 0.113) * Math.sin(now * 0.031 + 1); rr = 0.05 * Math.sin(now * 0.047); }
      if (I.state === "print") rr += 0.25 * (fed / L.RH) * Math.sin(now / 520);
      if (I.natural) {
        const dd = now - I.doneAt;
        if (dd >= 0 && dd < 6500) { ry += 2.8 * L.rs * (1 - Math.exp(-dd / 16)) * Math.exp(-dd / 120); rr += 0.9 * Math.exp(-dd / 1300) * Math.sin(dd / 185); }
      }
      rr *= 1 - ss(0, 0.06, p);
      for (let k = kicks.length - 1; k >= 0; k--) {
        const kk = kicks[k]!, kd = now - kk.t;
        if (kd > 1800) { kicks.splice(k, 1); continue; }
        ry -= kk.y * Math.exp(-kd / 110) * Math.cos(kd / 30);
        rr += kk.a * Math.exp(-kd / 600) * Math.sin(kd / 160);
      }
    }
    put(receipt, "transform", `translate3d(${px(rx)},${px(ry)},0) rotate(${rr.toFixed(4)}deg)`);
    put(printer, "transform", feeding && !reduced ? `translate3d(0,${px(0.35 * Math.sin(now * 0.9))},0)` : "none");

    /* ---- camera: the printer rises away, the room warms to cream ---- */
    const pan = reduced ? 0 : easeInOut(seg(p, 0.28, 0.74)) * (L.stubBottom + 90);
    put(world, "transform", `translate3d(0,${px(-pan)},0)`);
    put(world, "opacity", reduced ? (1 - seg(p, 0.55, 0.8)).toFixed(3) : "1");
    put(receipt, "perspective-origin", `${px(L.vw / 2 - L.rigL)} ${px(L.vh * 0.5 - L.slotY + pan)}`);
    const warm = easeInOut(seg(p, 0.38, 0.84));
    put(stage, "background-color", mixRGB(COUNTER, CREAM, warm));
    put(grid, "opacity", (0.7 * (1 - warm)).toFixed(3));
    put(light, "opacity", (1 - warm).toFixed(3));
    put(grid, "transform", reduced ? "none" : `translate3d(0,${px(-p * L.vh * 0.12)},0)`);

    /* ---- the promise: rises in after the print, leaves on scroll ---- */
    const out = seg(p, 0.004, 0.06), lift = seg(p, 0, 0.08);
    lines.forEach((ln, k) => {
      const a = reduced ? 1 : easeOut(clamp((e + 300 - k * 110) / 640));
      put(ln, "opacity", (a * (1 - out)).toFixed(3));
      put(ln, "transform", a < 1 ? `perspective(700px) translate3d(0,${(0.32 * (1 - a)).toFixed(3)}em,0) rotateX(${(-62 * (1 - a)).toFixed(2)}deg)` : "none");
    });
    unders.forEach((u, k) => put(u, "transform", `scaleX(${(reduced ? 1 : easeOut(clamp((e - 380 - k * 230) / 520))).toFixed(4)})`));
    const aSub = reduced ? 1 : easeOut(clamp((e - 40) / 600)), aCta = reduced ? 1 : easeOut(clamp((e - 150) / 600));
    put(sub, "opacity", (aSub * (1 - out)).toFixed(3));
    put(sub, "transform", `translate3d(0,${px(14 * (1 - aSub))},0)`);
    put(cta, "opacity", (aCta * (1 - out)).toFixed(3));
    put(cta, "transform", `translate3d(0,${px(14 * (1 - aCta))},0)`);
    put(copy, "transform", reduced ? "none" : `translate3d(0,${px(L.vh * 0.025 * easeOut(lift))},0) scale(${(1 - 0.07 * easeOut(lift)).toFixed(4)})`);
    put(copy, "visibility", out >= 1 ? "hidden" : "visible");
    put(cta, "pointer-events", out > 0.5 ? "none" : "");

    /* ---- shares: out of focus behind the headline, then torn and dropped ---- */
    const ghost = reduced ? 1 - seg(p, 0.035, 0.12) : easeInOut(clamp((e + 750) / 700)) * (1 - seg(p, 0.035, 0.12));
    for (let i = 0; i < 3; i++) {
      const g = F[i]!, el = strips[i]!, sh = shadows[i]!;
      const tau = seg(p, TS[i]!, TS[i]! + TL), u = seg(p, FS[i]!, LOW), v = seg(p, LOW, 1);
      if (!reduced && tau >= 0.5 && tauPrev[i]! < 0.5) {
        kicks.push({ t: now, y: 2.2 * L.rs, a: i === 1 ? -0.4 : 0.4 });
        for (let n = 0; n < 5; n++) {
          const b = bits[bitN++ % bits.length]!;
          Object.assign(b, { t: now, x0: L.RW * (0.1 + Math.random() * 0.8), y0: g.ot + L.dz * 0.5, vx: (Math.random() - 0.5) * 110, vy: -30 - Math.random() * 80, spin: (Math.random() - 0.5) * 900, ph: Math.random() * 6 });
        }
      }
      tauPrev[i] = tau;
      let op = 1 - 0.72 * ghost;
      if (reduced) {
        op *= 1 - seg(p, 0.12 + i * 0.05, 0.3 + i * 0.05);
        put(el, "transform", "none");
        put(el, "opacity", op.toFixed(3));
        continue;
      }
      const amp = ss(0, 0.12, u) * (L.mob ? 0.6 : 1);
      const settle = 1 - ss(0, 0.2, u);
      let x = g.DX * (1 - (1 - u) * (1 - u)) + g.sw * Math.sin(u * Math.PI * g.sf + g.ph) * ss(0, 0.15, u);
      let y = (g.LY - g.sy) * easeInOut(u) - L.vh * 0.13 * Math.pow(v, 1.4) + 9 * L.rs * easeOut(tau) * settle + pan;
      const zk = i === 0 ? easeInOut(u) : i === 1 ? u : Math.sin(Math.PI * u);
      const z = g.Z * zk;
      let rz = g.RZ * easeInOut(u), rx2 = g.RX * Math.sin(Math.PI * u * (i === 1 ? 0.9 : 1)), ry2 = g.RY * (i === 1 ? u : Math.sin(Math.PI * u * (i === 0 ? 1.4 : 1)));
      if (amp > 0.001) {
        rz += 3.5 * Math.sin(f * 2.3 + g.ph) * amp; rx2 += 9 * Math.sin(f * 1.8 + g.ph) * amp; ry2 += 7 * Math.sin(f * 1.35 + g.ph * 1.3) * amp;
        x += 6 * Math.sin(f * 1.55 + g.ph) * amp + 0.3 * Math.sin(f * 37 + g.ph) * amp; y += 4 * Math.sin(f * 2.05 + g.ph * 0.7) * amp;
      }
      const tr = 2.8 * Math.sin(Math.PI * tau) * settle, pvx = g.w / 2, pvy = -g.h / 2;
      put(el, "transform", u <= 0 && tau <= 0 && pan === 0 ? "none" :
        `translate3d(${px(x)},${px(y)},${z.toFixed(1)}px) translate(${pvx}px,${pvy}px) rotate(${tr.toFixed(3)}deg) translate(${-pvx}px,${-pvy}px) rotateX(${rx2.toFixed(2)}deg) rotateY(${ry2.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`);
      put(el, "opacity", op.toFixed(3));
      const blur = L.mob ? 0 : Math.max(2.4 * ghost, clamp((z - 420) / 110, 0, 3.2));
      put(pieces[i + 1]!, "filter", blur > 0.02
        ? `blur(${blur.toFixed(2)}px) drop-shadow(0 0.08em 0.07em rgba(20,20,14,.16)) drop-shadow(0.9em 1.6em 1.4em rgba(20,20,14,.13))` : "");
      const sop = 0.32 * ss(0, 0.1, u) * (1 - Math.min(0.8, Math.abs(z) / 520));
      put(sh, "opacity", sop.toFixed(3));
      if (sop > 0) put(sh, "transform", `translate3d(${px(x + 8 + Math.max(0, z) * 0.08)},${px(y + 12 + Math.max(0, z) * 0.3)},0) rotate(${rz.toFixed(2)}deg) scale(${(1 + z / 1400).toFixed(3)})`);
    }

    /* ---- paper dust ---- */
    for (const b of bits) {
      if (!b.t) continue;
      const t = (now - b.t) / 1000;
      if (t > 1.2) { b.t = 0; b.el.style.setProperty("opacity", "0"); continue; }
      const x = b.x0 + b.vx * t + 6 * Math.sin(t * 9 + b.ph), y = b.y0 + b.vy * t + 190 * t * t;
      b.el.style.setProperty("opacity", (1 - t / 1.2).toFixed(3));
      b.el.style.setProperty("transform", `translate3d(${px(x)},${px(y)},0) rotate(${(b.spin * t).toFixed(1)}deg)`);
    }
  }, 0.14);
}
