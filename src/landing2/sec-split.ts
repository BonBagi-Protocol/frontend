import "./sec-split.css";
import { scene, reduced } from "./scroll";

// Scene 2 · the split. A handwritten warung nota falls onto a gold plate, the
// total gets circled, LUNAS is stamped on it, then it is cut like a pie into the
// 40/30/30 shares everyone signed. The slices can be tilted and dragged (springs).
// Scrolling peels each slice into its owner's pocket, sealed with frosted tape.

type Pt = [number, number];
type Rect4 = [number, number, number, number];
interface Spring { x: number; v: number; t: number; k: number; c: number }
interface Member { name: string; pct: number; cls: "gold" | "mint" | "ink"; tilt: number; jit: number }
interface Slice extends Member {
  i: number; bis: number; r1: number; clip: string; shclip: string; edge: string; lab: Pt;
  rb: { x0: number; x1: number; y0: number; y1: number };
}
interface End { x: number; y: number; s: number; r: number; hy: number }

const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const seg = (v: number, a: number, b: number): number => clamp((v - a) / (b - a));
const eio = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo3 = (t: number): number => 1 - Math.pow(1 - t, 3);
const ei2 = (t: number): number => t * t;
const oBack = (t: number, s = 1.7): number => { const c = s + 1; return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
const sstep = (a: number, b: number, v: number): number => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;
const f2 = (n: number): string => n.toFixed(2);
const at = <T>(a: readonly T[], i: number): T => a[i] as T;

/* ---------- nota geometry (design px) ---------- */
const W = 340, H = 460, CX = 170, CY = 230;
const ANG = [-90, 54, 162, 270];               // 40 / 30 / 30 → 144° / 108° / 108°
const NOTA_ROT = -4;
const MEM: Member[] = [
  { name: "Ayu", pct: 40, cls: "gold", tilt: -7, jit: -3 },
  { name: "Bima", pct: 30, cls: "mint", tilt: 6, jit: 4 },
  { name: "Citra", pct: 30, cls: "ink", tilt: -4, jit: -2 },
];

function hit(a: number, R: Rect4): Pt {
  const dx = Math.cos(a * DEG), dy = Math.sin(a * DEG);
  let t = 1e9;
  if (dx > 1e-9) t = Math.min(t, (R[2] - CX) / dx);
  if (dx < -1e-9) t = Math.min(t, (R[0] - CX) / dx);
  if (dy > 1e-9) t = Math.min(t, (R[3] - CY) / dy);
  if (dy < -1e-9) t = Math.min(t, (R[1] - CY) / dy);
  return [CX + dx * t, CY + dy * t];
}
function poly(a0: number, a1: number, R: Rect4): Pt[] {
  const pts: Pt[] = [[CX, CY], hit(a0, R)];
  const corners: Pt[] = [[R[0], R[1]], [R[2], R[1]], [R[2], R[3]], [R[0], R[3]]];
  corners
    .map((p): [number, Pt] => { let g = Math.atan2(p[1] - CY, p[0] - CX) / DEG; while (g < a0) g += 360; while (g >= a0 + 360) g -= 360; return [g, p]; })
    .filter((o) => o[0] > a0 && o[0] < a1)
    .sort((a, b) => a[0] - b[0])
    .forEach((o) => pts.push(o[1]));
  pts.push(hit(a1, R));
  return pts;
}
const clipOf = (pts: Pt[]): string => "polygon(" + pts.map((p) => `${f2(p[0])}px ${f2(p[1])}px`).join(",") + ")";

const SLICES: Slice[] = MEM.map((m, i) => {
  const a0 = at(ANG, i), a1 = at(ANG, i + 1), bis = (a0 + a1) / 2;
  const hb = hit(bis, [0, 0, W, H]);
  const dist = Math.hypot(hb[0] - CX, hb[1] - CY);
  let r1 = -90 - bis;
  while (r1 <= -180) r1 += 360;
  while (r1 > 180) r1 -= 360;
  const c = Math.cos(r1 * DEG), s = Math.sin(r1 * DEG);
  const pr = poly(a0, a1, [0, 0, W, H]).map((p): Pt => { const x = p[0] - CX, y = p[1] - CY; return [x * c - y * s, x * s + y * c]; });
  const xs = pr.map((p) => p[0]), ys = pr.map((p) => p[1]);
  const e0 = hit(a0, [-6, -6, W + 6, H + 6]), e1 = hit(a1, [-6, -6, W + 6, H + 6]);
  return {
    ...m, i, bis, r1,
    clip: clipOf(poly(a0, a1, [-3, -3, W + 3, H + 3])),
    shclip: clipOf(poly(a0, a1, [0, 9, W, H])),
    edge: `M${f2(e0[0])} ${f2(e0[1])}L${CX} ${CY}L${f2(e1[0])} ${f2(e1[1])}`,
    lab: [CX + Math.cos(bis * DEG) * dist * 0.52, CY + Math.sin(bis * DEG) * dist * 0.52],
    rb: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) },
  };
});

/* torn top edge, hand-drawn marker ring, signature */
const ZZ = (() => { let d = `M1.5 ${H - 1.5}V9`; const n = 20, st = (W - 3) / n; for (let k = 0; k < n; k++) d += `L${f2(1.5 + st * (k + 0.5))} 1.5L${f2(1.5 + st * (k + 1))} 9`; return d + `V${H - 1.5}Z`; })();
const RING = (() => { let d = ""; const n = 72; for (let k = 0; k <= n; k++) { const t = -0.55 + (Math.PI * 2 + 0.8) * k / n; const wob = 1 + 0.04 * Math.sin(t * 2.7 + 0.4); d += (k ? "L" : "M") + f2(255 + Math.cos(t) * 78 * wob + k * 0.1) + " " + f2(327 + Math.sin(t) * 29 * wob - k * 0.07); } return d; })();
const SIG = "M214 420C220 398 230 386 235 394C240 403 227 424 237 421C247 418 250 397 258 399C265 401 256 419 264 417C272 415 276 402 284 404C291 406 286 415 293 414C301 413 307 404 318 401M220 430C248 424 286 421 320 426";
const CUTS = ANG.slice(0, 3).map((a) => hit(a, [0, 0, W, H]));
const BURST = Array.from({ length: 10 }, (_, k) => { const a = k / 10 * Math.PI * 2 + 0.2, ex = Math.cos(a), ey = Math.sin(a) * 0.62; return `M${f2(CX + ex * 128)} ${f2(240 + ey * 128)}L${f2(CX + ex * 150)} ${f2(240 + ey * 150)}`; });

function notaHTML(extra = ""): string {
  return `<div class="nota">
  <svg class="nb" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path class="paper" d="${ZZ}"/>
    <g fill="none" stroke="#c0341d">
      <path d="M54 93H160M210 93H320" stroke-width="1.3" stroke-dasharray="1.4 3.2"/>
      <path d="M18 106H322" stroke-width="1.8"/>
      <path d="M18 130H322M18 164H322M18 198H322M18 232H322M18 266H322M18 300H322" stroke-width="1" opacity=".75"/>
      <path d="M62 106V300M240 106V300" stroke-width="1" opacity=".75"/>
      <path d="M24 438H130M210 438H320" stroke-width="1"/>
    </g>
    <path class="sig" d="${SIG}"/>
    <path class="ringp" d="${RING}"/>
  </svg>
  <div class="n-title">NOTA</div>
  <div class="n-no">No.<b>0721</b></div>
  <div class="n-l n-tgl">Tgl.</div><div class="n-l n-tuan">Tuan</div>
  <div class="hw hwa hw-tgl">28/10/26</div><div class="hw hwa hw-tuan">Pak Raka</div>
  <div class="n-l n-qty">Banyak</div><div class="n-l n-name">Nama barang</div><div class="n-l n-amt">Jumlah</div>
  <div class="hw hwa row r1"><span class="q">2</span><span class="nm">Kelas desain</span><span class="am">0,0060</span></div>
  <div class="hw hwa row r2"><span class="q">1</span><span class="nm">Modul + rekaman</span><span class="am">0,0025</span></div>
  <div class="hw hwa row r3"><span class="q">1</span><span class="nm">Sewa studio</span><span class="am">0,0015</span></div>
  <div class="n-l n-tot">Jumlah</div>
  <div class="hw hwa tot">0,0100<small>ZEC</small></div>
  <div class="n-l n-tt">Tanda terima,</div><div class="n-l n-hk">Hormat kami,</div>
  <div class="n-fine">Barang yang sudah dibeli tidak dapat ditukar / dikembalikan</div>
  <div class="stamp"></div>${extra}
</div>`;
}

const sector = (a0: number, a1: number, r = 104): string => {
  const p0 = [Math.cos(a0 * DEG) * r, Math.sin(a0 * DEG) * r], p1 = [Math.cos(a1 * DEG) * r, Math.sin(a1 * DEG) * r];
  return `M0 0L${f2(p0[0] ?? 0)} ${f2(p0[1] ?? 0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f2(p1[0] ?? 0)} ${f2(p1[1] ?? 0)}Z`;
};

const TEMPLATE = `
<div class="stage sp-stage">
  <div class="sp-dots" aria-hidden="true"></div>
  <div class="sp-copy">
    <h2 class="sp-h"><span class="sp-ln"><span class="sp-w sp-sw">No one</span></span> <span class="sp-ln sp-ln2"><span class="sp-w">holds</span> <span class="sp-w">the</span></span> <span class="sp-ln sp-ln3"><span class="sp-w">money.</span></span></h2>
    <div class="sp-slot" aria-hidden="true"></div>
    <p class="sp-line">The bill is cut by the split everyone signed: Ayu&nbsp;40, Bima&nbsp;30, Citra&nbsp;30. Each share drops straight into its owner's pocket.</p>
  </div>
  <p class="sr-only">A handwritten bill for 0.0100 ZEC is stamped paid, cut 40, 30 and 30 percent for Ayu, Bima and Citra, and each share is sealed in its own pocket.</p>
  <div class="sp-scene" aria-hidden="true"></div>
  <p class="sp-cap"><span class="sp-cw">Sealed.</span><br class="sp-mbr"> <span class="sp-cw">Only</span> <span class="sp-cw sp-they">they<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8C20 3 45 2 62 5S88 9 98 4"/></svg></span><br class="sp-mbr"> <span class="sp-cw">can</span> <span class="sp-cw">read</span> <span class="sp-cw">it.</span></p>
</div>`;

/* ---------- rubber-stamp texture, rendered once to a data URL ---------- */
function hash(x: number, y: number): number { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}
function makeStamp(): string {
  const w = 230, h = 96, sc = 3, c = document.createElement("canvas");
  c.width = w * sc; c.height = h * sc;
  const g = c.getContext("2d");
  if (!g) return "";
  g.scale(sc, sc);
  g.strokeStyle = g.fillStyle = "#c0341d";
  const rr = (x: number, y: number, ww: number, hh: number, r: number) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); };
  g.lineWidth = 5.5; rr(4, 4, w - 8, h - 8, 12); g.stroke();
  g.lineWidth = 1.8; rr(12, 12, w - 24, h - 24, 7); g.stroke();
  g.font = "900 72px 'Sofia Sans Extra Condensed', 'Arial Narrow', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "7px";
  g.fillText("LUNAS", w / 2 + 3.5, h / 2 + 4);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data, cw = c.width;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < cw; x++) {
    const k = (y * cw + x) * 4 + 3;
    const a = d[k] ?? 0;
    if (!a) continue;
    const n = 0.58 * vnoise(x / 10, y / 10) + 0.42 * vnoise(x / 2.4 + 50, y / 2.4);
    d[k] = a * sstep(0.16, 0.36, n) * (0.78 + 0.22 * vnoise(x / 90 + 9, y / 70));
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

/* ---------- timeline (seconds of the intro clock) ---------- */
const HW_T: Pt[] = [[1.0, 0.2], [1.1, 0.24], [1.22, 0.3], [1.38, 0.3], [1.54, 0.26], [1.7, 0.26]];
const T_SIG: Pt = [1.8, 0.32], T_RING: Pt = [2.0, 0.42], T_DROP = 2.5, T_HIT = 2.67, T_CUT: Pt = [3.05, 0.22], T_SPLIT = 3.35, T_END = 4.5;
/* scroll phases (0..1 through the track) */
const Q: Pt[] = [[0.46, 0.64], [0.57, 0.75], [0.68, 0.86]];
const TAPE_ROT = [-5, 3.5, -3];

export function mount(root: HTMLElement): void {
  root.innerHTML = TEMPLATE;
  const q1 = <T extends Element>(s: string, r: ParentNode = root): T => r.querySelector(s) as T;
  const qa = <T extends Element>(s: string, r: ParentNode = root): T[] => [...r.querySelectorAll<T>(s)];
  const stage = q1<HTMLElement>(".sp-stage"), sceneEl = q1<HTMLElement>(".sp-scene"), copy = q1<HTMLElement>(".sp-copy");
  const head = q1<HTMLElement>(".sp-h"), slot = q1<HTMLElement>(".sp-slot"), line = q1<HTMLElement>(".sp-line");
  const dots = q1<HTMLElement>(".sp-dots"), cap = q1<HTMLElement>(".sp-cap"), sw = q1<HTMLElement>(".sp-sw");
  const words = qa<HTMLElement>(".sp-w"), capWords = qa<HTMLElement>(".sp-cw"), uline = q1<SVGPathElement>(".sp-they path");
  const mk = (cls: string, html = ""): HTMLDivElement => { const e = document.createElement("div"); e.className = cls; e.innerHTML = html; return e; };
  const svgNS = "http://www.w3.org/2000/svg";

  /* ---------- build the scene ---------- */
  const trails = document.createElementNS(svgNS, "svg");
  trails.setAttribute("class", "sp-trails");
  const trailP = MEM.map(() => { const p = document.createElementNS(svgNS, "path"); trails.appendChild(p); return p; });
  sceneEl.appendChild(trails);

  const plate = mk("sp-sc sp-plate",
    `<svg class="sp-pie" viewBox="-100 -100 200 200" aria-hidden="true">${MEM.map((m, i) => `<path class="pf-${m.cls}" d="${sector(at(ANG, i) + NOTA_ROT, at(ANG, i + 1) + NOTA_ROT)}"/>`).join("")}</svg><div class="sp-ring"></div><div class="sp-badge">1 tx</div>`);
  sceneEl.appendChild(plate);
  const pie = q1<HTMLElement>(".sp-pie", plate), badge = q1<HTMLElement>(".sp-badge", plate);

  const pkBack = MEM.map((m) => { const b = mk(`sp-pk sp-pk-back pb-${m.cls}`); sceneEl.appendChild(b); return b; });

  const wedges = SLICES.map((g) => {
    const wz = mk("sp-wz");
    const sh = mk("sp-wsh");
    sh.style.clipPath = g.shclip;
    const w = mk("sp-wedge",
      `<div class="sp-wc" data-drag="${g.i}">${notaHTML()}<svg class="sp-cutline" width="${W}" height="${H}" aria-hidden="true"><path d="${g.edge}"/></svg></div><div class="sp-stk stk-${g.cls}" data-drag="${g.i}"><b>${g.name}</b><em>${g.pct}%</em></div>`);
    q1<HTMLElement>(".sp-wc", w).style.clipPath = g.clip;
    wz.style.zIndex = "9";
    wz.append(sh, w);
    sceneEl.appendChild(wz);
    return { wz, sh, w, stk: q1<HTMLElement>(".sp-stk", w), g };
  });

  const pkFront = MEM.map((m) => {
    const f = mk(`sp-pk sp-pk-front`,
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="pfr pf-${m.cls}" d="M1 1H99V63L50 99L1 63Z"/><path class="st st-${m.cls}" d="M7 9H93V59.5L50 91L7 59.5Z"/></svg><div class="sp-tag tag-${m.cls}"><b>${m.name}</b><span>${m.pct}%</span></div>`);
    sceneEl.appendChild(f);
    return f;
  });
  const tapes = MEM.map(() => { const t = mk("sp-pk sp-tape", "<span>SHIELDED · SHIELDED · SHIELDED</span>"); sceneEl.appendChild(t); return t; });
  {
    const n = 7, Lp: string[] = [], Rp: string[] = [];
    for (let k = 0; k <= n; k++) { const y = k / n * 100; Lp.push(`${k % 2 ? 2.4 : 0}% ${f2(y)}%`); Rp.push(`${k % 2 ? 97.6 : 100}% ${f2(100 - y)}%`); }
    tapes.forEach((t) => { t.style.clipPath = `polygon(${Lp.join(",")},${Rp.join(",")})`; });
  }

  // the intact nota, used until the cut
  const wholeZ = mk("sp-wz");
  wholeZ.style.zIndex = "9";
  const wholeSh = mk("sp-wsh");
  wholeSh.style.clipPath = clipOf([[0, 9], [W, 9], [W, H], [0, H]]);
  const whole = mk("sp-wedge live",
    `<div class="sp-wc" data-drag="whole">${notaHTML(`<svg class="nov" width="${W}" height="${H}" aria-hidden="true"><g>${CUTS.map(() => `<path class="cut" d=""/>`).join("")}</g><g class="burst">${BURST.map((d) => `<path d="${d}"/>`).join("")}</g></svg>`)}</div>`);
  wholeZ.append(wholeSh, whole);
  sceneEl.appendChild(wholeZ);
  const Wn = {
    hw: qa<HTMLElement>(".hwa", whole), ring: q1<SVGPathElement>(".ringp", whole), sig: q1<SVGPathElement>(".sig", whole),
    stamp: q1<HTMLElement>(".stamp", whole), cuts: qa<SVGPathElement>(".cut", whole), burst: q1<SVGGElement>(".burst", whole),
  };
  const ringLen = Wn.ring.getTotalLength(), sigLen = Wn.sig.getTotalLength(), ulLen = uline.getTotalLength();
  Wn.ring.style.strokeDasharray = `${ringLen}`;
  Wn.sig.style.strokeDasharray = `${sigLen}`;
  uline.style.strokeDasharray = `${ulLen}`;
  Wn.burst.style.transformOrigin = `${CX}px 240px`;

  const paintStamp = () => { try { const u = makeStamp(); if (u) root.style.setProperty("--split-stamp", `url("${u}")`); } catch { /* keep plain */ } };
  paintStamp();

  /* ---------- springs ---------- */
  const springs: Spring[] = [];
  const sp = (k: number, c: number, x = 0): Spring => { const s = { x, v: 0, t: x, k, c }; springs.push(s); return s; };
  const tri = (k: number, c: number): Spring[] => [sp(k, c), sp(k, c), sp(k, c)];
  const S = {
    p: sp(150, 24), tx: sp(70, 12), ty: sp(70, 12),
    gx: sp(170, 12), gy: sp(170, 12), gr: sp(170, 11), glift: sp(260, 20),
    pie: sp(200, 13), kick: sp(260, 9), squash: sp(520, 15),
    ex: tri(240, 12), st: tri(340, 14), q: tri(118, 19),
    dx: tri(170, 11), dy: tri(170, 11), dr: tri(170, 10), lift: tri(260, 20),
    rise: tri(150, 15), tape: tri(270, 14), pk: tri(420, 11),
  };
  const sAt = (a: Spring[], i: number): Spring => a[i] as Spring;
  const stepS = (s: Spring, h: number) => { if (reduced) { s.x = s.t; s.v = 0; return; } const a = -s.k * (s.x - s.t) - s.c * s.v; s.v += a * h; s.x += s.v * h; };

  /* ---------- layout ---------- */
  const L = {
    vw: 0, vh: 0, mob: false, P0: [0, 0] as Pt, D0: 300, Pm: [0, 0] as Pt, Dm: 300, P1: [0, 0] as Pt, D1: 100,
    Wp: 200, Hp: 200, mouth: 0, pcx: [0, 0, 0], rise: 0, end: [] as End[],
    hx: 0, hy: 0, hk: 0.4, ready: false,
  };
  function layout(): void {
    const vw = stage.clientWidth, vh = stage.clientHeight, mob = vw < 820;
    if (!vw || !vh) return;
    Object.assign(L, { vw, vh, mob });
    const sx = copy.offsetLeft + slot.offsetLeft, sy = copy.offsetTop + slot.offsetTop, swd = slot.offsetWidth, sh = slot.offsetHeight;
    L.P0 = [sx + swd / 2, sy + sh / 2];
    L.D0 = Math.max(150, Math.min(swd * (mob ? 0.9 : 0.9), sh * (mob ? 0.94 : 0.9), 620));
    let Wp: number, gap: number, Hp: number, mouth: number, peek: number;
    if (mob) {
      Wp = Math.min((vw - 32 - 24) / 3, 150); gap = 12; Hp = Math.min(vh * 0.235, Wp * 1.7); mouth = vh * 0.535; peek = 0.62;
      L.D1 = 84; L.P1 = [vw / 2, Math.max(vh * 0.255, 160)];
      L.Dm = Math.min(vw * 0.62, vh * 0.3); L.Pm = [vw / 2, Math.max(vh * 0.3, 150 + L.Dm / 2)];
      L.hk = 0.6;
    } else {
      Wp = Math.min(vw * 0.2, 300); gap = Math.min(vw * 0.045, 72); Hp = Math.min(vh * 0.31, Wp * 1.05); mouth = vh * 0.52; peek = 0.44;
      L.D1 = Math.min(vh * 0.145, 132); L.P1 = [vw / 2, Math.max(vh * 0.225, 96 + L.D1 / 2)];
      L.Dm = Math.min(vh * 0.36, 340); L.Pm = [vw / 2, Math.max(vh * 0.3, 96 + L.Dm / 2)];
      L.hk = 0.4;
    }
    Object.assign(L, { Wp, Hp, mouth });
    L.pcx = [0, 1, 2].map((i) => vw / 2 + (i - 1) * (Wp + gap));
    L.rise = vh - (mouth - Hp * 0.18) + 30;
    // each slice ends tip-down in its pocket, the crust peeking above the mouth
    L.end = SLICES.map((g, i) => {
      const rbw = g.rb.x1 - g.rb.x0, rbh = g.rb.y1 - g.rb.y0;
      const s1 = Math.min(Wp * 0.8 / rbw, Hp * (mob ? 1.35 : 1.2) / rbh);
      const ty = mouth - Hp * peek - g.rb.y0 * s1;
      const tx = at(L.pcx, i) - (g.rb.x0 + g.rb.x1) / 2 * s1;
      const hover = (ty - mouth) + Hp * 0.1 + 14;
      return { x: tx, y: ty, s: s1, r: g.r1, hy: ty - hover };
    });
    const tapeTop = mob ? 0.3 : 0.36;
    pkBack.forEach((b, i) => { Object.assign(b.style, { width: `${Wp * 0.9}px`, height: `${Hp * 0.8}px`, left: `${at(L.pcx, i) - Wp * 0.45}px`, top: `${mouth - Hp * 0.18}px` }); });
    pkFront.forEach((f, i) => { Object.assign(f.style, { width: `${Wp}px`, height: `${Hp}px`, left: `${at(L.pcx, i) - Wp / 2}px`, top: `${mouth}px` }); });
    tapes.forEach((t, i) => {
      const tw = Wp * (mob ? 1.06 : 1.14), th = Hp * (tapeTop + 0.04);
      Object.assign(t.style, { width: `${tw}px`, height: `${th}px`, left: `${at(L.pcx, i) - tw / 2}px`, top: `${mouth - Hp * tapeTop}px` });
    });
    const ch = cap.offsetHeight, pb = mouth + Hp;
    cap.style.top = `${Math.round((pb + vh) / 2 - ch / 2 - (mob ? 10 : 4))}px`;
    // heading: where it shrinks to (top-left, under the nav)
    L.hx = (mob ? 16 : Math.max(16, vw * 0.044)) - (copy.offsetLeft + head.offsetLeft);
    L.hy = (mob ? 80 : 92) - (copy.offsetTop + head.offsetTop);
    L.ready = true;
  }

  /* ---------- state ---------- */
  let C = 0, auto = 0, armed = false, clock = 0, shake = 0, prevC = 0;
  const landed = [false, false, false];
  const pointer = { x: 0, y: 0, on: false };
  interface Drag { id: number | "whole"; pid: number; x0: number; y0: number; lx: number; rt: number; el: HTMLElement }
  let drag: Drag | null = null;

  function curPlate(P: number): [number, number, number] {
    const a = eio(seg(P, 0.34, 0.52)), b = eio(seg(P, 0.78, 0.9));
    return [
      lerp(lerp(L.P0[0], L.Pm[0], a), L.P1[0], b),
      lerp(lerp(L.P0[1], L.Pm[1], a), L.P1[1], b),
      lerp(lerp(L.D0, L.Dm, a), L.D1, b),
    ];
  }

  function simulate(p: number, e: number, dt: number): void {
    clock += dt;
    // intro clock: plays by itself once the scene arrives, scrolling can push it on
    if (e < 0.2) { auto = 0; armed = false; } else if (e >= 0.45) armed = true;
    if (armed) auto += dt;
    const target = reduced ? (armed || p > 0 ? T_END : 0) : Math.max(auto, seg(p, 0, 0.3) * T_END);
    prevC = C;
    if (reduced) C = target;
    else if (target > C) C = Math.min(target, C + dt * (p > 0.4 ? 8 : 1.25));
    else C = Math.max(target, C - dt * 3);
    if (prevC < T_HIT && C >= T_HIT && C - prevC < 0.5) { if (!reduced) shake = 0.32; S.squash.v += 9; }
    if (prevC < T_SPLIT && C >= T_SPLIT) S.kick.v += 14;

    const P = reduced ? (p < 0.6 ? 0 : 1) : p;
    S.p.t = P;
    const split = C >= T_SPLIT;
    S.pie.t = split ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const qi = Q[i] as Pt;
      sAt(S.ex, i).t = split ? 1 : 0;
      sAt(S.st, i).t = C >= T_SPLIT + 0.14 + 0.11 * i ? 1 : 0;
      sAt(S.q, i).t = split ? seg(P, qi[0], qi[1]) : 0;
      sAt(S.rise, i).t = eo3(seg(P, 0.4 + 0.04 * i, 0.54 + 0.04 * i));
      const arrived = sAt(S.q, i).x > 0.965;
      sAt(S.tape, i).t = arrived ? 1 : 0;
      if (arrived && !landed[i]) { landed[i] = true; sAt(S.pk, i).v += 7; } else if (sAt(S.q, i).x < 0.9) landed[i] = false;
    }
    const heroOn = 1 - seg(P, 0.3, 0.38);
    if (pointer.on && !drag && !reduced && heroOn > 0) {
      const pl = curPlate(S.p.x);
      S.ty.t = clamp((pointer.x - pl[0]) / (L.vw * 0.45), -1, 1) * 11;
      S.tx.t = -clamp((pointer.y - pl[1]) / (L.vh * 0.45), -1, 1) * 8;
    } else { S.tx.t = 0; S.ty.t = 0; }
    if (drag) { drag.rt *= Math.pow(0.02, dt); (drag.id === "whole" ? S.gr : sAt(S.dr, drag.id)).t = drag.rt; }
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let k = 0; k < n; k++) for (const s of springs) stepS(s, h);
    if (shake > 0) shake -= dt;
  }

  const tf = (x: number, y: number, rot: number, s: number, rx = 0, ry = 0): string =>
    `translate3d(${f2(x - CX)}px,${f2(y - CY)}px,0) perspective(1100px) rotateX(${f2(rx)}deg) rotateY(${f2(ry)}deg) rotate(${f2(rot)}deg) scale(${s.toFixed(4)})`;

  const SKY = [245, 239, 228], CREAM = [255, 253, 245];
  function render(): void {
    const P = S.p.x, vh = L.vh, it = C;

    /* stage: shake + colour hand-off to the next scene's day sky */
    if (shake > 0) { const k = Math.pow(shake / 0.32, 2) * 9; stage.style.transform = `translate(${f2((Math.random() - 0.5) * k)}px,${f2((Math.random() - 0.5) * k)}px) rotate(${f2((Math.random() - 0.5) * k * 0.08)}deg)`; }
    else if (stage.style.transform) stage.style.transform = "";
    const bg = seg(P, 0.9, 1);
    stage.style.backgroundColor = `rgb(${CREAM.map((c, i) => Math.round(lerp(c, at(SKY, i), bg))).join(",")})`;
    dots.style.opacity = f2(1 - bg);

    /* heading: springs in, then shrinks into the corner as a section title */
    const hs = eio(seg(P, 0.34, 0.5));
    head.style.transform = hs > 0 ? `translate3d(${f2(L.hx * hs)}px,${f2(L.hy * hs)}px,0) scale(${f2(lerp(1, L.hk, hs))})` : "";
    words.forEach((w, j) => {
      const t = seg(it, 0.02 + j * 0.07, 0.62 + j * 0.07);
      let tr = `translate3d(0,${f2((1 - oBack(t, 1.9)) * 70)}px,0) rotate(${f2((1 - eo3(t)) * 9)}deg)`;
      if (w === sw) tr += ` scale(${f2(1 + S.kick.x * 0.11)}) rotate(${f2(-3 + S.kick.x * 5)}deg)`;
      w.style.transform = tr;
      w.style.opacity = f2(clamp(t * 3));
    });
    const ls = eo3(seg(it, 0.45, 0.95)), lx = seg(P, 0.32, 0.42);
    line.style.transform = `translate3d(${f2(-lx * 40)}px,${f2((1 - ls) * 26 - lx * 30)}px,0)`;
    line.style.opacity = f2(ls * (1 - lx));
    line.style.visibility = lx > 0.99 ? "hidden" : "";

    /* plate → coin */
    const [px, py, D] = curPlate(P);
    const pop = reduced ? 1 : oBack(seg(it, 0.1, 0.62), 1.6);
    plate.style.width = plate.style.height = `${f2(D)}px`;
    const psh = clamp(D * 0.019, 5, 11);
    plate.style.boxShadow = `${f2(psh)}px ${f2(psh)}px 0 var(--ink)`;
    plate.style.borderWidth = `${D < 200 ? 3 : 4}px`;
    plate.style.transform = `translate3d(${f2(px - D / 2)}px,${f2(py - D / 2)}px,0) scale(${f2(Math.max(pop, 0))})`;
    pie.style.transform = `scale(${f2(Math.max(0, S.pie.x))})`;
    const bt = seg(P, 0.84, 0.9);
    badge.style.opacity = bt > 0 ? "1" : "0";
    badge.style.transform = `scale(${f2(oBack(bt, 2.2))}) rotate(-6deg)`;

    const tiltFade = 1 - seg(P, 0.3, 0.4);
    const rx = S.tx.x * tiltFade, ry = S.ty.x * tiltFade;
    const sN = D * 0.9 / H;

    /* the intact nota (intro) */
    const showWhole = it < T_SPLIT;
    wholeZ.style.display = showWhole ? "" : "none";
    if (showWhole) {
      const tn = seg(it, 0.35, 1.1);
      const fall = py + H * sN * 0.6 + 80;
      const dropY = (1 - oBack(tn, 1.25)) * -fall;
      const rot = NOTA_ROT + (1 - eo3(tn)) * 18 + S.gr.x;
      const sq = 1 - S.squash.x * 0.1;
      const x = px + S.gx.x, y = py + dropY + S.gy.x;
      const s = sN * (1 + S.glift.x * 0.05);
      const squash = ` scale(${f2(1 + (1 - sq) * 0.4)},${f2(sq)})`;
      whole.style.transform = tf(x, y, rot, s, rx, ry) + squash;
      const shd = 9 + S.glift.x * 10;
      wholeSh.style.transform = tf(x + shd, y + shd, rot, s, rx, ry) + squash;
      const vis = tn > 0 ? "1" : "0";
      whole.style.opacity = wholeSh.style.opacity = vis;
      Wn.hw.forEach((el, k) => { const ht = HW_T[k] ?? [0, 0.2]; const r = seg(it, ht[0], ht[0] + ht[1]); el.style.clipPath = `inset(-30% ${f2((1 - r) * 100)}% -30% -4%)`; });
      Wn.sig.style.strokeDashoffset = f2(sigLen * (1 - eio(seg(it, T_SIG[0], T_SIG[0] + T_SIG[1]))));
      Wn.ring.style.strokeDashoffset = f2(ringLen * (1 - eio(seg(it, T_RING[0], T_RING[0] + T_RING[1]))));
      const td = seg(it, T_DROP, T_HIT), th = seg(it, T_HIT, T_HIT + 0.22);
      const ssc = it < T_HIT ? lerp(2.6, 0.92, ei2(td)) : lerp(0.92, 1, oBack(th, 2.5));
      Wn.stamp.style.opacity = f2(it < T_DROP ? 0 : clamp(td * 3) * 0.93);
      Wn.stamp.style.transform = `rotate(${f2(it < T_HIT ? lerp(-26, -12, td) : -12)}deg) scale(${f2(ssc)})`;
      const tb = seg(it, T_HIT, T_HIT + 0.34);
      Wn.burst.style.opacity = f2(tb > 0 && tb < 1 ? 1 - ei2(tb) : 0);
      Wn.burst.style.transform = `scale(${f2(0.75 + eo3(tb) * 0.5)})`;
      Wn.cuts.forEach((c, k) => {
        const r = eio(seg(it, T_CUT[0] + k * 0.05, T_CUT[0] + T_CUT[1] + k * 0.05)), ep = at(CUTS, k);
        c.setAttribute("d", r > 0 ? `M${CX} ${CY}L${f2(lerp(CX, ep[0], r))} ${f2(lerp(CY, ep[1], r))}` : "");
      });
    }

    /* slices */
    wedges.forEach(({ wz, sh, w, stk, g }, i) => {
      wz.style.display = showWhole ? "none" : "";
      const tp = at(trailP, i);
      if (showWhole) { tp.style.opacity = "0"; return; }
      const e = sAt(S.ex, i).x, q = clamp(sAt(S.q, i).x, -0.05, 1.12);
      const onPlate = 1 - clamp(q * 6);
      const bob = reduced ? 0 : onPlate;
      const brot = NOTA_ROT + e * g.jit + sAt(S.dr, i).x + S.gr.x + Math.sin(clock * 1.25 + i * 1.9) * 0.7 * bob;
      const dir = (g.bis + NOTA_ROT) * DEG, E = 30 * e * sN;
      const bx = px + Math.cos(dir) * E + sAt(S.dx, i).x + S.gx.x;
      const by = py + Math.sin(dir) * E + sAt(S.dy, i).x + S.gy.x + Math.sin(clock * 1.7 + i * 2.1) * 3.2 * bob;
      const bs = sN * (1 + sAt(S.lift, i).x * 0.05);
      const end = at(L.end, i);
      let x: number, y: number, r: number, s: number, peel = 0;
      if (q <= 0.7) {
        const u = clamp(q / 0.7), uu = eio(u);
        const cx = lerp(bx, end.x, 0.35), cy = Math.min(by, end.hy) - vh * 0.12, a = 1 - uu;
        x = a * a * bx + 2 * a * uu * cx + uu * uu * end.x;
        y = a * a * by + 2 * a * uu * cy + uu * uu * end.hy;
        r = lerp(brot, end.r, uu); s = lerp(bs, end.s, uu);
        peel = Math.sin(Math.PI * clamp(u / 0.62));
      } else {
        const v = (q - 0.7) / 0.3;
        x = end.x; y = lerp(end.hy, end.y, v); r = end.r; s = end.s;
      }
      s *= 1 + peel * 0.08;
      const prx = rx * onPlate - peel * 28, pry = ry * onPlate + peel * (i === 1 ? -18 : 18);
      w.style.transform = tf(x, y, r, s, prx, pry);
      const shd = 9 * Math.min(1, s / 0.6) + peel * 16 + sAt(S.lift, i).x * 10;
      sh.style.transform = tf(x + shd, y + shd, r, s, prx, pry);
      wz.style.zIndex = q > 0.7 ? "5" : drag && drag.id === i ? "10" : "9";
      w.classList.toggle("live", q < 0.05 && P < 0.4);
      // the sticker stays upright and readable
      const st = Math.max(0, sAt(S.st, i).x);
      const kscale = lerp(Math.max(1, (L.mob ? 0.8 : 0.86) / s), 1, seg(q, 0.5, 0.9));
      stk.style.transform = `translate(${f2(g.lab[0])}px,${f2(g.lab[1])}px) translate(-50%,-50%) rotate(${f2(-r + g.tilt * (1 - q))}deg) scale(${f2(st * kscale)})`;
      stk.style.visibility = st < 0.01 ? "hidden" : "";
      // trail: the shielded output from the coin to the slice
      const vis = clamp((q - 0.02) * 10);
      if (vis > 0) {
        const dy = y - py;
        tp.setAttribute("d", `M${f2(px)} ${f2(py)}C${f2(px)} ${f2(py + dy * 0.55)} ${f2(x)} ${f2(y - dy * 0.55)} ${f2(x)} ${f2(y)}`);
        tp.style.opacity = f2(vis);
        tp.style.strokeDashoffset = f2(reduced ? 0 : -clock * 26);
      } else tp.style.opacity = "0";
    });

    /* pockets */
    for (let i = 0; i < 3; i++) {
      const off = (1 - sAt(S.rise, i).x) * L.rise, k = sAt(S.pk, i).x, t = sAt(S.tape, i).x;
      at(pkBack, i).style.transform = `translate3d(0,${f2(off)}px,0)`;
      at(pkFront, i).style.transform = `translate3d(0,${f2(off)}px,0) scale(${f2(1 + k * 0.05)},${f2(1 - k * 0.09)})`;
      const tape = at(tapes, i);
      tape.style.opacity = f2(clamp(t * 4));
      tape.style.transform = `translate3d(0,${f2(off - (1 - t) * 40)}px,0) rotate(${f2(at(TAPE_ROT, i) + (1 - t) * -16)}deg) scale(${f2(0.35 + 0.65 * t)},${f2(0.8 + 0.2 * t)})`;
    }

    /* closing line */
    capWords.forEach((c, j) => {
      const t = seg(P, 0.86 + j * 0.02, 0.94 + j * 0.02);
      c.style.opacity = f2(clamp(t * 2.5));
      c.style.transform = `translate3d(0,${f2((1 - oBack(t, 1.8)) * 44)}px,0) rotate(${f2((1 - eo3(t)) * 6)}deg)`;
    });
    uline.style.strokeDashoffset = f2(ulLen * (1 - eio(seg(P, 0.93, 0.99))));
  }

  /* ---------- pointer: tilt + drag ---------- */
  const rub = (v: number, m: number): number => Math.sign(v) * m * (1 - Math.exp(-Math.abs(v) / m));
  window.addEventListener("pointermove", (ev) => {
    if (ev.pointerType === "mouse") { pointer.x = ev.clientX; pointer.y = ev.clientY; pointer.on = true; }
    if (!drag || ev.pointerId !== drag.pid) return;
    const tx = rub(ev.clientX - drag.x0, 260), ty = rub(ev.clientY - drag.y0, 200);
    if (drag.id === "whole") { S.gx.t = tx; S.gy.t = ty; } else { sAt(S.dx, drag.id).t = tx; sAt(S.dy, drag.id).t = ty; }
    drag.rt = clamp(drag.rt + (ev.clientX - drag.lx) * 0.55, -22, 22);
    drag.lx = ev.clientX;
  }, { passive: true });
  document.addEventListener("mouseleave", () => { pointer.on = false; });
  sceneEl.addEventListener("pointerdown", (ev) => {
    const el = (ev.target as Element | null)?.closest<HTMLElement>("[data-drag]");
    const wEl = el?.closest<HTMLElement>(".sp-wedge");
    if (!el || !wEl || !wEl.classList.contains("live")) return;
    const id: number | "whole" = el.dataset.drag === "whole" ? "whole" : Number(el.dataset.drag);
    drag = { id, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, lx: ev.clientX, rt: 0, el: wEl };
    if (ev.pointerType === "mouse") ev.preventDefault();
    try { el.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    wEl.classList.add("grab");
    (id === "whole" ? S.glift : sAt(S.lift, id)).t = 1;
  });
  const endDrag = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.pid) return;
    if (drag.id === "whole") { S.gx.t = S.gy.t = S.gr.t = S.glift.t = 0; }
    else { const i = drag.id; sAt(S.dx, i).t = sAt(S.dy, i).t = sAt(S.dr, i).t = sAt(S.lift, i).t = 0; }
    drag.el.classList.remove("grab");
    drag = null;
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  /* ---------- wiring ---------- */
  window.addEventListener("resize", () => { L.ready = false; });
  document.fonts?.ready.then(() => { L.ready = false; paintStamp(); }).catch(() => undefined);
  const io = new IntersectionObserver((ents) => { for (const en of ents) root.classList.toggle("sp-off", !en.isIntersecting); });
  io.observe(root);

  scene(root, (p, info) => {
    if (!L.ready || L.vw !== stage.clientWidth || L.vh !== stage.clientHeight) layout();
    if (!L.ready) return;
    const e = clamp(1 - info.top / info.vh);
    simulate(p, e, Math.min(0.05, info.dt / 1000));
    render();
  }, 0.2);
}
