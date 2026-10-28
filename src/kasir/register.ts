// The pay page's cash register ("mesin kasir"): a real 3D device built only from CSS 3D
// transforms (no 3D library), seen from one fixed high camera. It only *shows* what the page
// does: the page calls loadCharter / verified / refused / ringUp / printReceipt / split, and the
// register animates it. Every number it shows comes from the caller.
// CSP-safe: no inline style attributes in markup (CSSOM only), images only as data: URLs.

import "./register.css";
import { formatZec } from "@bonbagi/core";
import { coinCounts, compartments, drawerWidths, initialOf, type Compartment } from "./plan.ts";

export interface KasirMember {
  label: string;
  bps: number;
}
export interface ReceiptLine {
  label: string;
  bps: number;
  amountZat: bigint;
}
export interface ReceiptData {
  title: string;
  orderId: string;
  fingerprint: string;
  testnet: boolean;
  lines: ReceiptLine[];
  totalZat: bigint;
  feeZat: bigint;
  /** The real request's QR modules, printed small on the paper (the scannable one is on the page). */
  qr?: { size: number; isDark(row: number, col: number): boolean };
}
export interface ShareEdit {
  index: number;
  fromBps: number;
  toBps: number;
}
export interface RegisterOptions {
  reducedMotion?: boolean;
  /** Called when someone clicks a key or the lever on the 3D register. */
  onKey?: (key: string) => void;
}
export interface Register {
  /** A signed charter card drops onto the reader. */
  loadCharter(members: KasirMember[], fingerprint: string, title: string): Promise<void>;
  /** The cheat lever is pulled and the card is edited in place. */
  tamper(edits: ShareEdit[]): Promise<void>;
  /** One LED per member lights as each signature is checked; resolves when the register is ready. */
  verified(results: boolean[], onEach?: (i: number) => void): Promise<void>;
  /** Same LED sweep, then the stamp arm slams `word` on the card and the drawer locks. */
  refused(results: boolean[], word?: string, onEach?: (i: number) => void): Promise<void>;
  /** The charter could not be read at all. */
  error(message: string): void;
  ringUp(priceZat: bigint, sharesZat: bigint[]): Promise<void>;
  printReceipt(data: ReceiptData): Promise<void>;
  /** Preview of how the one payment will split: the drawer opens, coins drop 40/30/30…, each part is sealed. */
  split(sharesZat: bigint[], onSeal?: (i: number) => void): Promise<void>;
  awaitingWallet(totalZat: bigint): void;
  lcd(label: string, value: string, tone?: "gold" | "red"): void;
  press(key: string): void;
  reset(): void;
}

/* ------------------------------------------------------------------ math (CSS axes: x right, y down, z toward the viewer) */
type M3 = readonly number[];
type V3 = readonly [number, number, number];
const RAD = Math.PI / 180;
const RX = (d: number): M3 => { const c = Math.cos(d * RAD), s = Math.sin(d * RAD); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const RY = (d: number): M3 => { const c = Math.cos(d * RAD), s = Math.sin(d * RAD); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const g9 = (m: M3, i: number) => m[i] ?? 0;
function mm(a: M3, b: M3): M3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(g9(a, i * 3) * g9(b, j) + g9(a, i * 3 + 1) * g9(b, 3 + j) + g9(a, i * 3 + 2) * g9(b, 6 + j));
  return r;
}
const mv = (m: M3, v: V3): V3 => [
  g9(m, 0) * v[0] + g9(m, 1) * v[1] + g9(m, 2) * v[2],
  g9(m, 3) * v[0] + g9(m, 4) * v[1] + g9(m, 5) * v[2],
  g9(m, 6) * v[0] + g9(m, 7) * v[1] + g9(m, 8) * v[2],
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Same exact formatting as the receipt and the request (no rounding). */
const fmtZec = formatZec;
const escH = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* studio light for a camera looking down: key from the upper left front, soft fill from the right */
const L1 = nrm([-0.35, -0.45, 0.82]), L2 = nrm([0.86, -0.14, 0.42]);
const bright = (n: V3) => 0.74 + 0.32 * Math.max(0, dot(n, L1)) + 0.14 * Math.max(0, dot(n, L2));

type Ease = (t: number) => number;
const EASE: Record<"lin" | "out" | "in2" | "in3" | "io" | "back" | "spring", Ease> = {
  lin: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in2: (t) => t * t,
  in3: (t) => t * t * t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 2.1, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  spring: (t) => (t >= 1 ? 1 : 1 - Math.exp(-6.2 * t) * Math.cos(t * 12.5)),
};

type Face = "front" | "back" | "right" | "left" | "top" | "bottom";
const ALL: Face[] = ["front", "back", "right", "left", "top", "bottom"];
interface BoxOpts {
  x: number; y: number; z: number; w: number; h: number; d: number;
  c?: string; M?: M3; only?: Face[]; skip?: Face[];
  html?: Partial<Record<Face, string>>; fc?: Partial<Record<Face, string>>; fcls?: Partial<Record<Face, string>>; k?: string;
}
interface Box { g: HTMLDivElement; faces: Partial<Record<Face, HTMLDivElement>> }
type Pose = Record<"x" | "y" | "z" | "rx" | "rz", number>;
const POSE_KEYS = ["x", "y", "z", "rx", "rz"] as const;
interface Coin { g: HTMLDivElement; x: number; z: number; y: number; vy: number; rest: number; spin: number; t0: number; o: number; done: boolean; hit: boolean; onHit: () => void; onLand: () => void }
interface Cam { pitch: number; yaw: number; zoom: number; tx: number; ty: number; tz: number; px: number; py: number }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, par?: Element | null, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (par) par.appendChild(e);
  return e;
}

export function createRegister(root: HTMLElement, opts: RegisterOptions = {}): Register {
  const RM = opts.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
  const E = { ...EASE };
  if (RM) { E.back = E.out; E.spring = E.out; }
  const SPEED = RM ? 0.45 : 1;

  /* ---------- animation engine: one RAF loop, only while something moves ---------- */
  interface Tw { t0: number; ms: number; fn: (e: number, p: number) => void; ease: Ease; res: (done: boolean) => void }
  const TW = new Map<string, Tw>();
  let twId = 0;
  function tween(key: string | null, ms: number, fn: (e: number, p: number) => void, ease: Ease = E.out): Promise<boolean> {
    return new Promise((res) => {
      const k = key ?? `_${++twId}`;
      const old = TW.get(k);
      if (old) { TW.delete(k); old.res(false); }
      TW.set(k, { t0: performance.now(), ms: Math.max(1, ms * SPEED), fn, ease, res });
      kick();
    });
  }
  const sleep = (ms: number) => tween(null, ms, () => {}, E.lin);
  function tweenStep(now: number): boolean {
    if (!TW.size) return false;
    for (const [k, t] of TW) {
      const p = clamp((now - t.t0) / t.ms, 0, 1);
      t.fn(t.ease(p), p);
      if (p >= 1 && TW.get(k) === t) { TW.delete(k); t.res(true); }
    }
    return true;
  }
  function killTweens() { const all = [...TW.values()]; TW.clear(); all.forEach((t) => t.res(false)); }

  /* ---------- scene ---------- */
  root.classList.add("k-stage");
  root.replaceChildren();
  const camEl = el("div", "k-cam", root);
  const caption = el("p", "k-cap", root);
  const NRM: V3[] = [];
  const NK = new Map<string, number>();
  function shade(f: HTMLElement, n: V3) {
    const key = n.map((x) => Math.round(x * 60)).join(",");
    let i = NK.get(key);
    if (i === undefined) { i = NRM.length; NRM.push(n); NK.set(key, i); }
    f.style.setProperty("--b", `var(--kb${i},1)`);
  }
  const grp = (par: Element, t: string, cls = "") => { const g = el("div", "k-g" + (cls ? " " + cls : ""), par); if (t) g.style.transform = t; return g; };
  const FACES: Record<Face, (o: BoxOpts) => [number, number, string, M3]> = {
    front: (o) => [o.w, o.h, `translateZ(${o.d / 2}px)`, I3],
    back: (o) => [o.w, o.h, `rotateY(180deg) translateZ(${o.d / 2}px)`, RY(180)],
    right: (o) => [o.d, o.h, `rotateY(90deg) translateZ(${o.w / 2}px)`, RY(90)],
    left: (o) => [o.d, o.h, `rotateY(-90deg) translateZ(${o.w / 2}px)`, RY(-90)],
    top: (o) => [o.w, o.d, `rotateX(90deg) translateZ(${o.h / 2}px)`, RX(90)],
    bottom: (o) => [o.w, o.d, `rotateX(-90deg) translateZ(${o.h / 2}px)`, RX(-90)],
  };
  function box(par: Element, o: BoxOpts): Box {
    const g = grp(par, `translate3d(${o.x}px,${-o.y}px,${o.z}px)`);
    const M = o.M ?? I3;
    const faces: Box["faces"] = {};
    for (const name of o.only ?? ALL) {
      if (o.skip?.includes(name)) continue;
      const [fw, fh, tr, Rf] = FACES[name](o);
      if (fw <= 0 || fh <= 0) continue;
      const f = el("div", "k-f" + (o.fcls?.[name] ? " " + o.fcls[name] : ""), g, o.html?.[name]);
      f.style.cssText = `width:${fw}px;height:${fh}px;left:${-fw / 2}px;top:${-fh / 2}px;transform:${tr};`;
      const col = o.fc && name in o.fc ? o.fc[name] : o.c;
      if (col) f.style.background = col;
      if (o.k) f.dataset.k = o.k;
      shade(f, mv(mm(M, Rf), [0, 0, 1]));
      faces[name] = f;
    }
    return { g, faces };
  }
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;

  const COL = { shell: "#f3efe5", shell2: "#e9e4d8", deck: "#faf7ee", ink: "#1b1b19", gold: "#f4b728", goldS: "#d99d16", cream: "#fffdf5", cavity: "#7d786e", red: "#c0341d" };
  const reg = grp(camEl, "translate3d(0,0,0)");

  /* counter, mat and soft shadows */
  el("div", "k-flat k-floor", reg);
  el("div", "k-flat k-mat", reg);
  const shadowG = grp(reg, "");
  el("div", "k-flat k-shadow k-s1", shadowG);
  el("div", "k-flat k-shadow k-s2", reg);

  /* shell (y 0..150) with the drawer opening in front */
  box(reg, { x: 0, y: 75, z: 0, w: 440, h: 150, d: 360, c: COL.shell, skip: ["front", "bottom"], fc: { left: COL.shell2 },
    html: { right: `<div class="k-plate">CHEAT LEVER<span>pull = edit after signing</span></div>`, left: `<span class="k-big">BONBAGI</span>`, back: `<div class="k-stk">BB-01 · every step runs in this browser</div>` } });
  box(reg, { x: 0, y: 121, z: 180, w: 440, h: 58, d: 0, only: ["front"], c: COL.shell,
    html: { front: `<div class="k-fx k-fstrip"><span class="k-ledline"></span><p>SHIELDED PAYMENTS ONLY<br>ONE TX · ONE OUTPUT PER MEMBER</p><div class="k-vents">${"<i></i>".repeat(14)}</div></div>` } });
  box(reg, { x: 0, y: 5, z: 180, w: 440, h: 10, d: 0, only: ["front"], c: COL.shell });
  box(reg, { x: -210, y: 51, z: 180, w: 20, h: 82, d: 0, only: ["front"], c: COL.shell });
  box(reg, { x: 210, y: 51, z: 180, w: 20, h: 82, d: 0, only: ["front"], c: COL.shell });
  box(reg, { x: 0, y: 10, z: 5, w: 400, h: 0, d: 350, only: ["top"], c: COL.cavity });
  box(reg, { x: 0, y: 92, z: 5, w: 400, h: 0, d: 350, only: ["bottom"], c: "#6a665d" });
  box(reg, { x: -200, y: 51, z: 5, w: 0, h: 82, d: 350, only: ["right"], c: COL.cavity });
  box(reg, { x: 200, y: 51, z: 5, w: 0, h: 82, d: 350, only: ["left"], c: COL.cavity });
  box(reg, { x: 0, y: 51, z: -170, w: 400, h: 82, d: 0, only: ["front"], c: "#625e55" });

  /* the drawer: compartments are rebuilt for every charter */
  const drawer = grp(reg, "");
  el("div", "k-flat k-shadow k-s3", drawer);
  box(drawer, { x: 0, y: 51, z: 175.5, w: 396, h: 78, d: 7, c: COL.cream, skip: ["bottom"], k: "OPEN",
    html: { front: `<div class="k-fx k-dfront"><span class="k-db">Bon<b>Bagi</b></span><span class="k-dt" data-r="dtag">SPLIT DRAWER</span><span class="k-dh"></span><span class="k-dk" data-r="dlock"></span><span class="k-dlk">LOCKED</span></div>` } });
  box(drawer, { x: 0, y: 14, z: 3.5, w: 392, h: 0, d: 337, only: ["top"], fcls: { top: "k-felt" } });
  box(drawer, { x: -196, y: 44, z: 3.5, w: 4, h: 60, d: 337, skip: ["bottom"], c: COL.shell2 });
  box(drawer, { x: 196, y: 44, z: 3.5, w: 4, h: 60, d: 337, skip: ["bottom"], c: COL.shell2 });
  box(drawer, { x: 0, y: 44, z: -165, w: 396, h: 60, d: 4, skip: ["bottom"], c: COL.shell2 });
  const compG = grp(drawer, "");
  const IN_L = -194, IN_W = 388;
  interface Comp { c: Compartment; x0: number; w: number; cx: number; tag: HTMLElement; tape: HTMLElement; amt: HTMLElement; tapeAmt: HTMLElement }
  let COMP: Comp[] = [];

  /* sloped keyboard deck and its keys */
  const DECK_L = Math.hypot(160, 46), ALPHA = Math.atan2(46, 160) / RAD;
  const DM = RX(-ALPHA);
  const deck = grp(reg, `translate3d(0,-150px,150px) rotateX(${-ALPHA}deg)`);
  box(deck, { x: 0, y: 0, z: -DECK_L / 2, w: 440, h: 0, d: DECK_L, only: ["top"], M: DM, c: COL.deck,
    html: { top: `<div class="k-fx k-deckf"><span class="k-dl k-dl1">KEYPAD · PRICE</span><span class="k-dl k-dl2">STEPS 1 → 6</span><span class="k-pwr"></span><span class="k-chk">CHEAT ▸</span><span class="k-lip"></span></div>` } });
  box(reg, { x: 220, y: 173, z: 70, w: 0, h: 46, d: 160, only: ["right"], c: COL.shell }).faces.right?.classList.add("k-tri-r");
  box(reg, { x: -220, y: 173, z: 70, w: 0, h: 46, d: 160, only: ["left"], c: COL.shell2 }).faces.left?.classList.add("k-tri-l");
  interface Key { inner: HTMLDivElement; x: number; y: number; z: number; top: HTMLElement }
  const KEYS = new Map<string, Key>();
  function key(name: string, x: number, z: number, w: number, d: number, h: number, fn: boolean, label: string) {
    const y = h / 2 + 1;
    const inner = grp(deck, `translate3d(${x}px,${-y}px,${z}px)`);
    const b = box(inner, { x: 0, y: 0, z: 0, w, h, d, M: DM, c: fn ? COL.goldS : "#0e0e0d", skip: ["bottom"], k: name,
      fcls: { top: "k-kt" + (fn ? " k-fn" : "") }, fc: { top: "" }, html: { top: label } });
    if (b.faces.top) KEYS.set(name, { inner, x, y, z, top: b.faces.top });
  }
  [["C", "0", "DOT"], ["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].forEach((row, r) =>
    row.forEach((k, c) => key(k, -172 + c * 52, -24 - r * 34, 44, 27, 11, false, k === "DOT" ? "." : k)));
  const FN = ["LOAD", "VERIFY", "TOTAL", "PRINT", "PAY", "OPEN"];
  FN.forEach((k, i) => key(k, 26 + (i % 2) * 98, -126 + Math.floor(i / 2) * 42, 86, 36, 12, true, `<span class="k-kn">${i + 1}</span>${k}`));

  /* tower: lower block, a display sloped up toward the camera, upper block with the card pad and the printer */
  box(reg, { x: 0, y: 185, z: -36, w: 440, h: 70, d: 52, c: COL.shell, only: ["front", "left", "right"], fc: { left: COL.shell2 },
    html: { front: `<div class="k-fx k-tlow">KASIR B-01 · EVERY STEP RUNS IN THIS BROWSER</div>` } });
  box(reg, { x: 0, y: 215, z: -121, w: 440, h: 130, d: 118, c: COL.shell, skip: ["bottom", "front"], fc: { left: COL.shell2 } });
  const DISP_L = Math.hypot(60, 52), BETA = Math.atan2(60, 52) / RAD;
  const dispG = grp(reg, `translate3d(0,-220px,-10px) rotateX(${-BETA}deg)`);
  box(dispG, { x: 0, y: 0, z: -DISP_L / 2, w: 440, h: 0, d: DISP_L, only: ["top"], M: RX(-BETA), c: COL.shell,
    html: { top: `<div class="k-fx k-tfront"><div class="k-lcd" data-r="lcd"><div class="k-lcd-l" data-r="lcdL">INSERT CHARTER CARD</div><div class="k-lcd-v"><span data-r="lcdV">0.0000</span><small data-r="lcdU">ZEC</small></div></div>
      <div class="k-tbrand"><div class="k-tb1">Bon<b>Bagi</b></div><div class="k-leds" data-r="leds"></div></div><span class="k-lamp" data-r="lamp"></span></div>` } });
  box(reg, { x: 220, y: 250, z: -36, w: 0, h: 60, d: 52, only: ["right"], c: COL.shell }).faces.right?.classList.add("k-tri-r");
  box(reg, { x: -220, y: 250, z: -36, w: 0, h: 60, d: 52, only: ["left"], c: COL.shell2 }).faces.left?.classList.add("k-tri-l");
  const pad = box(reg, { x: -115, y: 282, z: -122, w: 180, h: 4, d: 104, c: COL.shell2, skip: ["bottom"], fcls: { top: "k-pad" }, fc: { top: "" },
    html: { top: `<div class="k-pc">DROP THE<br>SIGNED CHARTER</div>` } }).faces.top!;
  box(reg, { x: 115, y: 291, z: -123, w: 170, h: 22, d: 106, c: COL.shell2, skip: ["bottom"], fc: { top: COL.shell },
    html: { top: `<div class="k-fx k-hood"><span class="k-hl">THERMAL 58 MM · ZIP-321</span><span class="k-grill">${"<i></i>".repeat(12)}</span><span class="k-slot"></span></div>` } });

  /* the charter card */
  const cardG = grp(reg, "");
  cardG.hidden = true;
  const cardFace = box(cardG, { x: 0, y: 0, z: 0, w: 164, h: 3, d: 96, c: "#efe8d2", skip: ["bottom"], fcls: { top: "k-card" }, fc: { top: "" }, html: { top: "" } }).faces.top!;
  const CARD_REST: Pose = { x: -115, y: 285.6, z: -122, rx: 0, rz: 0 }, CARD_FROM: Pose = { x: -40, y: 470, z: 60, rx: -40, rz: 24 }, CARD_OUT: Pose = { x: -115, y: 420, z: -60, rx: -30, rz: 10 };
  const lerpPose = (a: Pose, b: Pose, t: number): Pose => { const o = { ...a }; POSE_KEYS.forEach((k) => { o[k] = lerp(a[k], b[k], t); }); return o; };
  const cardPose = (p: Pose) => { cardG.style.transform = `translate3d(${p.x}px,${-p.y}px,${p.z}px) rotateY(-4deg) rotateX(${p.rx}deg) rotateZ(${p.rz}deg)`; };

  /* the stamp arm */
  box(reg, { x: -115, y: 308, z: -172, w: 16, h: 56, d: 16, c: COL.ink, skip: ["bottom"] });
  const ARM_REST = 100;
  let armA = ARM_REST;
  const armG = grp(reg, "");
  box(armG, { x: 0, y: 0, z: 0, w: 38, h: 14, d: 14, c: COL.gold });
  box(armG, { x: 0, y: 0, z: 28, w: 18, h: 12, d: 44, c: COL.ink });
  box(armG, { x: 0, y: -26, z: 50, w: 112, h: 44, d: 54, c: COL.red, fc: { bottom: "#8a2312" }, html: { front: `<div class="k-headlbl">SIGNATURE STAMP</div>` } });
  const armSet = (a: number) => { armA = a; armG.style.transform = `translate3d(-115px,-336px,-172px) rotateX(${a}deg)`; };

  /* the cheat lever; its knob is a billboard sphere */
  let levA = 14;
  const levG = grp(reg, "");
  box(levG, { x: 0, y: 0, z: 0, w: 12, h: 36, d: 36, c: COL.gold, k: "CHEAT" });
  box(levG, { x: 7, y: 58, z: 0, w: 9, h: 110, d: 9, c: "#2b2a27", skip: ["bottom"], k: "CHEAT" });
  const knobG = grp(levG, "translate3d(7px,-120px,0)");
  const knob = el("div", "k-knob", knobG);
  knob.dataset.k = "CHEAT";

  /* receipt: a chain of paper strips out of the slot, each bent a bit more */
  const RC_POS = "translate3d(115px,-302px,-84px)";
  const rcRoot = grp(reg, RC_POS);
  const RC = { N: 22, H: 14, W: 128, IH: 300, F: 0, sway: 0, swayAmp: 0, dirty: true };
  const segs: { s: HTMLDivElement; f: HTMLDivElement; b: HTMLDivElement; h: number }[] = [];
  {
    let par: Element = rcRoot;
    for (let k = 0; k < RC.N; k++) {
      const s = grp(par, "");
      const f = el("div", "k-f k-paper", s), b = el("div", "k-f k-paper-b", s);
      f.style.cssText = `width:${RC.W}px;left:${-RC.W / 2}px;height:0;top:0`;
      b.style.cssText = f.style.cssText + ";transform:rotateY(180deg)";
      segs.push({ s, f, b, h: -1 });
      par = s;
    }
  }

  /* refs inside the faces */
  const lcdEl = q<HTMLElement>('[data-r="lcd"]'), lcdL = q<HTMLElement>('[data-r="lcdL"]'), lcdV = q<HTMLElement>('[data-r="lcdV"]'), lcdU = q<HTMLElement>('[data-r="lcdU"]');
  const lamp = q<HTMLElement>('[data-r="lamp"]'), leds = q<HTMLElement>('[data-r="leds"]'), dlock = q<HTMLElement>('[data-r="dlock"]'), dtag = q<HTMLElement>('[data-r="dtag"]');

  /* ---------- camera: fixed high angle; only short scripted moves ---------- */
  const HOME0: Cam = { pitch: -58, yaw: -12, zoom: 1.03, tx: 0, ty: 385, tz: 0, px: 0, py: -85 };
  const HOMEP: Cam = { ...HOME0, zoom: 0.945, py: -55 };
  const HOME1: Cam = { ...HOME0, zoom: 0.74, px: 14, py: -120 };
  const SHOT: Record<"card" | "print" | "split" | "refuse", Partial<Cam>> = {
    card: { zoom: 1.1, tx: -70, ty: 275, tz: -110, pitch: -60, px: 0, py: 0 },
    print: { zoom: 0.94, tx: 50, ty: 390, tz: -130, pitch: -55, px: 0, py: 0 },
    split: { zoom: 1.12, tx: 0, ty: 130, tz: 240, pitch: -63, px: 0, py: 0 },
    refuse: { zoom: 1.16, tx: -90, ty: 280, tz: -120, pitch: -61, px: 0, py: 0 },
  };
  let dz = 0;
  const CAM: Cam = RM ? { ...HOME0 } : { ...HOME0, pitch: -68, zoom: 0.9, ty: 405 };
  let camDirty = true, SC = 1;
  function camTo(shot: Partial<Cam> | null, ms = 1100, home?: Cam): Promise<boolean> {
    const H = home ?? (dz > 100 ? HOME1 : RC.F > 0 ? HOMEP : HOME0);
    const to: Cam = { ...H, ...(shot ?? {}) };
    if (RM) { if (!shot) { Object.assign(CAM, to); camDirty = true; kick(); } return Promise.resolve(true); }
    const from: Cam = { ...CAM };
    return tween("cam", ms, (e) => {
      (Object.keys(from) as (keyof Cam)[]).forEach((k) => { CAM[k] = lerp(from[k], to[k], e); });
      camDirty = true;
    }, E.io);
  }
  function applyCam() {
    const s = SC * CAM.zoom;
    camEl.style.transform = `translate(${(CAM.px * SC).toFixed(2)}px,${(CAM.py * SC).toFixed(2)}px) scale3d(${s},${s},${s}) rotateX(${CAM.pitch.toFixed(3)}deg) rotateY(${CAM.yaw.toFixed(3)}deg) translate3d(${(-CAM.tx).toFixed(2)}px,${CAM.ty.toFixed(2)}px,${(-CAM.tz).toFixed(2)}px)`;
    const R = mm(RX(CAM.pitch), RY(CAM.yaw));
    NRM.forEach((n, i) => camEl.style.setProperty(`--kb${i}`, bright(mv(R, n)).toFixed(3)));
    const o = mv(RY(-CAM.yaw), [36, 0, -44]);
    shadowG.style.transform = `translate3d(${o[0].toFixed(1)}px,0,${o[2].toFixed(1)}px)`;
    knob.style.transform = `rotateX(${-levA}deg) rotateY(${-CAM.yaw}deg) rotateX(${-CAM.pitch}deg)`;
    RC.dirty = true;
  }
  function fit() {
    const r = root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const top = 8, bot = 8, avail = r.height - top - bot;
    SC = clamp(Math.min(r.width / 520, avail / 640), 0.3, 1.3);
    const cx = r.width / 2, cy = top + avail / 2;
    camEl.style.left = `${cx.toFixed(1)}px`;
    camEl.style.top = `${cy.toFixed(1)}px`;
    root.style.perspectiveOrigin = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
    camDirty = true;
    kick();
  }

  /* ---------- paper ---------- */
  function paperApply() {
    const R = mm(RX(CAM.pitch), RY(CAM.yaw));
    let A = 0;
    segs.forEach((sg, k) => {
      const a = (k === 0 ? 1 : Math.min(7, 0.8 + 0.55 * k)) + Math.sin(RC.sway * 2.4 - k * 0.42) * RC.swayAmp * (k / RC.N) * 5;
      A += a;
      sg.s.style.transform = (k ? `translateY(${-RC.H}px) ` : "") + `rotateX(${a.toFixed(2)}deg)`;
      const start = k * RC.H, h = clamp(RC.F - start, 0, RC.H);
      if (h !== sg.h) { sg.h = h; sg.f.style.height = sg.b.style.height = `${h}px`; sg.f.style.top = sg.b.style.top = `${-h}px`; }
      if (h > 0) {
        sg.f.style.backgroundPosition = `0 ${-(RC.F - start - h)}px`;
        let n = mv(R, [0, -Math.sin(A * RAD), Math.cos(A * RAD)]);
        if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
        const bv = bright(n).toFixed(3);
        sg.f.style.setProperty("--b", bv);
        sg.b.style.setProperty("--b", bv);
      }
    });
  }

  /* ---------- coins ---------- */
  const COINS: Coin[] = [];
  function makeCoin(): HTMLDivElement {
    const g = grp(compG, "");
    for (let i = 0; i < 3; i++) {
      const d = el("div", "k-f k-coin" + (i === 2 ? " k-top" : i === 1 ? " k-mid" : ""), g);
      d.style.cssText = `width:38px;height:38px;left:-19px;top:-19px;transform:translateY(${-i * 2}px) rotateX(90deg)`;
      shade(d, [0, -1, 0]);
    }
    return g;
  }
  const coinApply = (c: Coin) => { c.g.style.transform = `translate3d(${c.x.toFixed(1)}px,${(-c.y).toFixed(1)}px,${c.z.toFixed(1)}px) rotateY(${c.spin}deg)`; c.g.style.setProperty("--o", c.o.toFixed(2)); };
  function coinStep(dt: number, now: number): boolean {
    let act = false;
    for (const c of COINS) {
      if (c.done) continue;
      act = true;
      if (now < c.t0) continue;
      c.o = Math.min(1, c.o + dt * 7);
      c.vy -= 2300 * dt;
      c.y += c.vy * dt;
      if (c.y <= c.rest) {
        c.y = c.rest;
        if (!c.hit) { c.hit = true; c.onHit(); }
        if (Math.abs(c.vy) < 150) { c.vy = 0; c.done = true; c.onLand(); } else c.vy = -c.vy * 0.32;
      }
      coinApply(c);
    }
    return act;
  }
  function pulse(x: number, z: number) {
    const r = el("div", "k-flat k-ring", compG);
    void tween(null, 560, (e, p) => { r.style.transform = `translate3d(${x}px,-15px,${z}px) rotateX(90deg) scale(${0.45 + e * 1.15})`; r.style.opacity = String(1 - p); }, E.out).then(() => r.remove());
  }

  /* ---------- frame loop ---------- */
  let raf = 0, lastT = 0;
  function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
  function loop(now: number) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    let act = tweenStep(now);
    if (camDirty) { applyCam(); camDirty = false; }
    if (coinStep(dt, now)) act = true;
    if (RC.dirty) { paperApply(); RC.dirty = false; }
    raf = act ? requestAnimationFrame(loop) : 0;
  }

  /* ---------- small helpers ---------- */
  function lcd(l: string, v: string, tone?: "gold" | "red") {
    lcdL.textContent = l;
    lcdV.textContent = v;
    lcdU.hidden = !/^\d+(\.\d+)?$/.test(v);
    lcdEl.className = "k-lcd" + (tone ? ` k-${tone}` : "");
  }
  function lampSet(tone: "" | "mint" | "gold" | "red", flash = false) {
    lamp.className = "k-lamp" + (tone ? ` k-${tone}` : "");
    if (flash) setTimeout(() => { if (lamp.classList.contains(`k-${tone}`)) lamp.className = "k-lamp k-mint"; }, 900);
  }
  function press(name: string) {
    const k = KEYS.get(name);
    if (!k) return;
    void tween(`key${name}`, 240, (_e, p) => {
      const d = p < 0.28 ? (p / 0.28) * 5 : 5 * (1 - E.back((p - 0.28) / 0.72));
      k.inner.style.transform = `translate3d(${k.x}px,${(-k.y + d).toFixed(2)}px,${k.z}px)`;
    }, E.lin);
    k.top.classList.add("k-hit");
    setTimeout(() => k.top.classList.remove("k-hit"), 170);
  }
  const drawerZ = (z: number) => { dz = z; drawer.style.transform = `translate3d(0,0,${z.toFixed(2)}px)`; };
  function shake() {
    if (RM) return;
    void tween("shake", 300, (_e, p) => {
      const a = (1 - p) * 5.5;
      reg.style.transform = `translate3d(${(Math.sin(p * 63) * a).toFixed(2)}px,${(Math.cos(p * 51) * a * 0.6).toFixed(2)}px,0)`;
    }, E.lin).then(() => { reg.style.transform = "translate3d(0,0,0)"; });
  }
  const leverSet = (a: number) => { levA = a; levG.style.transform = `translate3d(226px,-118px,60px) rotateX(${a}deg)`; camDirty = true; kick(); };

  /* ---------- charter-dependent parts ---------- */
  let members: KasirMember[] = [];
  /* one LED per drawer compartment (at most five), whatever the size of the collective */
  function renderLeds() {
    leds.innerHTML = compartments(members).map((c, i) => `<span><i data-i="${i}"></i>${escH(c.initial === "+" ? c.label.replace(" more", "") : c.initial)}</span>`).join("");
  }
  function renderCard(edits: ShareEdit[] = []) {
    const cs = members.slice(0, 4);
    const editOf = (i: number) => edits.find((e) => e.index === i);
    cardFace.innerHTML = `<div class="k-c1"><span>CHARTER · V1</span><span>SIGNED</span></div><div class="k-c2"></div>
      <div class="k-c3">${cs.map((m, i) => { const e = editOf(i); return `<span>${escH(initialOf(m.label))} ${e ? `<b class="k-edit" data-new="${e.toBps / 100}%">${e.fromBps / 100}%</b>` : `<b>${m.bps / 100}%</b>`}</span>`; }).join("")}${members.length > 4 ? `<span>+${members.length - 4}</span>` : ""}</div>
      <div class="k-c4"><span data-r="fp"></span> · signed <i></i><i></i><i></i></div><div class="k-imp" data-r="imp">REFUSED</div><i class="k-scan" data-r="scan"></i>`;
    cardFace.querySelector(".k-c2")!.textContent = cardTitle;
    cardFace.querySelector('[data-r="fp"]')!.textContent = `${cardFp.slice(0, 8)}…`;
  }
  let cardTitle = "", cardFp = "";
  function buildDrawer() {
    compG.replaceChildren();
    COMP = [];
    const cs = compartments(members);
    const widths = drawerWidths(cs.map((c) => c.bps), IN_W, 58);
    let x0 = IN_L;
    cs.forEach((c, i) => {
      const w = widths[i] ?? IN_W / cs.length;
      const cx = x0 + w / 2;
      if (i > 0) box(compG, { x: x0, y: 42, z: 3.5, w: 4, h: 56, d: 337, skip: ["bottom"], c: COL.shell2 });
      const tag = box(compG, { x: cx, y: 14.5, z: -40, w: Math.max(30, w - 16), h: 0, d: 38, only: ["top"], fcls: { top: "k-tagf" },
        html: { top: `<div class="k-tag"><b></b><span></span></div>` } }).faces.top!;
      const tape = box(compG, { x: cx, y: 75, z: 3.5, w: w - 3, h: 0, d: 335, only: ["top"], fcls: { top: "k-tape" },
        html: { top: `<div class="k-tx"><div class="k-tn3"><b></b><span></span></div><div>SHIELDED<span></span></div></div>` } }).faces.top!;
      tape.style.clipPath = "inset(0 0 100% 0)";
      if (w < 80) tape.classList.add("k-narrow");
      // a narrow compartment shows the member's letter, like the chips on the page
      const name = w < 80 && c.members.length === 1 ? c.initial : c.label;
      tag.querySelector("b")!.textContent = name;
      const tb = tape.querySelector<HTMLElement>(".k-tn3 b")!;
      tb.textContent = name;
      tape.querySelector<HTMLElement>(".k-tx > div:last-child span")!.textContent = c.members.length === 1 ? `only ${c.label} can read` : "each reads only their own";
      const amt = tag.querySelector<HTMLElement>("span")!, tapeAmt = tape.querySelector<HTMLElement>(".k-tn3 span")!;
      amt.textContent = tapeAmt.textContent = `${(c.bps / 100).toFixed(c.bps % 100 ? 2 : 0)}%`;
      COMP.push({ c, x0, w, cx, tag, tape, amt, tapeAmt });
      x0 += w;
    });
    dtag.textContent = `${cs.length} COMPARTMENTS · ${cs.map((c) => Math.round(c.bps / 100)).join(" / ")}`;
  }
  const compShares = (sharesZat: bigint[]) => COMP.map((cp) => cp.c.members.reduce((a, i) => a + (sharesZat[i] ?? 0n), 0n));

  /* ---------- receipt image ---------- */
  const fontsReady = Promise.all(
    ['900 25px "Sofia Sans Extra Condensed"', '700 9px "Sofia Sans Variable"', '400 6px "Martian Mono Variable"', 'italic 400 11px "Instrument Serif"'].map((f) => document.fonts.load(f).catch(() => [])),
  ).then(() => undefined);
  function drawReceipt(d: ReceiptData): string {
    const W = 128, H = RC.IH, R = 2, c = document.createElement("canvas");
    c.width = W * R;
    c.height = H * R;
    const x = c.getContext("2d");
    if (!x) return "";
    x.scale(R, R);
    x.fillStyle = "#fffdf5";
    x.fillRect(0, 0, W, H);
    const MONO = '"Martian Mono Variable", "Martian Mono", monospace', TEXT = '"Sofia Sans Variable", "Sofia Sans", sans-serif', DISP = '"Sofia Sans Extra Condensed", sans-serif';
    const txt = (s: string, X: number, Y: number, font: string, col: string, al: CanvasTextAlign = "left", maxW?: number) => { x.font = font; x.fillStyle = col; x.textAlign = al; x.fillText(s, X, Y, maxW); };
    const rule = (Y: number) => { x.strokeStyle = "#b9b4a8"; x.setLineDash([2, 2]); x.lineWidth = 0.7; x.beginPath(); x.moveTo(8, Y); x.lineTo(W - 8, Y); x.stroke(); x.setLineDash([]); };
    txt("BON", W / 2 - 1, 30, `900 25px ${DISP}`, "#151515", "right");
    txt("BAGI", W / 2 - 1, 30, `900 25px ${DISP}`, "#9c6607", "left");
    txt(`${d.testnet ? "TESTNET" : "MAINNET"} · ${d.orderId.toUpperCase()}`, W / 2, 40, `500 5.2px ${MONO}`, "#53534d", "center", W - 16);
    rule(47);
    txt(d.title, W / 2, 59, `700 8.6px ${TEXT}`, "#151515", "center", W - 16);
    txt(`charter ${d.fingerprint.slice(0, 8)}… · all signed`, W / 2, 68, `400 5.2px ${MONO}`, "#67625a", "center");
    rule(75);
    let y = 89;
    const shown = d.lines.slice(0, d.lines.length > 6 ? 5 : 6);
    shown.forEach((l) => {
      txt(l.label, 10, y, `700 8px ${TEXT}`, "#151515", "left", 62);
      txt(`${(l.bps / 100).toFixed(l.bps % 100 ? 2 : 0)}%`, 76, y, `400 5.6px ${MONO}`, "#67625a");
      txt(fmtZec(l.amountZat), W - 10, y, `500 6.6px ${MONO}`, "#151515", "right");
      y += 14;
    });
    if (d.lines.length > shown.length) { txt(`+${d.lines.length - shown.length} more members`, 10, y, `400 5.4px ${MONO}`, "#67625a"); y += 12; }
    rule(y - 6);
    y += 9;
    txt("TOTAL", 10, y, `900 13px ${DISP}`, "#151515");
    txt(`${fmtZec(d.totalZat)} ZEC`, W - 10, y, `700 7.6px ${MONO}`, "#151515", "right");
    y += 11;
    txt(`+ fee ≈ ${fmtZec(d.feeZat)} · ZIP-317 · your wallet`, 10, y, `400 5px ${MONO}`, "#53534d", "left", W - 20);
    y += 8;
    txt(`1 tx · ${d.lines.length} shielded outputs`, 10, y, `400 5px ${MONO}`, "#53534d");
    y += 8;
    if (d.qr) {
      const size = d.qr.size, cell = Math.min(1.1, 74 / size), side = cell * size, qx = (W - side) / 2;
      x.fillStyle = "#151515";
      for (let r = 0; r < size; r++) for (let col = 0; col < size; col++) if (d.qr.isDark(r, col)) x.fillRect(qx + col * cell, y + r * cell, cell + 0.02, cell + 0.02);
      y += side + 8;
      txt("scan the large QR on the page", W / 2, y, `400 4.8px ${MONO}`, "#53534d", "center");
    }
    y += 13;
    txt("thank you!", W / 2, y, `italic 400 11px "Instrument Serif", serif`, "#151515", "center");
    return c.toDataURL("image/png");
  }

  /* ---------- clicks on the device ---------- */
  root.addEventListener("click", (e) => {
    const k = (e.target as Element | null)?.closest<HTMLElement>("[data-k]");
    if (!k?.dataset.k) return;
    const name = k.dataset.k;
    if (name === "CHEAT") {
      if (!RM) void tween("lever", 420, (_e, p) => leverSet(14 - Math.sin(p * Math.PI * 3) * (1 - p) * 9), E.lin);
    } else press(name);
    opts.onKey?.(name);
  });

  /* ---------- state machine for the story ---------- */
  let gen = 0;
  const STALE = Symbol("stale");
  const live = (g: number) => { if (g !== gen) throw STALE; };
  const guard = async (fn: (g: number) => Promise<void>) => {
    const g = gen;
    try { await fn(g); } catch (e) { if (e !== STALE) throw e; }
  };
  function capt(t: string) { caption.textContent = t; caption.hidden = !t; }

  function reset() {
    gen++;
    killTweens();
    COINS.splice(0).forEach((c) => c.g.remove());
    members = [];
    compG.replaceChildren();
    COMP = [];
    leds.replaceChildren();
    drawerZ(0);
    armSet(ARM_REST);
    leverSet(14);
    cardG.hidden = true;
    pad.classList.remove("k-on");
    dlock.classList.remove("k-locked");
    RC.F = 0; RC.swayAmp = 0; RC.dirty = true;
    rcRoot.style.transform = RC_POS;
    rcRoot.style.setProperty("--po", "1");
    reg.style.transform = "translate3d(0,0,0)";
    KEYS.forEach((k) => { k.inner.style.transform = `translate3d(${k.x}px,${-k.y}px,${k.z}px)`; });
    lcd("INSERT CHARTER CARD", "0.0000");
    lampSet("");
    dtag.textContent = "SPLIT DRAWER";
    capt("");
    void camTo(null, 700, HOME0);
    kick();
  }

  async function slam(g: number, word: string) {
    const imp = cardFace.querySelector<HTMLElement>('[data-r="imp"]');
    if (imp) imp.textContent = word;
    await camTo(SHOT.refuse, 650); live(g);
    await tween("arm", 430, (e) => armSet(lerp(ARM_REST, 0, e)), E.in3); live(g);
    imp?.classList.add("k-on");
    shake();
    await tween("arm", 200, (_e, p) => armSet(Math.sin(p * Math.PI) * 6), E.lin); live(g);
    dlock.classList.add("k-locked");
    if (!RM) { const z0 = dz; void tween("drawer", 420, (_e, p) => drawerZ(z0 + Math.sin(p * Math.PI * 5) * (1 - p) * 8), E.lin).then(() => drawerZ(z0)); }
    await sleep(500); live(g);
    await tween("arm", 820, (e) => armSet(lerp(0, ARM_REST, e)), E.io); live(g);
    void camTo(null, 1200);
  }

  /* one LED per compartment; a grouped LED ("+46") lights once for all of its members */
  async function sweep(g: number, results: boolean[], tone: "" | "red", onEach?: (i: number) => void) {
    const head = tone ? "CHARTER CHANGED · RE-CHECKING" : "CHECKING SIGNATURES";
    lcd(head, `0 / ${results.length}`, tone || undefined);
    let done = 0;
    const groups = compartments(members);
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi]!;
      const L = leds.querySelector<HTMLElement>(`i[data-i="${gi}"]`);
      L?.classList.add("k-busy");
      await sleep(grp.members.length > 1 ? 520 : 380); live(g);
      L?.classList.remove("k-busy");
      L?.classList.add(grp.members.every((i) => results[i]) ? "k-ok" : "k-no");
      for (const i of [...grp.members].sort((a, b) => a - b)) onEach?.(i);
      done += grp.members.length;
      lcd(head, `${done} / ${results.length}`, tone || undefined);
    }
  }

  const api: Register = {
    loadCharter: (list, fingerprint, title) => {
      reset();
      members = list.map((m) => ({ label: m.label, bps: m.bps }));
      cardTitle = title;
      cardFp = fingerprint;
      return guard(async (g) => {
        renderLeds();
        renderCard();
        buildDrawer();
        press("LOAD");
        lcd("READING CARD", "· · ·");
        cardG.hidden = false;
        cardPose(CARD_FROM);
        void camTo(SHOT.card, 900);
        await tween("card", 780, (e) => cardPose(lerpPose(CARD_FROM, CARD_REST, e)), E.back); live(g);
        pad.classList.add("k-on");
        const sc = cardFace.querySelector<HTMLElement>('[data-r="scan"]');
        if (sc) { sc.classList.remove("k-go"); void sc.offsetWidth; sc.classList.add("k-go"); }
        await sleep(520); live(g);
        lcd(`${members.length} MEMBERS · CHECKING`, "LOADED");
        void camTo(null, 1000);
      });
    },
    tamper: (edits) => guard(async (g) => {
      await tween("lever", 280, (e) => leverSet(lerp(14, -50, e)), E.in2); live(g);
      void tween("lever", 950, (e) => leverSet(lerp(-50, 14, e)), E.spring);
      edits.forEach((ed) => { const m = members[ed.index]; if (m) m.bps = ed.toBps; });
      renderCard(edits);
      lcd("CHARTER CHANGED AFTER SIGNING", "EDIT", "red");
      await sleep(320); live(g);
    }),
    verified: (results, onEach) => guard(async (g) => {
      press("VERIFY");
      await sweep(g, results, "", onEach);
      lampSet("gold", true);
      lcd("VERIFIED · RING UP THE PRICE", `${results.length} / ${results.length}`, "gold");
    }),
    refused: (results, word = "REFUSED", onEach) => guard(async (g) => {
      await sweep(g, results, "red", onEach);
      lcd(`${word} · DRAWER LOCKED`, "SIG ✗", "red");
      lampSet("red");
      await slam(g, word);
    }),
    error: (message) => {
      reset();
      lcd(Array.from(message.toUpperCase()).slice(0, 34).join(""), "ERR", "red");
      lampSet("red");
    },
    ringUp: (priceZat, sharesZat) => guard(async (g) => {
      const txt = fmtZec(priceZat);
      let typed = "";
      for (const ch of txt.slice(0, 10)) {
        press(ch === "." ? "DOT" : ch);
        typed += ch;
        lcd("PRICE", typed);
        await sleep(120); live(g);
      }
      press("TOTAL");
      lcd(`TOTAL · ${sharesZat.length} SHARES · PRINT`, fmtZec(priceZat));
      compShares(sharesZat).forEach((z, i) => {
        const cp = COMP[i];
        if (cp) cp.amt.textContent = cp.tapeAmt.textContent = `${(cp.c.bps / 100).toFixed(cp.c.bps % 100 ? 2 : 0)}% · ${fmtZec(z)}`;
      });
      await sleep(200); live(g);
    }),
    printReceipt: (d) => guard(async (g) => {
      press("PRINT");
      lcd("BUILDING REQUEST", "ZIP-321");
      await fontsReady; live(g);
      const img = drawReceipt(d);
      // set once per strip (not through a CSS variable: a long data: URL in a variable is re-read on every style pass)
      if (img) segs.forEach((sg) => { sg.f.style.backgroundImage = `url("${img}")`; });
      lampSet("mint");
      void camTo(SHOT.print, 1300);
      await tween("paper", 2300, (_e, p) => {
        const steps = 46, qq = p * steps, k = Math.floor(qq);
        RC.F = RC.IH * Math.min(1, (k + E.out(Math.min(1, (qq - k) * 2.2))) / steps);
        RC.sway = p * 9; RC.swayAmp = 0.12 * p; RC.dirty = true;
      }, E.lin); live(g);
      RC.F = RC.IH; RC.dirty = true;
      void tween("sway", 1700, (_e, p) => { RC.sway = 9 + p * 8; RC.swayAmp = 0.5 * (1 - p); RC.dirty = true; }, E.lin);
      lcd("RECEIPT PRINTED · SCAN TO PAY", fmtZec(d.totalZat));
      void camTo(null, 1300);
    }),
    split: (sharesZat, onSeal) => guard(async (g) => {
      press("OPEN");
      capt("Preview · how your one payment will split");
      lcd("PREVIEW · HOW IT WILL SPLIT", COMP.map((c) => Math.round(c.c.bps / 100)).join("/").slice(0, 14));
      COINS.splice(0).forEach((c) => c.g.remove());
      COMP.forEach((cp) => { cp.tape.style.clipPath = "inset(0 0 100% 0)"; cp.tag.classList.remove("k-gone"); });
      void camTo(SHOT.split, 1200);
      if (dz < 200) { await tween("drawer", 950, (e) => drawerZ(lerp(dz, 250, e)), E.spring); live(g); }
      drawerZ(250);
      const counts = coinCounts(COMP.map((c) => c.c.bps));
      const order: number[] = [];
      const left = counts.slice();
      while (left.some((c) => c > 0)) left.forEach((c, i) => { if (c > 0) { order.push(i); left[i] = c - 1; } });
      const stackN = COMP.map(() => 0);
      const now = performance.now();
      await new Promise<void>((res) => {
        let settled = 0;
        if (!order.length) { res(); return; }
        order.forEach((ci, j) => {
          const cp = COMP[ci]!;
          const cols = cp.w >= 92 ? 2 : 1, slot = stackN[ci] ?? 0;
          stackN[ci] = slot + 1;
          const row = Math.floor(slot / cols), colI = slot % cols;
          const n = counts[ci] ?? 1, lastRowAlone = cols === 2 && n % 2 === 1 && slot === n - 1;
          const dx = cols === 1 || lastRowAlone ? 0 : colI ? 23 : -23;
          const c: Coin = { g: makeCoin(), x: cp.cx + dx + (Math.random() * 3 - 1.5), z: 2 + row * 42 + (Math.random() * 3 - 1.5), y: 260, vy: -60, rest: 14, spin: (Math.random() * 360) | 0, t0: now + j * 150 * SPEED, o: 0, done: false, hit: false,
            onHit: () => pulse(c.x, c.z), onLand: () => { if (++settled === order.length) res(); } };
          COINS.push(c);
          coinApply(c);
        });
        kick();
      });
      live(g);
      for (let i = 0; i < COMP.length; i++) {
        const cp = COMP[i]!;
        cp.tag.classList.add("k-gone");
        await tween(`tape${i}`, 520, (e) => { cp.tape.style.clipPath = `inset(0 0 ${((1 - e) * 100).toFixed(1)}% 0)`; }, E.io); live(g);
        onSeal?.(i);
      }
      await sleep(700); live(g);
      void camTo(null, 1400);
    }),
    awaitingWallet: (totalZat) => {
      lcd("WAITING FOR YOUR WALLET", fmtZec(totalZat));
      lampSet("mint");
      capt("Waiting for your wallet · nothing has been paid yet");
    },
    lcd: (l, v, tone) => lcd(l, v, tone),
    press,
    reset,
  };

  /* ---------- boot ---------- */
  drawerZ(0);
  armSet(ARM_REST);
  leverSet(14);
  lcd("INSERT CHARTER CARD", "0.0000");
  capt("");
  const ro = new ResizeObserver(() => fit());
  ro.observe(root);
  fit();
  applyCam();
  paperApply();
  if (!RM) void camTo(null, 1700, HOME0);
  kick();
  return api;
}
