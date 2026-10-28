import "./sec-close.css";
import { scene, seg, easeInOut as eio, easeOut as eo, clamp, reduced } from "./scroll";

/*
  Scene 5 · "Lipat Tiga" — the closing.
  One signed charter floats in a bright studio. Three gold wax seals press onto it,
  the sheet folds along its two creases, the thirds break apart into three share cards
  (Ayu 40 · Bima 30 · Citra 30 of 0.0100 ZEC) and each card turns over to a memo only
  its member can read. The closing line builds one sentence per beat, then the footer.

  Everything is CSS 3D (preserve-3d) driven by one matrix per card, so lighting and the
  floor shadows can be computed from the card's real orientation every frame.
*/

const MEMBERS = [
  { n: "Ayu", i: "A", a: "utest1q8m…7k4p", s: 40, z: "0.0040 ZEC" },
  { n: "Bima", i: "B", a: "utest1x3f…9d2w", s: 30, z: "0.0030 ZEC" },
  { n: "Citra", i: "C", a: "utest1h7c…0r6e", s: 30, z: "0.0030 ZEC" },
] as const;

/* ---------- beats ----------
   Entering (section top from viewport bottom to top, `enter` 0→1): the sheet swings in,
   "Signed by everyone." rises and the three seals press, so the first viewport is never empty.
   Pinned (p through the 280vh track): fold → split → flip → hold. */
const SEAL_ENTER = [0.3, 0.45, 0.6];          // each seal presses when `enter` passes this
const LINE1_ENTER = [0.18, 0.5] as const;
const POSE = [0.04, 0.26] as const;            // sheet glides to centre, turns 3/4
const FOLD = [0.06, 0.26] as const;            // C-fold along the two creases
const SPLIT = [0.3, 0.5] as const;             // thirds break apart into cards
const FLIP0 = 0.57, FLIP_LEN = 0.14, FLIP_STAG = 0.04; // cards turn to cipher backs (after a hold)
const LINE = [[0, 0], [0.38, 0.46], [0.76, 0.84]] as const;
const AMT = [0.34, 0.44] as const;            // amounts land during the split and stay solid

/* ---------- tiny deterministic generators ---------- */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const HEX = "0123456789abcdef";
function cipher(seed: number): string {
  const r = rng(seed), lines: string[] = [];
  for (let l = 0; l < 5; l++) {
    const g: string[] = [];
    for (let k = 0; k < 5; k++) { let s = ""; for (let c = 0; c < 4; c++) s += HEX[(r() * 16) | 0]; g.push(s); }
    lines.push(g.join(" "));
  }
  return lines.join("\n");
}
function scramble(final: string, lock: number): string {
  let out = "";
  const n = final.length, upto = Math.floor(n * lock);
  for (let k = 0; k < n; k++) {
    const ch = final[k] ?? " ";
    out += k < upto || ch === " " || ch === "\n" ? ch : HEX[(Math.random() * 16) | 0];
  }
  return out;
}
/** Hypotrochoid, banknote-style security rosette (132×132 box). */
function rosette(R: number, r: number, d: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const turns = r / gcd(R, r), N = Math.round((900 * turns) / 6);
  let p = "";
  for (let k = 0; k <= N; k++) {
    const t = (k / N) * Math.PI * 2 * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    p += (k ? "L" : "M") + (66 + x * 0.62).toFixed(1) + " " + (66 + y * 0.62).toFixed(1);
  }
  return p;
}
const sealSvg = (initial: string, filter: string, cls: string) =>
  '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true">' +
    '<g class="spill"><circle cx="50" cy="51" r="44" fill="url(#cl-wax)" filter="url(#' + filter + ')"/></g>' +
    '<circle cx="50" cy="50" r="34.5" fill="url(#cl-face)"/>' +
    '<circle cx="50" cy="50" r="34.5" fill="none" stroke="url(#cl-rim-out)" stroke-width="2.6"/>' +
    '<circle cx="50" cy="50" r="31" fill="none" stroke="url(#cl-rim-in)" stroke-width="1.4" opacity=".9"/>' +
    '<circle cx="50" cy="50" r="27.2" fill="none" stroke="#a86c08" stroke-opacity=".6" stroke-width="1.3" stroke-dasharray=".1 3.05" stroke-linecap="round"/>' +
    '<text class="ini-hi" x="50.9" y="64.2" text-anchor="middle">' + initial + "</text>" +
    '<text class="ini" x="50" y="63" text-anchor="middle">' + initial + "</text>" +
    '<ellipse class="gloss" cx="37" cy="29" rx="17" ry="9" fill="url(#cl-gloss)" opacity=".75"/>' +
  "</svg>";

const ARROW = '<svg class="cf-ar" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const chip = (href: string, label: string, tone: string, ext = false) =>
  '<a class="cf-chip cf-chip--' + tone + '" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + "><span>" + label + "</span>" + ARROW + "</a>";
const TICK = ["One payment", "Every share", "Nobody\u2019s business", "Testnet", "ZIP-321"];
const tickGroup = '<span class="cf-tick-g">' + [...TICK, ...TICK].map((w) => "<span>" + w + "</span><i></i>").join("") + "</span>";
const WORD = "BonBagi".split("").map((c, i) => '<b class="cf-l' + (i >= 3 ? " cf-l--g" : "") + '">' + c + "</b>").join("");
const LUNAS =
  '<svg class="cf-stamp" viewBox="0 0 240 112" aria-hidden="true">' +
    '<g filter="url(#cl-ink)">' +
      '<rect x="7" y="7" width="226" height="98" rx="16" fill="none" stroke="#c0341d" stroke-width="7"/>' +
      '<rect x="19" y="19" width="202" height="74" rx="8" fill="none" stroke="#c0341d" stroke-width="2.4"/>' +
      '<text class="cf-stamp-t" x="120" y="80" text-anchor="middle" fill="#c0341d">LUNAS</text>' +
    "</g>" +
  "</svg>";

const TEMPLATE =
  '<svg class="cl-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
    '<radialGradient id="cl-wax" cx="38%" cy="32%" r="74%"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".3" stop-color="#f7c23e"/><stop offset=".66" stop-color="#e09e17"/><stop offset="1" stop-color="#9a6207"/></radialGradient>' +
    '<radialGradient id="cl-face" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#fbcf55"/><stop offset=".7" stop-color="#ebaa20"/><stop offset="1" stop-color="#d3910f"/></radialGradient>' +
    '<linearGradient id="cl-rim-in" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a6006"/><stop offset=".5" stop-color="#e7a51e"/><stop offset="1" stop-color="#fff0c4"/></linearGradient>' +
    '<linearGradient id="cl-rim-out" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3cc"/><stop offset=".45" stop-color="#f0b330"/><stop offset="1" stop-color="#8e5905"/></linearGradient>' +
    '<radialGradient id="cl-gloss" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="cl-foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6212"/><stop offset=".45" stop-color="#f4b728"/><stop offset=".55" stop-color="#ffe9a8"/><stop offset="1" stop-color="#8a6212"/></linearGradient>' +
    '<filter id="cl-wx0" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G"/></filter>' +
    '<filter id="cl-wx1" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="11"/><feDisplacementMap in="SourceGraphic" scale="11" xChannelSelector="R" yChannelSelector="G"/></filter>' +
    '<filter id="cl-ink" x="-4%" y="-6%" width="108%" height="112%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.25" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="s"/><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="2" result="w"/><feDisplacementMap in="s" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G"/></filter>' +
    '<filter id="cl-wx2" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="27"/><feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G"/></filter>' +
  "</defs></svg>" +
  '<div class="close-track">' +
    '<div class="stage">' +
      '<div class="backdrop"></div>' +
      '<div class="shadows"><div class="ambient"></div></div>' +
      '<div class="camera"><div class="world" aria-hidden="true"></div></div>' +
      '<h2 class="close-line"><span class="cl-s">Signed by everyone.</span> <span class="cl-s">Paid at once.</span><br class="cl-br"> <span class="cl-s"><em>Read by no one else.</em></span></h2>' +
      '<p class="sr-only">The signed charter splits one 0.0100 ZEC payment: Ayu 40% (0.0040 ZEC), Bima 30% (0.0030 ZEC), Citra 30% (0.0030 ZEC). Each share arrives with an encrypted memo only its member can read.</p>' +
      '<div class="grain"></div>' +
    "</div>" +
  "</div>" +
  '<footer class="close-foot">' +
    '<div class="cf-bon">' +
      '<div class="cf-main">' +
        '<p class="cf-line">' +
          '<span class="cf-ln cf-brand">BonBagi.</span> ' +
          '<span class="cf-ln">One <span class="cf-w">payment.<i class="cf-u"></i></span></span> ' +
          '<span class="cf-ln">Every <span class="cf-w">share.<i class="cf-u"></i></span></span> ' +
          '<span class="cf-ln"><span class="cf-w">Nobody\u2019s business.<i class="cf-u"></i></span></span>' +
        "</p>" +
        '<div class="cf-side">' + LUNAS +
          '<nav class="cf-chips" aria-label="More BonBagi">' +
            chip("/demo.mp4", "Demo video", "gold") + chip("https://github.com/BonBagi", "GitHub", "ink", true) + chip("./pay.html", "Pay", "mint") +
            chip("./charter.html", "Charter", "paper") + chip("./gate.html", "Raw request", "gold") + chip("/try", "Try to cheat", "stamp") +
          "</nav>" +
        "</div>" +
      "</div>" +
      '<div class="cf-perf" aria-hidden="true"></div>' +
    "</div>" +
    '<div class="cf-tick">' +
      '<div class="cf-tick-track" aria-hidden="true">' + tickGroup + tickGroup + "</div>" +
      '<button class="cf-tick-btn" type="button" aria-pressed="false" aria-label="Pause the ticker">' +
        '<svg class="cf-ic-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
        '<svg class="cf-ic-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/></svg>' +
      "</button>" +
    "</div>" +
    '<div class="cf-night">' +
      '<div class="cf-meta">' +
        '<p class="cf-team"><span class="cf-seals">' + sealSvg("D", "cl-wx0", "cf-seal") + sealSvg("H", "cl-wx1", "cf-seal") + sealSvg("D", "cl-wx2", "cf-seal") + "</span><span>Dex Bennett \u00b7 Hans \u00b7 Dave</span></p>" +
      "</div>" +
      '<div class="cf-mark" aria-hidden="true"><span class="cf-mark-in">' + WORD + "</span></div>" +
    "</div>" +
  "</footer>";

/* ---------- math (column-major 4×4, same convention as CSS matrix3d) ---------- */
type M4 = Float64Array;
type V3 = [number, number, number];
const RAD = Math.PI / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mul(a: M4, b: M4): M4 {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4]!, b1 = b[c * 4 + 1]!, b2 = b[c * 4 + 2]!, b3 = b[c * 4 + 3]!;
    for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r]! * b0 + a[4 + r]! * b1 + a[8 + r]! * b2 + a[12 + r]! * b3;
  }
  return o;
}
const Tm = (x: number, y: number, z: number): M4 => new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const Sm = (s: number): M4 => new Float64Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
function RXm(d: number): M4 { const a = d * RAD, c = Math.cos(a), s = Math.sin(a); return new Float64Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
function RYm(d: number): M4 { const a = d * RAD, c = Math.cos(a), s = Math.sin(a); return new Float64Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
function RZm(d: number): M4 { const a = d * RAD, c = Math.cos(a), s = Math.sin(a); return new Float64Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
const chain = (...ms: M4[]): M4 => ms.reduce((acc, m) => mul(acc, m));
const ap = (m: M4, x: number, y: number, z: number): V3 => [
  m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
  m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
  m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
];
const css = (m: M4) => "matrix3d(" + Array.from(m, (v) => (Math.abs(v) < 1e-7 ? 0 : +v.toFixed(5))).join(",") + ")";
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const LIGHT = norm([-0.42, -0.76, 0.52]); // key light: top-left-front (y is down)
const CORNERS: [number, number][] = [[-210, -99], [210, -99], [210, 99], [-210, 99]];

interface Pose { x: number; y: number; z: number; s: number; rx: number; ry: number; rz: number }
interface Layout { vw: number; vh: number; mob: boolean; P: number; fy: number; rest: Pose; mid: Pose; cards: Pose[]; shift: number }
interface Panel {
  el: HTMLElement; sh: HTMLElement; front: HTMLElement; back: HTMLElement; cipher: HTMLElement;
  sealBody: HTMLElement; sealSh: HTMLElement; sealRing: HTMLElement; spill: SVGGElement;
  final: string; scr: number; scrNext: number; locked: boolean; seal: number;
}

function sealState(u: number) {
  const s = { vis: 1, sc: 1, sh: 0, shO: 0.34, bl: 0, spill: 1, ring: 1, ringO: 0, dip: 0 };
  if (u <= 0) { s.vis = 0; return s; }
  if (u < 0.3) {
    const d = u / 0.3, d2 = d * d;
    s.vis = clamp(u / 0.1); s.sc = 1.85 - 0.85 * d2; s.sh = (1 - d2) * 20; s.shO = 0.1 + 0.24 * d2; s.bl = (1 - d2) * 9; s.spill = 0.68;
    return s;
  }
  const v = u - 0.3, rv = clamp(v / 0.75);
  s.sc = 1 - 0.09 * Math.exp(-8 * v) * Math.cos(20 * v);
  s.spill = 0.68 + 0.32 * (1 - Math.exp(-10 * v));
  s.ring = 1 + 1.15 * eo(rv); s.ringO = 0.7 * (1 - rv);
  s.dip = -10 * Math.exp(-7 * v) * Math.sin(17 * v);
  return s;
}

export function mount(root: HTMLElement): void {
  root.innerHTML = TEMPLATE;
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const track = q<HTMLElement>(".close-track"), stage = q<HTMLElement>(".stage");
  const camera = q<HTMLElement>(".camera"), world = q<HTMLElement>(".world");
  const shadowsEl = q<HTMLElement>(".shadows"), ambient = q<HTMLElement>(".ambient");
  const backdrop = q<HTMLElement>(".backdrop"), line = q<HTMLElement>(".close-line");
  const spans = Array.from(root.querySelectorAll<HTMLElement>(".cl-s"));

  /* build the three thirds of the sheet */
  const panels: Panel[] = MEMBERS.map((m, i) => {
    const el = document.createElement("div");
    el.className = "panel";
    const no = "0" + (i + 1) + " / 03";
    const creases = (i > 0 ? '<i class="crease t"></i>' : "") + (i < 2 ? '<i class="crease b"></i>' : "");
    const final = cipher(91 + i * 17);
    el.innerHTML =
      '<div class="face front">' +
        '<div class="kick"><span>Charter · Demo collective</span><span>' + no + "</span></div>" +
        '<div class="seal"><div class="seal-sh"></div><div class="seal-ring"></div><div class="seal-body">' + sealSvg(m.i, "cl-wx" + i, "seal-svg") + "</div></div>" +
        '<div class="who"><div class="name">' + m.n + '</div><div class="addr">' + m.a + "</div></div>" +
        '<div class="share">' + m.s + "<small>%</small></div>" +
        '<div class="amt">' + m.z + "</div>" + creases +
        '<i class="ov shade"></i><i class="ov lite"></i><i class="ov sheen"></i>' +
      "</div>" +
      '<div class="face back">' +
        '<div class="bk-top"><b>Encrypted memo</b><span>' + no + "</span></div>" +
        '<div class="cipher">' + final + "</div>" +
        '<div class="rosette"><svg viewBox="0 0 132 132" aria-hidden="true"><path d="' + rosette([96, 90, 84][i]!, 33, [40, 37, 41][i]!) + '" fill="none" stroke="url(#cl-foil)" stroke-width=".55" opacity=".55"/></svg><span>' + m.i + "</span></div>" +
        '<div class="only">Only ' + m.n + " can read this.</div>" +
        '<i class="ov shade"></i><i class="ov lite"></i><i class="ov sheen"></i>' +
      "</div>" +
      '<i class="edge l"></i><i class="edge r"></i><i class="edge t"></i><i class="edge b"></i>';
    world.appendChild(el);
    const sh = document.createElement("div");
    sh.className = "shadow";
    shadowsEl.appendChild(sh);
    const g = (sel: string) => el.querySelector<HTMLElement>(sel)!;
    return {
      el, sh, front: g(".front"), back: g(".back"), cipher: g(".cipher"),
      sealBody: g(".seal-body"), sealSh: g(".seal-sh"), sealRing: g(".seal-ring"), spill: el.querySelector<SVGGElement>(".spill")!,
      final, scr: 0, scrNext: 0, locked: true, seal: reduced ? 2 : 0,
    };
  });

  /* layout, recomputed when the viewport changes or fonts land */
  let L: Layout | null = null;
  let dirty = true;
  if (document.fonts) void document.fonts.ready.then(() => { dirty = true; });
  function layout(vw: number, vh: number): Layout {
    const mob = vw < 760, P = mob ? 1250 : 1700;
    camera.style.perspective = P + "px";
    const lineBottom = line.offsetTop + line.offsetHeight - vh / 2; // world y of the whole line's bottom
    const first = spans[0]!, firstBottom = line.offsetTop + first.offsetTop + first.offsetHeight - vh / 2;
    if (!mob) {
      const top = Math.max(firstBottom + 30, -vh / 2 + 150);           // only sentence 1 is up while the seals press
      const s = clamp((vh / 2 - 70 - top) / 594, 0.5, 1);
      const cs = clamp(vw / 1650, 0.55, 0.9), sp = Math.min(vw * 0.3, 450);
      const cy = Math.max(60, lineBottom + 40 + 110 * cs);
      const ms = clamp((vh - 300) / 594, 0.45, 0.92);
      // while only sentence 1 is up, slide line 1 so it sits centred; sentence 2 arrives and it settles
      const s2 = spans[1]!, shift = (s2.offsetLeft + s2.offsetWidth - (first.offsetLeft + first.offsetWidth)) / 2;
      return {
        vw, vh, mob, P, fy: vh * 0.5 - 40, shift,
        rest: { x: 0, y: top + 297 * s + 6, z: 0, s, rx: 10, ry: -15, rz: 2.5 },
        mid: { x: 0, y: Math.max(cy, top + 297 * ms * 0.92), z: 0, s: ms, rx: 9, ry: 30, rz: -1.5 },
        cards: [
          { x: -sp, y: cy + 16, z: -90, s: cs, rx: 5, ry: 19, rz: -2.5 },
          { x: 0, y: cy - 12, z: 70, s: cs, rx: 4, ry: 0, rz: 1.2 },
          { x: sp, y: cy + 30, z: -40, s: cs, rx: 6, ry: -19, rz: 2.8 },
        ],
      };
    }
    const avail = vh / 2 - lineBottom - 34;
    const s = Math.min((avail - 10) / 600, (vw * 0.74) / 420);
    const cy0 = lineBottom + 24 + avail / 2;
    const cs = Math.min((vw * 0.8) / 420, 0.78), gap = Math.min(198 * cs + 20, (avail - 198 * cs) / 2);
    return {
      vw, vh, mob, P, fy: vh * 0.5 - 22, shift: 0,
      rest: { x: 4, y: cy0, z: 0, s, rx: 11, ry: -11, rz: 2 },
      mid: { x: 0, y: cy0, z: 0, s: Math.min((vw * 0.64) / 420, (avail * 0.86) / 594), rx: 10, ry: 26, rz: -1.5 },
      cards: [
        { x: -8, y: cy0 - gap, z: -50, s: cs, rx: 9, ry: 9, rz: -2 },
        { x: 8, y: cy0, z: 40, s: cs, rx: 7, ry: -7, rz: 1.2 },
        { x: -4, y: cy0 + gap, z: -20, s: cs, rx: 9, ry: 8, rz: 2 },
      ],
    };
  }

  /* pointer parallax (fine pointers only) */
  let tmx = 0, tmy = 0, mx = 0, my = 0, enter = reduced ? 1 : 0;
  if (!reduced && matchMedia("(hover:hover) and (pointer:fine)").matches) {
    addEventListener("pointermove", (e) => { tmx = (e.clientX / innerWidth) * 2 - 1; tmy = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  }
  const quantize = (p: number) => (p < 0.28 ? 0 : p < 0.66 ? 0.53 : 1);
  let lastVW = 0, lastVH = 0;

  scene(track, (praw, { time, dt, vw, vh }) => {
    if (dirty || vw !== lastVW || vh !== lastVH || !L) { L = layout(stage.clientWidth || vw, stage.clientHeight || vh); lastVW = vw; lastVH = vh; dirty = false; }
    const lay = L;
    const p = reduced ? quantize(praw) : praw;
    const sec = dt / 1000, t = time / 1000, idle = reduced ? 0 : 1;
    const cx = lay.vw / 2, cy = lay.vh / 2, P = lay.P, fy = lay.fy;

    // entrance: the sheet swings up into view while the section scrolls in
    if (!reduced) {
      const top = track.getBoundingClientRect().top;
      const target = clamp(1 - top / vh);
      enter += (target - enter) * (1 - Math.pow(1 - 0.12, dt / 16.7));
      const a = 1 - Math.pow(1 - 0.06, dt / 16.7);
      mx += (tmx - mx) * a; my += (tmy - my) * a;
    }
    const r = 1 - eo(clamp(enter));

    // seals: each one is triggered by scroll, then plays on its own clock (and lifts off if you scroll back)
    let dip = 0;
    panels.forEach((pn, i) => {
      if (!reduced) pn.seal = enter >= SEAL_ENTER[i]! ? Math.min(2, pn.seal + sec) : Math.max(0, pn.seal - sec * 2);
      const s = sealState(pn.seal);
      dip += s.dip;
      pn.sealBody.style.opacity = s.vis.toFixed(3);
      pn.sealBody.style.transform = "scale(" + s.sc.toFixed(4) + ")";
      pn.sealSh.style.opacity = (s.shO * s.vis).toFixed(3);
      pn.sealSh.style.transform = "translate(" + (2 + s.sh * 0.45).toFixed(1) + "px," + (4 + s.sh).toFixed(1) + "px) scale(" + (1 + s.sh / 30).toFixed(3) + ")";
      pn.sealSh.style.filter = s.bl > 0.2 ? "blur(" + s.bl.toFixed(1) + "px)" : "";
      pn.spill.style.transform = "scale(" + s.spill.toFixed(3) + ")";
      pn.sealRing.style.opacity = s.ringO.toFixed(3);
      pn.sealRing.style.transform = "scale(" + s.ring.toFixed(3) + ")";
    });

    // the closing line builds one sentence per beat
    const k2 = eio(seg(p, LINE[1][0] - 0.02, LINE[1][1]));
    spans.forEach((el, i) => {
      const k = i === 0 ? eo(seg(reduced ? 1 : enter, LINE1_ENTER[0], LINE1_ENTER[1])) : eo(seg(p, LINE[i]![0], LINE[i]![1]));
      const dx = i < 2 ? lay.shift * (1 - k2) : 0;
      el.style.opacity = k.toFixed(3);
      el.style.transform = "translate3d(" + dx.toFixed(1) + "px," + ((1 - k) * 18).toFixed(1) + "px,0)";
    });

    // sheet pose: rest (seals) → centre, turned three-quarter for the fold
    const m = eio(seg(p, POSE[0], POSE[1]));
    const R = lay.rest, M0 = lay.mid;
    const sp: Pose = {
      x: lerp(R.x, M0.x, m), y: lerp(R.y, M0.y, m) + 140 * r, z: lerp(R.z, M0.z, m) - 520 * r + dip, s: lerp(R.s, M0.s, m),
      rx: lerp(R.rx, M0.rx, m) + 50 * r + dip * 0.18, ry: lerp(R.ry, M0.ry, m) - 46 * r, rz: lerp(R.rz, M0.rz, m) - 12 * r,
    };
    sp.y += Math.sin(t * 1.05) * 5 * idle;
    sp.rx += Math.sin(t * 0.7) * 1.1 * idle;
    sp.ry += Math.sin(t * 0.53 + 1.3) * 1.7 * idle;
    const op = reduced ? 1 : clamp(enter * 1.8);
    world.style.opacity = op.toFixed(3);

    const fold = 8 + 42 * eio(seg(p, FOLD[0], FOLD[1]));
    const W = chain(RXm(-my * 2.2), RYm(mx * 3.4));
    const amt = (p >= AMT[1] ? 1 : seg(p, AMT[0], AMT[1])).toFixed(3); // rests at full opacity
    const drift = eio(seg(p, 0.84, 1));

    let ax0 = 1e9, ax1 = -1e9, ay = 0, aa = 0;
    panels.forEach((pn, i) => {
      const C = lay.cards[i]!;
      const k = eio(seg(p, SPLIT[0] + i * 0.012, SPLIT[1] + i * 0.012));
      const f = eio(seg(p, FLIP0 + i * FLIP_STAG, FLIP0 + FLIP_LEN + i * FLIP_STAG));
      const lift = Math.sin(Math.PI * k) * 140 + Math.sin(Math.PI * f) * 80;
      const ci = idle * k;
      const cxT = C.x * (1 - 0.07 * drift), cyT = C.y + Math.sin(t * 0.9 + i * 2.1) * 4 * ci;
      const X = lerp(sp.x, cxT, k), Y = lerp(sp.y, cyT, k), Z = lerp(sp.z, C.z, k) + lift;
      const s = lerp(sp.s, C.s, k);
      const rx = lerp(sp.rx, C.rx, k), ry = lerp(sp.ry, C.ry * (1 - 0.35 * drift) + Math.sin(t * 0.6 + i) * 1.2 * ci, k), rz = lerp(sp.rz, C.rz, k);
      // the thirds open flat in the first third of the split, so no panel ever lies edge-on mid-air
      const oy = (i - 1) * 198 * (1 - k), h = fold * (1 - eo(clamp(k * 3)));
      let M = chain(W, Tm(X, Y, Z), Sm(s), RXm(rx), RYm(ry), RZm(rz), Tm(0, oy, 0));
      if (i === 0) M = chain(M, Tm(0, 99, 0), RXm(-h), Tm(0, -99, 0));
      if (i === 2) M = chain(M, Tm(0, -99, 0), RXm(h), Tm(0, 99, 0));
      M = mul(M, RYm(180 * f));
      pn.el.style.transform = css(M);

      // lighting from the card's real normal
      const n = norm([M[8]!, M[9]!, M[10]!]), c: V3 = [M[12]!, M[13]!, M[14]!];
      const V = norm([-c[0], -c[1], P - c[2]]);
      const H = norm([LIGHT[0] + V[0], LIGHT[1] + V[1], LIGHT[2] + V[2]]);
      const faces: [HTMLElement, V3][] = [[pn.front, n], [pn.back, [-n[0], -n[1], -n[2]]]];
      for (const [face, nn] of faces) {
        const b = dot(nn, LIGHT), spc = Math.pow(Math.max(0, dot(nn, H)), 14), st = face.style;
        st.setProperty("--sh", clamp((0.56 - b) * 0.34, 0, 0.27).toFixed(3));
        st.setProperty("--li", clamp((b - 0.61) * 0.4, 0, 0.16).toFixed(3));
        st.setProperty("--sp", (spc * 0.5).toFixed(3));
        st.setProperty("--sx", (50 - nn[0] * 190).toFixed(1) + "%");
        st.setProperty("--sy", (50 - nn[1] * 190).toFixed(1) + "%");
      }
      const fs = pn.front.style;
      fs.setProperty("--gx", (-n[0] * 9).toFixed(2) + "px");
      fs.setProperty("--gy", (-n[1] * 9).toFixed(2) + "px");
      fs.setProperty("--amt", amt);
      fs.setProperty("--cr", (0.2 + 0.8 * (fold / 50) * (1 - k)).toFixed(3));
      pn.back.style.setProperty("--fx", (50 + n[0] * 160 + n[1] * 40).toFixed(1) + "%");

      // the memo "encrypts" as the back comes into view
      if (f > 0.5 && !reduced) {
        if (pn.scr < 0.75) {
          pn.scr += sec;
          if (pn.scr >= pn.scrNext) { pn.cipher.textContent = scramble(pn.final, clamp(pn.scr / 0.75)); pn.scrNext = pn.scr + 0.055; pn.locked = false; }
        } else if (!pn.locked) { pn.cipher.textContent = pn.final; pn.locked = true; }
      } else if (f < 0.45 && pn.scr > 0) {
        pn.scr = 0; pn.scrNext = 0;
        if (!pn.locked) { pn.cipher.textContent = pn.final; pn.locked = true; }
      }

      // soft floor shadow: card corners → floor (along the light) → screen
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [lx, ly] of CORNERS) {
        const w = ap(M, lx, ly, 0), hgt = fy - w[1];
        const gx = w[0] + 0.16 * hgt, gz = w[2] + 0.12 * hgt;
        const qq = P / (P - gz), sx = cx + gx * qq, sy = cy + fy * qq;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
      const hc = Math.max(0, fy - c[1]);
      const a = 0.26 * clamp(1.15 - hc / 900, 0.25, 1) * op;
      const pad = 14 + hc * 0.085;
      const ss = pn.sh.style;
      ss.width = (x1 - x0 + pad * 2).toFixed(1) + "px";
      ss.height = (y1 - y0 + pad * 0.6 + 8).toFixed(1) + "px";
      ss.transform = "translate3d(" + (x0 - pad).toFixed(1) + "px," + (y0 - pad * 0.3 - 4).toFixed(1) + "px,0)";
      ss.setProperty("--a", a.toFixed(3));
      ax0 = Math.min(ax0, x0); ax1 = Math.max(ax1, x1); ay = Math.max(ay, y1); aa += a / 3;
    });
    const aw = (ax1 - ax0) * 1.5 + 200, ah = 90, as = ambient.style;
    as.width = aw.toFixed(0) + "px"; as.height = ah + "px";
    as.transform = "translate3d(" + ((ax0 + ax1) / 2 - aw / 2).toFixed(1) + "px," + (ay - ah * 0.62).toFixed(1) + "px,0)";
    as.opacity = (aa * 1.4).toFixed(3);

    backdrop.style.setProperty("--kx", lerp(54, 50, m).toFixed(1) + "%");

  });

  mountFooter(root);
}

/* ---------- footer: the curtain call ----------
   A cream receipt (scene 1) tears in over the studio floor with sticker links and a LUNAS
   stamp (scene 2), a gold ticker runs across the seam, and the night field (scene 4) holds
   the team's wax seals (scene 5) and a giant edge-to-edge wordmark. It all plays once, on entry. */
function mountFooter(root: HTMLElement): void {
  const foot = root.querySelector<HTMLElement>(".close-foot")!;
  const night = root.querySelector<HTMLElement>(".cf-night")!;
  const tick = root.querySelector<HTMLElement>(".cf-tick")!;
  const btn = root.querySelector<HTMLButtonElement>(".cf-tick-btn")!;
  const mark = root.querySelector<HTMLElement>(".cf-mark")!, markIn = root.querySelector<HTMLElement>(".cf-mark-in")!;

  // the wordmark runs edge to edge: measure at a reference size, then scale to the field width
  const fit = () => {
    markIn.style.fontSize = "100px";
    const w = markIn.getBoundingClientRect().width || 1;
    const fsz = (100 * mark.clientWidth) / w;
    markIn.style.fontSize = fsz.toFixed(2) + "px";
    mark.style.height = (fsz * 0.62).toFixed(1) + "px";
  };
  fit();
  addEventListener("resize", fit, { passive: true });
  if (document.fonts) void document.fonts.ready.then(fit);

  btn.addEventListener("click", () => {
    const paused = tick.classList.toggle("is-paused");
    btn.setAttribute("aria-pressed", String(paused));
    btn.setAttribute("aria-label", paused ? "Play the ticker" : "Pause the ticker");
  });

  if (reduced || !("IntersectionObserver" in window)) {
    foot.classList.add("is-static", "is-in");
    night.classList.add("is-in");
    return;
  }
  const once = (el: HTMLElement, threshold: number) => {
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { el.classList.add("is-in"); io.disconnect(); }
    }, { threshold });
    io.observe(el);
  };
  once(foot, 0.08);
  once(night, 0.3);
  // the ticker only runs while it is on screen
  new IntersectionObserver((es) => { for (const e of es) tick.classList.toggle("is-run", e.isIntersecting); }).observe(tick);
}
