import "./sec-market.css";
import { scene, seg, easeInOut, easeOut, clamp, reduced } from "./scroll";

/* Scene 3 · How it works, as an isometric market in daylight.
   The world is drawn ONCE into one SVG (static layer). The camera is a single CSS transform on
   its wrapper (compositor only). Moving things are small separate sprites driven by transforms
   and opacity. Idle life is CSS animation, paused while the scene is off screen. At the end the
   sky goes dusk → night and the string lights come on, handing over to the dark scene 4. */

type Pt = [number, number];
type V3 = [number, number, number];

/* ---------- iso helpers: x → down-right, y → down-left, z → up ---------- */
const C = 0.8660254, S = 0.5;
const P = (x: number, y: number, z = 0): Pt => [(x - y) * C, (x + y) * S - z];
const R = (n: number): number => Math.round(n * 1000) / 1000;
const pstr = (a: number[][]): string => a.map((q) => { const p = P(q[0] ?? 0, q[1] ?? 0, q[2] ?? 0); return `${R(p[0])},${R(p[1])}`; }).join(" ");
const poly = (a: number[][], f: string, x = ""): string => `<polygon points="${pstr(a)}" fill="${f}" ${x}/>`;
const ln = (a: V3, b: V3, st: string, w: number, x = ""): string => {
  const p = P(...a), q = P(...b);
  return `<line x1="${R(p[0])}" y1="${R(p[1])}" x2="${R(q[0])}" y2="${R(q[1])}" stroke="${st}" stroke-width="${w}" stroke-linecap="round" ${x}/>`;
};
const h2r = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
const r2h = (a: number[]): string => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number): string => { const A = h2r(a), B = h2r(b); return r2h(A.map((v, i) => v + ((B[i] ?? 0) - v) * t)); };
const SUN = "#fff6e2", SHADE = "#3b2a1c";
interface Mat { t: string; r: string; l: string }
const mat = (c: string): Mat => ({ t: mix(c, SUN, 0.26), r: c, l: mix(c, SHADE, 0.3) });
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: Mat): string {
  return poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], m.r)
    + poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], m.l)
    + poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], m.t);
}
const mtx = (a: number, b: number, c: number, d: number, p: Pt): string => `matrix(${a},${b},${c},${d},${R(p[0])},${R(p[1])})`;
const MR = (x: number, y: number, z: number): string => mtx(C, -S, 0, 1, P(x, y, z)); // face x=const, reads toward -y
const ML = (x: number, y: number, z: number): string => mtx(C, S, 0, 1, P(x, y, z));  // face y=const, reads toward +x
const MT = (x: number, y: number, z: number): string => mtx(C, -S, C, S, P(x, y, z)); // top face
const ell = (x: number, y: number, z: number, r: number, f: string, x2 = ""): string => {
  const p = P(x, y, z);
  return `<ellipse cx="${R(p[0])}" cy="${R(p[1])}" rx="${R(r * 1.2247)}" ry="${R(r * 0.7071)}" fill="${f}" ${x2}/>`;
};
function cyl(x: number, y: number, z0: number, z1: number, r: number, side: string, top: string): string {
  const b = P(x, y, z0), t = P(x, y, z1), rx = R(r * 1.2247), ry = R(r * 0.7071);
  return `<path d="M${R(b[0] - rx)},${R(t[1])}L${R(b[0] - rx)},${R(b[1])}A${rx},${ry} 0 0 0 ${R(b[0] + rx)},${R(b[1])}L${R(b[0] + rx)},${R(t[1])}Z" fill="${side}"/><ellipse cx="${R(t[0])}" cy="${R(t[1])}" rx="${rx}" ry="${ry}" fill="${top}"/>`;
}
let seed = 11;
const rnd = (): number => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (A: V3, B: V3, t: number): V3 => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
const smooth = (a: number, b: number, t: number): number => { const u = seg(t, a, b); return u * u * (3 - 2 * u); };
const band = (p: number, a: number, b: number, f = 0.02): number => smooth(a - f, a + f, p) * (1 - smooth(b - f, b + f, p));

/* ---------- the market ---------- */
const X1 = 13.6, Y1 = 10, ZB = -1.7;
const MX = [8.0, 10.2, 12.4];
const NAMES = ["Ayu", "Bima", "Citra"];
const SHARES = ["40%", "30%", "30%"];
const AMTS = ["0.0040", "0.0030", "0.0030"];
const MCOL = ["#3e9e8f", "#e2a133", "#cd6a80"];
const SHIRT = ["#f3ead8", "#3f6fa8", "#7d4f9e"];
const VB = [-9.4, -6.5, 22.4, 20.8]; // world viewBox in projected units
const HAND: V3 = [5.554, 6.886, 1.25], LAND: V3 = [4.62, 6.05, 1.02], SLOT: V3 = [4.84, 5.8, 1.0];
const BR: V3[][] = [
  [[8.2, 5.8, 0], [8.0, 5.0, 0], [8.0, 3.25, 0]],
  [[8.2, 5.8, 0], [9.0, 5.6, 0], [10.2, 5.6, 0], [10.2, 3.25, 0]],
  [[8.2, 5.8, 0], [9.0, 6.2, 0], [12.4, 6.2, 0], [12.4, 3.25, 0]],
];
const SEGS = [[5.1, 5.8, 7.4, 5.8], [8.0, 4.95, 8.0, 3.25], [9.05, 5.6, 10.2, 5.6], [10.2, 5.6, 10.2, 3.25], [9.05, 6.2, 12.4, 6.2], [12.4, 6.2, 12.4, 3.25]];
const CHW = 0.36;
const SHD: Pt = [0.1, 0.62]; // ground shift of a shadow per unit of height (sun behind-right)

const rectG = (x0: number, y0: number, x1: number, y1: number, z: number, f: string, x = ""): string => poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], f, x);
const segRect = (s: number[], w: number): number[] => {
  const x0 = s[0] ?? 0, y0 = s[1] ?? 0, x1 = s[2] ?? 0, y1 = s[3] ?? 0, h = w / 2;
  return [Math.min(x0, x1) - h, Math.min(y0, y1) - h, Math.max(x0, x1) + h, Math.max(y0, y1) + h];
};
function hull(pts: Pt[]): Pt[] {
  const a = [...pts].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o: Pt, p: Pt, q: Pt) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const p of a) { while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, p) <= 0) lo.pop(); lo.push(p); }
  for (const p of a.reverse()) { while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const shRect = (x0: number, y0: number, x1: number, y1: number, h0: number, h1: number): string => {
  const c: Pt[] = [];
  for (const h of [h0, h1]) for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]) c.push([x + SHD[0] * h, y + SHD[1] * h]);
  return `<polygon points="${pstr(hull(c).map((q) => [q[0], q[1], 0]))}"/>`;
};
const shPole = (x: number, y: number, h: number): string => { const a = P(x, y), b = P(x + SHD[0] * h, y + SHD[1] * h); return `<line x1="${R(a[0])}" y1="${R(a[1])}" x2="${R(b[0])}" y2="${R(b[1])}" stroke-width=".07" stroke-linecap="round"/>`; };

function shadows(): string {
  let s = shRect(0.85, 3.45, 4.95, 8.12, 0, 3.4) + shRect(2.86, 3.95, 2.97, 7.65, 3.3, 4.15);
  for (const x of MX) s += shRect(x - 1, 0.75, x + 1, 2.68, 3.4, 3.66) + shRect(x - 0.75, 1.65, x + 0.75, 2.55, 0, 0.82);
  s += shRect(2.0, 8.65, 3.7, 9.35, 0, 1.6) + shRect(4.7, 3.28, 6.9, 3.4, 0.45, 2.35);
  for (const [x, y, h] of [[0.35, 0.35, 6], [13.25, 0.35, 6], [0.35, 9.65, 5.6]] as V3[]) s += shPole(x, y, h);
  for (const x of MX) for (const y of [0.85, 2.6]) for (const dx of [-0.9, 0.9]) s += shPole(x + dx, y, 3.5);
  for (const [x, y, h] of [[5.95, 6.75, 1.8], [7.2, 9.3, 1.8], [12.6, 8.0, 1.3], [x0m(0), 1.42, 1.8], [x0m(1), 1.42, 1.8], [x0m(2), 1.42, 1.8]] as V3[]) s += shRect(x - 0.2, y - 0.2, x + 0.2, y + 0.2, 0, h * 0.85);
  return `<g clip-path="url(#mk-clip-top)"><g filter="url(#mk-soft)" fill="#6b4a26" opacity=".2">${s}</g></g>`;
}
function x0m(i: number): number { return (MX[i] ?? 0) - 0.62; }

function slab(): string {
  let s = poly([[X1, 0, ZB], [X1, Y1, ZB], [X1, Y1, 0], [X1, 0, 0]], "url(#mk-soil-r)");
  s += poly([[0, Y1, ZB], [X1, Y1, ZB], [X1, Y1, 0], [0, Y1, 0]], "url(#mk-soil-l)");
  s += poly([[X1, 0, -0.34], [X1, Y1, -0.34], [X1, Y1, 0], [X1, 0, 0]], "#e3d6bd");
  s += poly([[0, Y1, -0.34], [X1, Y1, -0.34], [X1, Y1, 0], [0, Y1, 0]], "#cdbd9f");
  for (let i = 0; i < 30; i++) {
    const onR = rnd() < 0.45, z = -0.58 - rnd() * 0.95, r = 0.05 + rnd() * 0.1;
    s += onR
      ? `<ellipse transform="${MR(X1 + 0.001, 0.4 + rnd() * (Y1 - 0.8), z)}" rx="${R(r * 1.7)}" ry="${R(r)}" fill="#a77d55" opacity=".55"/>`
      : `<ellipse transform="${ML(0.4 + rnd() * (X1 - 0.8), Y1 + 0.001, z)}" rx="${R(r * 1.7)}" ry="${R(r)}" fill="#8e6948" opacity=".55"/>`;
  }
  s += poly([[0, 0, 0], [X1, 0, 0], [X1, Y1, 0], [0, Y1, 0]], "#efe7d6");
  let g = "";
  for (let x = 1; x < X1; x++) g += ln([x, 0, 0], [x, Y1, 0], "#7a6040", 0.018);
  for (let y = 1; y < Y1; y++) g += ln([0, y, 0], [X1, y, 0], "#7a6040", 0.018);
  s += `<g opacity=".13">${g}</g>`;
  s += `<polyline points="${pstr([[0, Y1, 0], [X1, Y1, 0], [X1, 0, 0]])}" fill="none" stroke="#fffaf0" stroke-width=".05"/>`;
  return s;
}

function frost(): string {
  let s = "", sp = "";
  SEGS.forEach((q) => { const r = segRect(q, CHW + 0.12); s += rectG(r[0]!, r[1]!, r[2]!, r[3]!, 0.002, "#8fa4b2"); });
  s += rectG(7.3, 4.9, 9.1, 6.7, 0.002, "#8fa4b2");
  const fr: Mat = { t: "#d6dee3", r: "#b5c2ca", l: "#97a6b0" };
  s += box(7.32, 4.92, 0, 9.08, 5.06, 0.07, fr) + box(7.32, 5.06, 0, 7.46, 6.54, 0.07, fr) + box(8.94, 5.06, 0, 9.08, 6.54, 0.07, fr) + box(7.32, 6.54, 0, 9.08, 6.68, 0.07, fr);
  s += rectG(7.46, 5.06, 8.94, 6.54, 0.072, "url(#mk-frost)");
  SEGS.forEach((q) => {
    const r = segRect(q, CHW);
    s += rectG(r[0]!, r[1]!, r[2]!, r[3]!, 0.01, "url(#mk-frost)");
    for (let i = 0; i < 9; i++) { const p = P(lerp(r[0]! + 0.05, r[2]! - 0.05, rnd()), lerp(r[1]! + 0.05, r[3]! - 0.05, rnd()), 0.012); sp += `<circle cx="${R(p[0])}" cy="${R(p[1])}" r="${R(0.014 + rnd() * 0.022)}"/>`; }
    s += q[1] === q[3] ? ln([r[0]!, r[3]!, 0.012], [r[2]!, r[3]!, 0.012], "#ffffff", 0.025) : ln([r[2]!, r[1]!, 0.012], [r[2]!, r[3]!, 0.012], "#ffffff", 0.025);
  });
  s += ell(8.2, 5.8, 0.074, 0.58, "none", 'stroke="#ffffff" stroke-width=".025"') + ell(8.2, 5.8, 0.074, 0.32, "none", 'stroke="#ffffff" stroke-opacity=".7" stroke-width=".02"');
  return s + `<g fill="#ffffff">${sp}</g>`;
}

interface Who { shirt: string; pants?: string; skin?: string; hair: string; hij?: string; arms: string; glasses?: boolean; s?: number; extra?: string }
function person(o: Who): string {
  const skin = o.skin ?? "#c98c5f", pants = o.pants ?? "#3a3f56", dk = mix(o.shirt, SHADE, 0.3);
  let s = `<g transform="scale(${o.s ?? 1})">`;
  s += `<rect x="-.15" y="-.66" width=".13" height=".66" rx=".05" fill="${pants}"/><rect x=".02" y="-.66" width=".13" height=".66" rx=".05" fill="${mix(pants, SHADE, 0.3)}"/>`;
  s += `<path d="M-.26,-.6 L-.28,-1.13 Q-.28,-1.31 -.1,-1.33 L.1,-1.33 Q.28,-1.31 .28,-1.13 L.26,-.6 Q0,-.54 -.26,-.6Z" fill="${o.shirt}"/>`;
  s += `<path d="M-.28,-1.13 Q-.28,-1.31 -.1,-1.33 L0,-1.33 L0,-.57 Q-.13,-.57 -.26,-.6Z" fill="${dk}" opacity=".45"/>`;
  const arm = (d: string) => `<path d="${d}" stroke="${dk}" stroke-width=".11" fill="none" stroke-linecap="round"/>`;
  const hand = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r=".058" fill="${skin}"/>`;
  if (o.arms === "reach") s += arm("M.24,-1.2 Q.33,-.95 .3,-.72") + hand(0.3, -0.7) + arm("M-.2,-1.22 Q-.34,-1.2 -.45,-1.3") + hand(-0.47, -1.31);
  else if (o.arms === "table") s += arm("M-.25,-1.2 Q-.34,-.95 -.18,-.86") + arm("M.25,-1.2 Q.34,-.95 .18,-.86") + hand(-0.16, -0.86) + hand(0.16, -0.86);
  else if (o.arms === "bag") s += arm("M-.25,-1.2 Q-.33,-.95 -.3,-.72") + hand(-0.3, -0.7) + arm("M.25,-1.2 Q.34,-.95 .32,-.74") + hand(0.32, -0.72) + `<path d="M.22,-.72 h.24 l-.02,.3 h-.2Z" fill="#e9d3a8"/><path d="M.27,-.72 q.07,-.12 .14,0" stroke="#b08f5a" stroke-width=".02" fill="none"/>`;
  else if (o.arms === "balloon") s += arm("M-.25,-1.2 Q-.33,-.95 -.3,-.72") + hand(-0.3, -0.7) + arm("M.24,-1.22 Q.38,-1.35 .4,-1.5") + hand(0.4, -1.52);
  else s += arm("M-.25,-1.2 Q-.34,-.95 -.3,-.72") + arm("M.25,-1.2 Q.34,-.95 .3,-.72") + hand(-0.3, -0.7) + hand(0.3, -0.7);
  if (o.hair === "hijab") s += `<path d="M-.28,-1.14 Q-.3,-1.81 0,-1.81 Q.3,-1.81 .28,-1.14 Q0,-1.04 -.28,-1.14Z" fill="${o.hij ?? "#2b5c56"}"/><ellipse cx="0" cy="-1.52" rx=".13" ry=".155" fill="${skin}"/>`;
  else {
    s += `<circle cx="0" cy="-1.53" r=".19" fill="${skin}"/><path d="M-.2,-1.53 Q-.21,-1.76 0,-1.76 Q.21,-1.76 .2,-1.55 Q.06,-1.64 -.2,-1.53Z" fill="#2a2220"/>`;
    if (o.hair === "peci") s += `<path d="M-.175,-1.6 L-.165,-1.81 Q0,-1.84 .165,-1.81 L.175,-1.6 Q0,-1.645 -.175,-1.6Z" fill="#1b1a20"/>`;
    if (o.hair === "cap") s += `<path d="M-.2,-1.59 Q-.19,-1.8 0,-1.8 Q.19,-1.8 .2,-1.59Z" fill="#c0341d"/><path d="M-.18,-1.6 L-.38,-1.57" stroke="#8e2615" stroke-width=".055" stroke-linecap="round"/>`;
  }
  s += `<circle cx="-.065" cy="-1.5" r=".02" fill="#241a16"/><circle cx=".065" cy="-1.5" r=".02" fill="#241a16"/>`;
  if (o.glasses) s += `<g fill="none" stroke="#1d1a22" stroke-width=".025"><circle cx="-.07" cy="-1.5" r=".055"/><circle cx=".07" cy="-1.5" r=".055"/><path d="M-.015,-1.5 h.03"/></g>`;
  return s + (o.extra ?? "") + "</g>";
}
const at = (x: number, y: number, z: number, inner: string): string => { const p = P(x, y, z); return `<g transform="translate(${R(p[0])},${R(p[1])})">${inner}</g>`; };
const footShadow = (x: number, y: number, r = 0.32): string => ell(x, y, 0.003, r, "#5a3d22", 'opacity=".22"');

function member(i: number): string {
  const x = MX[i]!, c = MCOL[i]!, pole = "#5a4a3e";
  let s = ln([x - 0.9, 0.85, 0], [x - 0.9, 0.85, 3.62], pole, 0.05) + ln([x + 0.9, 0.85, 0], [x + 0.9, 0.85, 3.62], pole, 0.05);
  s += footShadow(x0m(i), 1.42);
  s += at(x0m(i), 1.42, 0, person({ shirt: SHIRT[i]!, hair: ["hijab", "peci", "short"][i]!, hij: "#2f7d72", arms: "table", glasses: i === 2 }));
  s += box(x - 0.75, 1.65, 0, x + 0.75, 2.55, 0.82, { t: "#fffaf0", r: c, l: mix(c, SHADE, 0.28) });
  s += poly([[x - 0.75, 2.552, 0.12], [x + 0.75, 2.552, 0.12], [x + 0.75, 2.552, 0.19], [x - 0.75, 2.552, 0.19]], mix(c, "#ffffff", 0.45));
  s += `<text transform="${ML(x, 2.553, 0.3)}" class="mk-t-name" font-size=".42" text-anchor="middle" fill="#fffaf0">${NAMES[i]!.toUpperCase()}</text>`;
  s += cyl(x, 2.1, 0.82, 0.92, 0.28, "#9a6a43", "#6b4527") + ell(x, 2.1, 0.92, 0.28, "none", 'stroke="#c99a6c" stroke-width=".03"');
  const yf = 2.6, zf = 3.42, zb = 3.66, top = mix(c, SUN, 0.18);
  s += ln([x - 0.9, yf, 0], [x - 0.9, yf, zf], pole, 0.05) + ln([x + 0.9, yf, 0], [x + 0.9, yf, zf], pole, 0.05);
  s += poly([[x - 1, 0.75, zb], [x + 1, 0.75, zb], [x + 1, yf + 0.08, zf], [x - 1, yf + 0.08, zf]], top);
  for (const f of [-0.5, 0.5]) s += poly([[x + f - 0.16, 0.75, zb], [x + f + 0.16, 0.75, zb], [x + f + 0.16, yf + 0.08, zf], [x + f - 0.16, yf + 0.08, zf]], mix(top, "#ffffff", 0.45));
  s += poly([[x + 1, 0.75, zb], [x + 1, yf + 0.08, zf], [x + 1, yf + 0.08, zf - 0.08], [x + 1, 0.75, zb - 0.08]], mix(c, SHADE, 0.2));
  const N = 5, val = mix(c, SHADE, 0.12);
  for (let k = 0; k < N; k++) {
    const xa = x - 1 + (2 * k) / N, xb = x - 1 + (2 * (k + 1)) / N;
    const a = P(xa, yf + 0.08, zf), b = P(xb, yf + 0.08, zf), m = P((xa + xb) / 2, yf + 0.08, zf - 0.4);
    s += `<path d="M${R(a[0])},${R(a[1])} Q${R(m[0])},${R(m[1])} ${R(b[0])},${R(b[1])}Z" fill="${k % 2 ? "#fffaf0" : val}"/>`;
  }
  return s;
}
function spouts(): string {
  let s = "";
  for (const x of MX) s += ell(x, 3.25, 0.003, 0.26, "#8fa4b2") + cyl(x, 3.25, 0, 0.44, 0.17, "url(#mk-cyl)", "#eef5f8") + ell(x, 3.25, 0.441, 0.1, "#6d8291");
  return s;
}
function stall(): string {
  let s = box(1.0, 3.6, 0, 4.25, 7.95, 0.14, mat("#b98b5c"));
  s += box(1.0, 3.6, 0.14, 1.22, 7.95, 3.3, { t: "#c9a985", r: "#a9835d", l: "#8a6747" });
  s += box(1.0, 3.6, 0.14, 4.25, 3.8, 2.95, { t: "#d8bd98", r: "#c59f74", l: "#a9845d" });
  s += poly([[1.23, 3.9, 1.15], [1.23, 7.7, 1.15], [1.23, 7.7, 1.22], [1.23, 3.9, 1.22]], "#7b5a3c");
  for (let i = 0; i < 7; i++) s += cyl(1.42, 4.2 + i * 0.5, 1.22, 1.5, 0.09, i % 2 ? "#e0a253" : "#7fb5a6", i % 2 ? "#f3c98a" : "#b9dcd1");
  // the counter: self-serve, no cashier (no treasurer)
  s += box(4.2, 4.3, 0, 4.95, 7.3, 1.0, { t: "#e2b27d", r: "#c58b55", l: "#9a693f" });
  for (const z of [0.34, 0.67]) s += ln([4.951, 4.3, z], [4.951, 7.3, z], "#a8743f", 0.022);
  s += poly([[4.86, 4.3, 1.001], [4.95, 4.3, 1.001], [4.95, 7.3, 1.001], [4.86, 7.3, 1.001]], "#f0c995");
  s += poly([[4.76, 5.64, 1.003], [4.9, 5.64, 1.003], [4.9, 5.96, 1.003], [4.76, 5.96, 1.003]], "#3a2a1e");
  s += poly([[4.952, 5.6, 0], [4.952, 6.0, 0], [4.952, 6.0, 1.0], [4.952, 5.6, 1.0]], "#8fa4b2");
  s += poly([[5.1, 5.6, 0], [5.1, 6.0, 0], [5.1, 6.0, 0.99], [5.1, 5.6, 0.99]], "url(#mk-frost)");
  s += poly([[4.95, 6.0, 0], [5.1, 6.0, 0], [5.1, 6.0, 0.99], [4.95, 6.0, 0.99]], "#c3d3dd");
  s += poly([[4.95, 5.6, 0.99], [5.1, 5.6, 0.99], [5.1, 6.0, 0.99], [4.95, 6.0, 0.99]], "#f3f8fa");
  // QR stand (the pay link)
  s += box(4.52, 4.5, 1.0, 4.58, 4.98, 1.47, { t: "#d9d3c6", r: "#fbf8f1", l: "#cfc8ba" });
  let q = "";
  const finder = (r: number, c: number) => (r < 2 && c < 2) || (r < 2 && c > 2) || (r > 2 && c < 2);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (finder(r, c) || rnd() < 0.5) q += `<rect x="${R(c * 0.074)}" y="${R(r * 0.074)}" width=".074" height=".074"/>`;
  s += `<g transform="${MR(4.582, 4.92, 1.42)}" fill="#151515">${q}</g>`;
  // the bon (receipt)
  s += poly([[4.33, 6.3, 1.004], [4.84, 6.3, 1.004], [4.84, 7.0, 1.004], [4.33, 7.0, 1.004]], "#fffdf5");
  s += `<g transform="${MT(4.36, 6.96, 1.005)}" stroke="#b3a993" stroke-width=".018"><path d="M.06,.07 h.5 M.06,.13 h.32 M.06,.42 h.45"/></g>`;
  // near wall + chalk board
  s += box(1.0, 7.75, 0.14, 4.25, 7.95, 2.95, { t: "#d8bd98", r: "#c59f74", l: "#b48d63" });
  s += `<g transform="${ML(1.45, 7.953, 2.42)}"><rect x="0" y="0" width="2.35" height="1.0" rx=".04" fill="#2c3d36" stroke="#8a6440" stroke-width=".05"/><text x="1.175" y=".42" class="mk-t-chalk" font-size=".27" text-anchor="middle">PAY ONCE</text><text x="1.175" y=".79" class="mk-t-chalk" font-size=".27" text-anchor="middle">SPLIT TO ALL</text></g>`;
  // striped awning
  const rx0 = 0.85, rx1 = 4.42, rz0 = 3.42, rz1 = 2.94, ry0 = 3.45, ry1 = 8.12, N = 9;
  for (let i = 0; i < N; i++) { const ya = ry0 + ((ry1 - ry0) * i) / N, yb = ry0 + ((ry1 - ry0) * (i + 1)) / N; s += poly([[rx0, ya, rz0], [rx1, ya, rz1], [rx1, yb, rz1], [rx0, yb, rz0]], i % 2 ? "#fff6e6" : "#d4452b"); }
  s += poly([[rx0, ry1, rz0], [rx1, ry1, rz1], [rx1, ry1, rz1 - 0.09], [rx0, ry1, rz0 - 0.09]], "#9b2f1d");
  for (let i = 0; i < N; i++) {
    const ya = ry0 + ((ry1 - ry0) * i) / N, yb = ry0 + ((ry1 - ry0) * (i + 1)) / N;
    const a = P(rx1, ya, rz1), b = P(rx1, yb, rz1), m = P(rx1, (ya + yb) / 2, rz1 - 0.46);
    s += `<path d="M${R(a[0])},${R(a[1])} Q${R(m[0])},${R(m[1])} ${R(b[0])},${R(b[1])}Z" fill="${i % 2 ? "#efe3cc" : "#b83620"}"/>`;
  }
  s += ln([2.93, 4.6, 3.14], [2.93, 4.6, 3.3], "#4a3a2c", 0.06) + ln([2.93, 7.0, 3.14], [2.93, 7.0, 3.3], "#4a3a2c", 0.06);
  s += box(2.86, 3.95, 3.28, 2.97, 7.65, 4.14, { t: "#4a3a32", r: "#231c1a", l: "#352a26" });
  s += `<text transform="${MR(2.972, 5.8, 3.48)}" class="mk-t-sign" font-size=".6" text-anchor="middle" fill="#ffe7b0">ZCASH CLASS</text>`;
  for (let i = 0; i < 12; i++) { const y = 4.08 + i * 0.315; for (const z of [4.04, 3.37]) { const p = P(2.975, y, z); s += `<circle cx="${R(p[0])}" cy="${R(p[1])}" r=".042" fill="#fff1cc"/>`; } }
  s += ln([4.42, 7.72, 2.94], [4.42, 7.72, 2.5], "#4a3a2c", 0.02) + cyl(4.42, 7.72, 2.3, 2.5, 0.1, "#6b5038", "#87674a");
  return s;
}
function cart(): string {
  const x0 = 2.0, x1 = 3.7, y0 = 8.65, y1 = 9.35;
  let s = ln([x0, y0 + 0.12, 0.95], [1.35, y0 + 0.12, 0.7], "#8a6440", 0.06) + ln([x0, y1 - 0.12, 0.95], [1.35, y1 - 0.12, 0.7], "#8a6440", 0.06);
  s += box(x0, y0, 0.45, x1, y1, 1.18, { t: "#f1e4c6", r: "#4ba596", l: "#3a8478" });
  s += poly([[x0, y1 + 0.001, 0.95], [x1, y1 + 0.001, 0.95], [x1, y1 + 0.001, 1.0], [x0, y1 + 0.001, 1.0]], "#fffaf0");
  s += `<text transform="${ML(2.85, y1 + 0.002, 0.8)}" class="mk-t-chalk" font-size=".24" text-anchor="middle" fill="#fffaf0">GINGER TEA</text>`;
  s += box(3.05, 8.75, 1.18, 3.6, 9.25, 1.6, { t: "#eaf3f7", r: "#d4e4ec", l: "#bcd0db" }) + cyl(3.33, 9.0, 1.18, 1.36, 0.1, "#e0a253", "#f3c98a");
  s += cyl(2.45, 9.0, 1.18, 1.5, 0.27, "#a9b1bf", "#d3d8e0") + ell(2.45, 9.0, 1.501, 0.21, "#6b4a32");
  for (const xw of [2.45, 3.3]) s += `<g transform="${ML(xw, y1 + 0.03, 0.38)}"><circle r=".36" fill="#3a3330" stroke="#a88a66" stroke-width=".06"/><path d="M-.3,0 H.3 M0,-.3 V.3 M-.21,-.21 L.21,.21 M-.21,.21 L.21,-.21" stroke="#a88a66" stroke-width=".03"/><circle r=".06" fill="#c9a77d"/></g>`;
  return s;
}
function charterFrame(): string {
  let s = ln([4.95, 3.34, 0], [4.95, 3.34, 0.6], "#6b5038", 0.07) + ln([6.65, 3.34, 0], [6.65, 3.34, 0.6], "#6b5038", 0.07);
  s += box(4.7, 3.28, 0.45, 6.9, 3.4, 2.38, { t: "#c89a66", r: "#a77b4d", l: "#b8895a" });
  s += poly([[4.78, 3.402, 0.53], [6.82, 3.402, 0.53], [6.82, 3.402, 2.3], [4.78, 3.402, 2.3]], "#fffdf5");
  return s;
}
const POLES: V3[] = [[0.35, 0.35, 6.0], [13.25, 0.35, 6.0], [0.35, 9.65, 5.6]];
const STRANDS: [V3, V3, number, number][] = [
  [POLES[0]!, POLES[1]!, 1.0, 22], [POLES[0]!, POLES[2]!, 0.95, 15], [POLES[2]!, POLES[1]!, 0.8, 26], [[4.42, 3.45, 2.94], [7.0, 0.75, 3.66], 0.38, 7],
];
const BULBS: { p: Pt; g: number }[] = [];
function lights(): string {
  let s = "";
  for (const p of POLES) s += ln([p[0], p[1], 0], p, "#4f4036", 0.09) + ln([p[0], p[1], p[2] - 0.02], [p[0], p[1], p[2] + 0.15], "#7a6656", 0.14);
  STRANDS.forEach(([A, B, sag, n], si) => {
    const pts: number[][] = [];
    for (let i = 0; i <= 28; i++) { const t = i / 28; pts.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t) - sag * 4 * t * (1 - t)]); }
    s += `<polyline points="${pstr(pts)}" fill="none" stroke="#4f4036" stroke-width=".035" stroke-linejoin="round"/>`;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = P(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t) - sag * 4 * t * (1 - t) - 0.12);
      BULBS.push({ p, g: si % 3 });
      s += `<circle cx="${R(p[0])}" cy="${R(p[1])}" r=".075" fill="${i % 4 === 3 ? "#ffd9c8" : "#fff4d8"}" stroke="#b89a6e" stroke-width=".018"/>`;
    }
  });
  for (let i = 0; i < 9; i++) { const p = P(4.45, 3.7 + i * 0.5, 2.42); BULBS.push({ p, g: 1 }); s += `<circle cx="${R(p[0])}" cy="${R(p[1])}" r=".07" fill="#fff4d8" stroke="#b89a6e" stroke-width=".018"/>`; }
  for (const x of MX) { const p = P(x, 2.72, 3.12); BULBS.push({ p, g: 2 }); s += `<circle cx="${R(p[0])}" cy="${R(p[1])}" r=".08" fill="#fff4d8" stroke="#b89a6e" stroke-width=".018"/>`; }
  BULBS.push({ p: P(4.42, 7.72, 2.38), g: 0 });
  return s;
}
function world(): string {
  const defs = `<defs>
    <linearGradient id="mk-soil-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7b184"/><stop offset="1" stop-color="#a77b52"/></linearGradient>
    <linearGradient id="mk-soil-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98d63"/><stop offset="1" stop-color="#8a6342"/></linearGradient>
    <linearGradient id="mk-frost" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7fbfd"/><stop offset=".55" stop-color="#dfeaf0"/><stop offset="1" stop-color="#c7d8e2"/></linearGradient>
    <linearGradient id="mk-cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9cbd6"/><stop offset=".45" stop-color="#f7fbfd"/><stop offset="1" stop-color="#a9bdca"/></linearGradient>
    <clipPath id="mk-clip-top"><polygon points="${pstr([[0, 0, 0], [X1, 0, 0], [X1, Y1, 0], [0, Y1, 0]])}"/></clipPath>
    <filter id="mk-soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".09"/></filter>
  </defs>`;
  return defs + slab() + shadows() + frost()
    + MX.map((_, i) => member(i)).join("") + spouts() + charterFrame() + stall() + cart()
    + footShadow(5.95, 6.75) + footShadow(7.2, 9.3) + footShadow(12.6, 8.0, 0.24)
    + lights();
}

/* far layer: bianglala + distant tents, in daylight colours */
const WH = { cx: 7.0, cy: -2.6, R: 3.25 };
function farSvg(dark = false): string {
  let s = "";
  const tents: number[][] = [[-19, 4.2, 3.2, 2.6], [-15.6, 3.6, 2.6, 3.2], [-12.4, 4.0, 3.4, 2.2], [-4.5, 2.2, 2.4, 2.4], [-1.4, 1.4, 2.2, 1.9], [12.6, 3.2, 3.0, 2.2], [15.6, 3.8, 2.6, 3.0], [18.8, 4.2, 3.4, 2.3], [21.6, 4.6, 2.4, 2.6]];
  const tc = dark ? ["#17161e", "#1b1a22", "#191820", "#1d1b24"] : ["#efd9c0", "#e9e0cf", "#f1d2c4", "#e4dccb"];
  tents.forEach(([cx = 0, b = 0, w = 0, h = 0], i) => {
    s += `<path d="M${cx - w / 2},${b + 2} L${cx - w / 2},${b - h * 0.52} L${cx},${b - h} L${cx + w / 2},${b - h * 0.52} L${cx + w / 2},${b + 2}Z" fill="${tc[i % 4]}"/>`;
    s += dark ? `<rect x="${R(cx - 0.35)}" y="${R(b - h * 0.3)}" width=".7" height=".3" fill="#ffb547" opacity=".55"/>`
      : `<path d="M${cx - w / 2},${b - h * 0.52} L${cx},${b - h} L${cx + w / 2},${b - h * 0.52}" fill="none" stroke="#d8bfa0" stroke-width=".08"/>`;
  });
  const cx = -7.4, cb = 1.6;
  s += `<path d="M${cx - 1.7},${cb + 2} V${cb - 1.1} H${cx + 1.7} V${cb + 2}Z" fill="${dark ? "#1a1921" : "#ecdcc6"}"/><path d="M${cx - 2.0},${cb - 1.1} L${cx},${cb - 2.7} L${cx + 2.0},${cb - 1.1}Z" fill="${dark ? "#24212b" : "#e7b9a4"}"/>`;
  if (dark) for (let i = 0; i < 9; i++) s += `<circle cx="${R(cx - 1.9 + i * 0.475)}" cy="${R(cb - 1.15)}" r=".09" fill="#ffd38a"/>`;
  s += `<path d="M${WH.cx},${WH.cy} L${WH.cx - 2.3},${WH.cy + 6.5} M${WH.cx},${WH.cy} L${WH.cx + 2.3},${WH.cy + 6.5}" stroke="${dark ? "#2a2732" : "#c9b394"}" stroke-width=".16" fill="none"/>`;
  return s;
}
function wheelSvg(): string {
  let w = `<circle r="${WH.R}" fill="none" stroke="#c9b394" stroke-width=".12"/><circle r="${WH.R * 0.9}" fill="none" stroke="#d6c4a8" stroke-width=".06"/>`;
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; w += `<line x1="0" y1="0" x2="${R(Math.cos(a) * WH.R)}" y2="${R(Math.sin(a) * WH.R)}" stroke="#d6c4a8" stroke-width=".05"/>`; }
  return w + `<circle r=".24" fill="#c9b394"/>`;
}
const GOND = ["#e98a6d", "#7fc2b3", "#f1c25a", "#c69bd2", "#e98a6d", "#7fc2b3", "#f1c25a", "#c69bd2"];

/* sprites (small svgs that move) */
const coinSvg = `<circle cy=".17" r="1" fill="#9c6607"/><circle r="1" fill="url(#mk-coin)"/><circle r=".7" fill="none" stroke="#c98f12" stroke-width=".09"/><circle r=".95" fill="none" stroke="#ffe9a8" stroke-width=".05" opacity=".7"/>`;
function domeSvg(): string {
  const r = 0.46, rx = r * 1.2247, ry = r * 0.7071, h = 0.66;
  let s = `<path d="M${R(-rx)},0 C${R(-rx)},${R(-h * 1.33)} ${R(rx)},${R(-h * 1.33)} ${R(rx)},0 A${R(rx)},${R(ry)} 0 0 1 ${R(-rx)},0Z" fill="url(#mk-dome)" stroke="#ffffff" stroke-opacity=".7" stroke-width=".025"/><g stroke="#ffffff" stroke-opacity=".4" stroke-width=".018" fill="none">`;
  for (const f of [-0.66, -0.22, 0.22, 0.66]) s += `<path d="M${R(f * rx)},${R(Math.sqrt(1 - f * f) * ry * 0.96)} Q${R(f * rx * 0.95)},${R(-h * 0.72)} 0,${R(-h)}"/>`;
  return s + `</g><ellipse cx="0" cy="${R(-h - 0.02)}" rx=".08" ry=".055" fill="#ffffff"/>`;
}
const keySvg = `<circle cx="-.12" cy="0" r=".11" fill="none" stroke="#9c6607" stroke-width=".06"/><path d="M-.01,0 H.24 M.16,0 V.08 M.22,0 V.07" stroke="#9c6607" stroke-width=".06" stroke-linecap="round"/><circle cx="-.12" cy="0" r=".19" fill="#f4b728" opacity=".25"/>`;

const SIG = ["M0,.06 c.08,-.2 .12,.12 .2,-.04 c.06,-.12 .1,.1 .18,0 c.05,-.06 .1,.02 .22,-.05", "M0,.02 c.06,-.14 .1,.14 .17,0 c.05,-.1 .12,.08 .2,-.02 c.06,-.07 .14,.04 .23,-.02", "M0,.05 c.1,-.18 .13,.1 .21,-.03 c.05,-.08 .08,.08 .16,-.01 c.07,-.06 .12,.03 .23,-.04"];
function boardSvg(): string {
  // drawn on the board face (y = 3.402); local u → +x, v → down
  let s = `<g transform="${ML(4.9, 3.403, 2.24)}">`;
  s += `<text x="0" y=".24" class="mk-t-row" font-size=".26" fill="#151515">Charter</text><text x="1.86" y=".23" class="mk-t-mono" font-size=".1" text-anchor="end">ZCASH CLASS</text><line x1="0" y1=".33" x2="1.86" y2=".33" stroke="#d7d6cf" stroke-width=".015"/>`;
  for (let i = 0; i < 3; i++) {
    const v = 0.62 + i * 0.34;
    s += `<text x="0" y="${v}" class="mk-t-row" font-size=".27" fill="#151515">${NAMES[i]}</text>`;
    s += `<text x=".72" y="${v}" class="mk-t-mono" font-size=".16" fill="#151515" id="mk-sh${i}">${SHARES[i]}</text>`;
    s += `<path id="mk-sig${i}" d="${SIG[i]}" transform="translate(1.14 ${R(v - 0.1)}) scale(1.15)" fill="none" stroke="#1f3f8a" stroke-width=".038" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`;
    s += `<path id="mk-crk${i}" d="M1.12,${R(v - 0.2)} l.14,.1 l-.06,.06 l.18,.08 l-.08,.05 l.2,.06" fill="none" stroke="#c0341d" stroke-width=".03" opacity="0"/>`;
  }
  s += `<g id="mk-host" opacity="0"><text x="0" y="1.64" class="mk-t-row" font-size=".27" fill="#c0341d">Host</text><text x=".72" y="1.64" class="mk-t-mono" font-size=".16" fill="#c0341d">10%</text><text x="1.18" y="1.62" class="mk-t-mono" font-size=".11" fill="#c0341d">not signed</text></g>`;
  s += `<text x=".72" y=".62" class="mk-t-mono" font-size=".16" fill="#c0341d" id="mk-sh0b" opacity="0">30%</text>`;
  return s + "</g>";
}
const stampSvg = (word: string, color: string): string => `<g transform="rotate(-13)"><rect x="-.3" y="-.1" width=".6" height=".2" rx=".03" fill="none" stroke="${color}" stroke-width=".028"/><text x="0" y=".055" text-anchor="middle" class="mk-t-stamp" font-size=".15" fill="${color}">${word}</text></g>`;

/* ---------- mount ---------- */
export function mount(root: HTMLElement): void {
  const bbFig = (x: number, y: number, w = 1.3, h = 2.1): number[] => { const p = P(x, y); return [p[0] - w / 2, p[1] - h + 0.08, w, h]; };
  const sprites: { id: string; bb: number[]; html: string; cls?: string }[] = [
    { id: "mk-buyer", bb: bbFig(5.95, 6.75), cls: "mk-bob", html: "" },
    { id: "mk-walker", bb: bbFig(7.2, 9.3), cls: "mk-bob mk-bob-2", html: "" },
    { id: "mk-kid", bb: bbFig(12.6, 8.0, 1.2, 2.3), cls: "mk-bob mk-bob-3", html: "" },
  ];
  const figInner = (_bb: number[], x: number, y: number, who: Who) => { const p = P(x, y); return `<g transform="translate(${R(p[0])},${R(p[1])})">${person(who)}</g>`; };
  sprites[0]!.html = figInner(sprites[0]!.bb, 5.95, 6.75, { shirt: "#fffaf0", pants: "#3a3f56", hair: "cap", arms: "reach" });
  sprites[1]!.html = figInner(sprites[1]!.bb, 7.2, 9.3, { shirt: "#e98a6d", pants: "#3a3f56", hair: "short", arms: "bag" });
  sprites[2]!.html = figInner(sprites[2]!.bb, 12.6, 8.0, { s: 0.7, shirt: "#2f8f83", pants: "#3a3f56", hair: "short", arms: "balloon" });
  const svgSpr = (id: string, bb: number[], inner: string, cls = "") =>
    `<svg class="mk-spr ${cls}" id="${id}" viewBox="${bb.map(R).join(" ")}" aria-hidden="true">${inner}</svg>`;
  const boardBB = [P(4.6, 3.4, 2.45)[0], P(4.6, 3.4, 2.45)[1], 2.1, 3.25];
  const bonBB = [P(4.6, 6.64, 1.0)[0] - 0.45, P(4.6, 6.64, 1.0)[1] - 0.35, 0.9, 0.7];
  const qrBB = [P(4.6, 4.74, 1.24)[0] - 0.5, P(4.6, 4.74, 1.24)[1] - 0.45, 1.0, 0.9];
  const balloonP = P(12.6, 8.0);

  root.innerHTML = `
  <div class="stage mk-stage">
    <div class="mk-sky" aria-hidden="true">
      <div class="mk-sky-day"></div><div class="mk-sun"></div>
      <div class="mk-cloud mk-cloud-1"></div><div class="mk-cloud mk-cloud-2"></div><div class="mk-cloud mk-cloud-3"></div>
      <div class="mk-sky-dusk"></div><div class="mk-sky-night"><i></i></div>
    </div>
    <div class="mk-far" aria-hidden="true">
      <svg class="mk-far-svg" viewBox="-24 -10 50 18">${farSvg()}</svg>
      <svg class="mk-far-svg mk-far-dark" viewBox="-24 -10 50 18">${farSvg(true)}</svg>
      <svg class="mk-wheel" viewBox="${-WH.R - 0.2} ${-WH.R - 0.2} ${2 * WH.R + 0.4} ${2 * WH.R + 0.4}">${wheelSvg()}</svg>
      ${GOND.map((c, i) => `<div class="mk-gond mk-gond-${i}"><i class="mk-gond-car mk-gc-${i % 4}"></i></div>`).join("")}
    </div>
    <div class="mk-cam" aria-hidden="true">
      <svg class="mk-world" viewBox="${VB.join(" ")}">${world()}
        <defs>
          <radialGradient id="mk-coin" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#fff1b8"/><stop offset=".42" stop-color="#f4b728"/><stop offset="1" stop-color="#c98f12"/></radialGradient>
          <linearGradient id="mk-dome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfdfe" stop-opacity=".95"/><stop offset="1" stop-color="#bfd2de" stop-opacity=".85"/></linearGradient>
          <radialGradient id="mk-pool"><stop offset="0" stop-color="#ffb24a" stop-opacity=".55"/><stop offset=".5" stop-color="#ff9a3c" stop-opacity=".18"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
          <radialGradient id="mk-halo"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".95"/><stop offset=".22" stop-color="#ffb547" stop-opacity=".42"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
        </defs>
      </svg>
      ${svgSpr("mk-board", boardBB, boardSvg())}
      ${svgSpr("mk-lunas", bonBB, `<g transform="${MT(4.6, 6.64, 1.006)}"><g class="mk-pop" id="mk-lunas-g">${stampSvg("PAID", "#c0341d")}</g></g>`)}
      ${svgSpr("mk-refused", qrBB, `<g transform="${MR(4.6, 4.74, 1.24)}"><g transform="scale(1.25)">${stampSvg("REFUSED", "#c0341d")}</g></g>`)}
      ${sprites.map((s) => svgSpr(s.id, s.bb, s.html, s.cls)).join("")}
      ${svgSpr("mk-balloon", [balloonP[0] - 0.2, balloonP[1] - 2.35, 0.8, 1.4], `<g transform="translate(${R(balloonP[0])},${R(balloonP[1])})"><path d="M.28,-1.06 Q.4,-1.5 .3,-1.78" stroke="#8a7a66" stroke-width=".02" fill="none"/><ellipse cx=".3" cy="-2.0" rx=".2" ry=".24" fill="#e2472c"/><ellipse cx=".24" cy="-2.08" rx=".05" ry=".08" fill="#ffc2b2" opacity=".85"/></g>`, "mk-sway")}
      <div class="mk-steam"><i></i><i></i><i></i></div>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<div class="mk-glow" id="mk-gl${i}"></div>`).join("")}
      ${[0, 1, 2].map((i) => `<div class="mk-ring" id="mk-ring${i}"></div>`).join("")}
      ${["b", 0, 1, 2].map((i) => svgSpr(`mk-coin${i}`, [-1.25, -1.25, 2.5, 2.5], coinSvg, "mk-coin")).join("")}
      ${[0, 1, 2].map((i) => svgSpr(`mk-key${i}`, [-0.35, -0.35, 0.7, 0.7], keySvg, "mk-key")).join("")}
      ${[0, 1, 2].map((i) => svgSpr(`mk-dome${i}`, [-0.75, -0.95, 1.5, 1.45], domeSvg(), "mk-dome")).join("")}
    </div>
    <div class="mk-shade" aria-hidden="true"></div>
    <div class="mk-cam mk-cam2" aria-hidden="true">
      <svg class="mk-halos" viewBox="${VB.join(" ")}"><g id="mk-pools" opacity="0">${[[5.6, 6.0, 3.4], [8.0, 3.0, 1.9], [10.2, 3.0, 1.9], [12.4, 3.0, 1.9], [2.9, 9.0, 1.9], [5.8, 4.2, 1.6]].map(([x = 0, y = 0, r = 0]) => ell(x, y, 0, r, "url(#mk-pool)")).join("")}</g>${[0, 1, 2].map((g) => `<g class="mk-hg" id="mk-hg${g}">${BULBS.filter((b) => b.g === g).map((b) => `<circle cx="${R(b.p[0])}" cy="${R(b.p[1])}" r=".42" fill="url(#mk-halo)"/><circle cx="${R(b.p[0])}" cy="${R(b.p[1])}" r=".07" fill="#fff1cc"/>`).join("")}</g>`).join("")}</svg>
    </div>
    <div class="mk-ui" aria-hidden="true">
      ${[0, 1, 2].map((i) => `<div class="mk-rcpt" id="mk-rc${i}"><b>${NAMES[i]} · ${SHARES[i]}</b><span>${AMTS[i]} ZEC</span><em>receipt signed</em></div>`).join("")}
    </div>
    <div class="mk-copy">
      <h2 class="mk-kicker">How it works</h2>
      <ol class="mk-rail">
        <li><span>01</span><em>Sign</em><i><i></i></i></li>
        <li><span>02</span><em>Pay once</em><i><i></i></i></li>
        <li><span>03</span><em>Check your share</em><i><i></i></i></li>
      </ol>
      <div class="mk-panels">
        <article class="mk-panel"><h3><span>01</span>Sign</h3><p>Every member signs the same charter: each shielded address and share, signed with their own key. Change one number and every signature breaks.</p><a class="mk-link" href="./charter.html">Make a charter</a></article>
        <article class="mk-panel"><h3><span>02</span>Pay once</h3><p>The buyer's browser checks every signature and builds one ZIP-321 request. Their wallet sends one transaction with one shielded output per member, each with an encrypted memo.</p><a class="mk-link" href="./pay.html">Pay a collective</a></article>
        <article class="mk-panel"><h3><span>03</span>Check your share</h3><p>Each member runs the watcher with their own viewing key and gets a signed receipt that their share arrived. No server in the middle.</p><a class="mk-link" href="https://github.com/BonBagi-Protocol/watcher" rel="noopener">BonBagi-Protocol/watcher</a></article>
      </div>
    </div>
    <div class="mk-try">
      <h3 class="mk-try-h">Try to cheat the split.</h3>
      <p>Move 10% to the host after everyone signed. The total is still 100%. Every signature breaks and the page refuses to pay.</p>
      <a class="mk-btn" href="/try">Try it yourself<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
    </div>
    <div class="mk-dark-fade" aria-hidden="true"></div>
    <div class="mk-end-fade" aria-hidden="true"></div>
  </div>`;

  /* ---------- refs ---------- */
  const q = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const stage = q<HTMLElement>(".mk-stage"), cam = q<HTMLElement>(".mk-cam"), cam2 = q<HTMLElement>(".mk-cam2"), worldEl = q<SVGSVGElement>(".mk-world"), halos = q<SVGSVGElement>(".mk-halos");
  const far = q<HTMLElement>(".mk-far"), farSvgEls = [...root.querySelectorAll<SVGSVGElement>(".mk-far-svg")], farDark = q<SVGSVGElement>(".mk-far-dark"), wheel = q<SVGSVGElement>(".mk-wheel");
  const gonds = [...root.querySelectorAll<HTMLElement>(".mk-gond")];
  const sprEls = [...root.querySelectorAll<SVGSVGElement>("svg.mk-spr")];
  const coinB = q<SVGSVGElement>("#mk-coinb"), coins = [0, 1, 2].map((i) => q<SVGSVGElement>(`#mk-coin${i}`));
  const keys = [0, 1, 2].map((i) => q<SVGSVGElement>(`#mk-key${i}`)), domes = [0, 1, 2].map((i) => q<SVGSVGElement>(`#mk-dome${i}`));
  const glows = [0, 1, 2, 3, 4, 5].map((i) => q<HTMLElement>(`#mk-gl${i}`)), rings = [0, 1, 2].map((i) => q<HTMLElement>(`#mk-ring${i}`));
  const rcpts = [0, 1, 2].map((i) => q<HTMLElement>(`#mk-rc${i}`));
  const sigs = [0, 1, 2].map((i) => q<SVGPathElement>(`#mk-sig${i}`)), cracks = [0, 1, 2].map((i) => q<SVGPathElement>(`#mk-crk${i}`));
  const sh0 = q<SVGTextElement>("#mk-sh0"), sh0b = q<SVGTextElement>("#mk-sh0b"), host = q<SVGGElement>("#mk-host");
  const lunas = q<SVGSVGElement>("#mk-lunas"), lunasG = q<SVGGElement>("#mk-lunas-g"), refused = q<SVGSVGElement>("#mk-refused");
  const steam = q<HTMLElement>(".mk-steam"), shade = q<HTMLElement>(".mk-shade");
  const hgs = [0, 1, 2].map((i) => q<SVGGElement>(`#mk-hg${i}`)), pools = q<SVGGElement>("#mk-pools");
  const dusk = q<HTMLElement>(".mk-sky-dusk"), night = q<HTMLElement>(".mk-sky-night"), darkFade = q<HTMLElement>(".mk-dark-fade"), endFade = q<HTMLElement>(".mk-end-fade");
  const copy = q<HTMLElement>(".mk-copy"), tryEl = q<HTMLElement>(".mk-try");
  const panels = [...root.querySelectorAll<HTMLElement>(".mk-panel")], railIs = [...root.querySelectorAll<HTMLElement>(".mk-rail > li")];
  const railBars = railIs.map((li) => li.querySelector<HTMLElement>("i > i")!);

  /* ---------- layout ---------- */
  let W = 0, H = 0, mob = false, base = 1, U = 64, A0: Pt = [0, 0], C0: Pt = [1.6, 4.2];
  interface Key { p: number; cx: number; cy: number; lz: number; ax: number; ay: number }
  let KF: Key[] = [];
  const F = (p: number, pt: Pt, z: number, ax: number, ay: number): Key => ({ p, cx: pt[0], cy: pt[1], lz: Math.log(z), ax, ay });
  const px = (v: number) => `${R(v)}px`;
  const place = (el: HTMLElement | SVGSVGElement, bb: number[]) => {
    el.style.left = px((bb[0]! - VB[0]!) * U); el.style.top = px((bb[1]! - VB[1]!) * U);
    el.style.width = px(bb[2]! * U); el.style.height = px(bb[3]! * U);
  };
  function layout(): void {
    W = innerWidth; H = innerHeight; mob = W < 760;
    if (!mob) {
      C0 = [1.6, 4.2]; U = 72;
      base = Math.min((W * 0.56) / 20.4, (H * 0.84) / 19.7);
      A0 = [W * 0.68, H * 0.52];
      KF = [
        F(0, C0, 1, 0.68, 0.52),
        F(0.1, P(5.8, 3.4, 1.3), 1.95, 0.68, 0.52),
        F(0.21, P(6.6, 3.0, 1.3), 1.75, 0.68, 0.52),
        F(0.32, P(5.0, 5.9, 1.0), 2.0, 0.68, 0.55),
        F(0.43, P(7.6, 5.7, 0.2), 1.85, 0.68, 0.55),
        F(0.53, P(9.9, 3.3, 1.0), 1.7, 0.68, 0.56),
        F(0.66, P(10.2, 2.6, 1.3), 1.7, 0.66, 0.6),
        F(0.79, P(5.3, 4.3, 1.3), 1.75, 0.68, 0.54),
        F(0.91, [C0[0], C0[1] + 0.6], 0.98, 0.5, 0.5),
        F(1, [C0[0], C0[1] + 0.8], 0.94, 0.5, 0.48),
      ];
    } else {
      C0 = [2.1, 4.2]; U = 44;
      base = Math.min((W * 0.97) / 17.6, (H * 0.44) / 19.7);
      A0 = [W * 0.5, 74 + 9.4 * base];
      const ay = (74 + (H - 300)) / 2 / H;
      KF = [
        F(0, C0, 1, 0.5, A0[1] / H),
        F(0.1, P(5.8, 3.4, 1.3), 2.15, 0.5, ay),
        F(0.21, P(6.8, 3.0, 1.3), 1.85, 0.5, ay),
        F(0.32, P(5.0, 5.9, 1.0), 2.2, 0.5, ay + 0.03),
        F(0.43, P(7.6, 5.7, 0.2), 2.0, 0.5, ay + 0.03),
        F(0.53, P(10.0, 3.3, 1.0), 1.9, 0.5, ay + 0.04),
        F(0.66, P(10.2, 2.7, 1.3), 1.85, 0.5, ay + 0.06),
        F(0.79, P(5.3, 4.3, 1.3), 1.9, 0.5, ay + 0.02),
        F(0.91, [C0[0], C0[1] + 0.6], 1.0, 0.5, 0.42),
        F(1, [C0[0], C0[1] + 0.8], 0.97, 0.5, 0.42),
      ];
    }
    const ww = VB[2]! * U, wh = VB[3]! * U;
    cam.style.width = px(ww); cam.style.height = px(wh); cam2.style.width = px(ww); cam2.style.height = px(wh);
    worldEl.setAttribute("width", String(R(ww))); worldEl.setAttribute("height", String(R(wh)));
    halos.setAttribute("width", String(R(ww))); halos.setAttribute("height", String(R(wh)));
    for (const el of sprEls) {
      if (el.classList.contains("mk-coin") || el.classList.contains("mk-key") || el.classList.contains("mk-dome")) {
        const vb = el.viewBox.baseVal; const k = el.classList.contains("mk-coin") ? 0.42 : 1;
        el.style.width = px(vb.width * U * k); el.style.height = px(vb.height * U * k);
      } else { const vb = el.viewBox.baseVal; place(el, [vb.x, vb.y, vb.width, vb.height]); }
    }
    const sp = P(2.45, 9.0, 1.55); steam.style.left = px((sp[0] - VB[0]!) * U); steam.style.top = px((sp[1] - VB[1]!) * U); steam.style.setProperty("--mk-u", px(U));
    for (const g of glows) { g.style.width = g.style.height = px(2.4 * U); }
    for (const r of rings) { r.style.width = px(1.2247 * U); r.style.height = px(0.7071 * U); }
    // far layer: units = 1 at Uf px
    for (const e of farSvgEls) { e.style.width = px(50 * U); e.style.height = px(18 * U); }
    far.style.width = px(50 * U); far.style.height = px(18 * U);
    const wsz = (2 * WH.R + 0.4) * U;
    wheel.style.width = wheel.style.height = px(wsz);
    wheel.style.left = px((WH.cx + 24 - WH.R - 0.2) * U); wheel.style.top = px((WH.cy + 10 - WH.R - 0.2) * U);
    gonds.forEach((g) => { g.style.left = px((WH.cx + 24) * U); g.style.top = px((WH.cy + 10) * U); g.style.setProperty("--mk-r", px(WH.R * U)); g.style.setProperty("--mk-gs", px(0.34 * U)); });
    last = -1;
  }

  /* ---------- camera ---------- */
  const hermite = (p0: number, p1: number, m0: number, m1: number, t: number) => { const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1; };
  type CamK = "cx" | "cy" | "lz" | "ax" | "ay";
  function camAt(p: number) {
    let i = 0; while (i < KF.length - 2 && p > KF[i + 1]!.p) i++;
    const k0 = KF[i]!, k1 = KF[i + 1]!, kp = KF[i - 1], kn = KF[i + 2], h = k1.p - k0.p, u = clamp((p - k0.p) / h);
    const o: Record<CamK, number> = { cx: 0, cy: 0, lz: 0, ax: 0, ay: 0 };
    for (const key of ["cx", "cy", "lz", "ax", "ay"] as CamK[]) {
      const m0 = kp ? ((k1[key] - kp[key]) / (k1.p - kp.p)) * h : 0;
      const m1 = kn ? ((kn[key] - k0[key]) / (kn.p - k0.p)) * h : 0;
      o[key] = hermite(k0[key], k1[key], m0, m1, u);
    }
    return { ...o, z: Math.exp(o.lz) };
  }

  /* ---------- story helpers ---------- */
  const wpx = (w: Pt): Pt => [(w[0] - VB[0]!) * U, (w[1] - VB[1]!) * U];
  const arc = (A: V3, B: V3, u: number, h: number): V3 => { const p = lerp3(A, B, u); p[2] += h * 4 * u * (1 - u); return p; };
  function polyAt(pts: V3[], u: number): V3 {
    const L: number[] = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); L.push(d); tot += d; }
    let d = u * tot;
    for (let i = 0; i < L.length; i++) { const li = L[i]!; if (d <= li || i === L.length - 1) return lerp3(pts[i]!, pts[i + 1]!, clamp(d / li)); d -= li; }
    return pts[pts.length - 1]!;
  }
  const RMAX = 0.42;
  function setCoin(el: SVGSVGElement, pos: V3, r: number, flat: number, spin: number, op: number) {
    if (op <= 0.001) { el.style.opacity = "0"; return; }
    const w = wpx(P(...pos)), s = (2.5 * RMAX * U) / 2;
    const sx = (r / RMAX) * lerp(Math.max(0.16, Math.abs(Math.cos(spin))), 1.2247, flat), sy = (r / RMAX) * lerp(1, 0.7071, flat);
    el.style.transform = `translate3d(${R(w[0] - s)}px,${R(w[1] - s)}px,0) scale(${R(sx)},${R(sy)})`;
    el.style.opacity = R(op).toString();
  }
  function setGlow(el: HTMLElement, pos: V3, op: number, sc = 1) {
    if (op <= 0.001) { el.style.opacity = "0"; return; }
    const w = wpx(P(...pos)), s = 1.2 * U;
    el.style.transform = `translate3d(${R(w[0] - s)}px,${R(w[1] - s)}px,0) scale(${R(sc)})`;
    el.style.opacity = R(op).toString();
  }
  function setAt(el: HTMLElement | SVGSVGElement, pos: V3, ox: number, oy: number, sc: number, op: number) {
    if (op <= 0.001) { el.style.opacity = "0"; return; }
    const w = wpx(P(...pos));
    el.style.transform = `translate3d(${R(w[0] - ox * U)}px,${R(w[1] - oy * U)}px,0) scale(${R(sc)})`;
    el.style.opacity = R(op).toString();
  }

  /* ---------- per-frame ---------- */
  let last = -1, lastW = 0;
  function story(p: number) {
    // 01 Sign: three signatures write in, a key pops over each signer
    for (let i = 0; i < 3; i++) {
      const u = reduced ? 1 : easeInOut(seg(p, 0.07 + i * 0.045, 0.11 + i * 0.045));
      sigs[i]!.setAttribute("stroke-dashoffset", R(1 - u).toString());
      const k = seg(p, 0.1 + i * 0.045, 0.125 + i * 0.045), kOut = 1 - seg(p, 0.27, 0.3);
      setAt(keys[i]!, [x0m(i), 1.42, 2.25 + 0.15 * easeOut(k)], 0.35, 0.35, 0.6 + 0.4 * easeOut(k), k * kOut);
      // cheat: signatures break
      const br = seg(p, 0.79, 0.81);
      sigs[i]!.setAttribute("stroke", br > 0.5 ? "#c0341d" : "#1f3f8a");
      cracks[i]!.setAttribute("opacity", R(br * (1 - seg(p, 0.9, 0.93))).toString());
    }
    const ch = seg(p, 0.765, 0.78);
    sh0.setAttribute("opacity", R(1 - ch).toString()); sh0b.setAttribute("opacity", R(ch).toString());
    host.setAttribute("opacity", R(seg(p, 0.775, 0.79)).toString());
    const rf = seg(p, 0.81, 0.83);
    refused.style.opacity = R(rf * (1 - seg(p, 0.92, 0.95))).toString();
    refused.style.transform = `scale(${R(1 + 0.6 * (1 - easeOut(rf)))})`;

    // 02 Pay once: buyer coin → counter → LUNAS → frost → pad → three spouts → bowls
    const tau = reduced ? 9 : p;
    let op = 1, pos: V3 = HAND, flat = 0, spin = 0, sc = 1;
    if (tau < 0.29) { op = 1; }
    else if (tau < 0.33) { const u = easeInOut(seg(tau, 0.29, 0.33)); pos = arc(HAND, LAND, u, 0.9); spin = u * Math.PI * 4; flat = seg(tau, 0.32, 0.33); }
    else if (tau < 0.336) { pos = LAND; flat = 1; }
    else if (tau < 0.352) { const u = easeInOut(seg(tau, 0.336, 0.352)); pos = lerp3(LAND, SLOT, u); flat = 1; sc = 1 - seg(tau, 0.344, 0.352) * 0.7; op = 1 - seg(tau, 0.346, 0.352); }
    else op = 0;
    setCoin(coinB, pos, 0.4 * sc, flat, spin, op);
    const lu = seg(p, 0.333, 0.345);
    lunas.style.opacity = R(seg(p, 0.333, 0.336)).toString();
    lunasG.setAttribute("transform", `scale(${R(1 + 0.7 * (1 - easeOut(lu)))})`);
    setGlow(glows[0]!, [5.03, 5.8, lerp(0.86, 0.08, easeInOut(seg(tau, 0.35, 0.37)))], seg(tau, 0.35, 0.354) * (1 - seg(tau, 0.368, 0.374)), 0.6);
    setGlow(glows[1]!, [lerp(5.1, 8.2, easeInOut(seg(tau, 0.37, 0.42))), 5.8, 0], seg(tau, 0.37, 0.375) * (1 - seg(tau, 0.415, 0.422)), 0.7);
    const pu = seg(tau, 0.415, 0.45);
    setGlow(glows[2]!, [8.2, 5.8, 0], seg(tau, 0.415, 0.422) * (1 - seg(tau, 0.44, 0.452)), 0.8 + 0.6 * Math.sin(pu * Math.PI));
    for (let i = 0; i < 3; i++) {
      setGlow(glows[3 + i]!, polyAt(BR[i]!, easeInOut(seg(tau, 0.445, 0.5))), seg(tau, 0.445, 0.452) * (1 - seg(tau, 0.494, 0.502)), 0.62);
      const ru = seg(tau, 0.5, 0.52);
      setAt(rings[i]!, [MX[i]!, 3.25, 0.44], 0.6124, 0.3536, 0.25 + ru * 0.5, ru > 0 && ru < 1 ? 0.9 * (1 - ru) : 0);
      let cop = 0, cpos: V3 = [MX[i]!, 3.25, 0.44], cf = 0, cs = 0, csc = 1;
      if (tau >= 0.5 && tau < 0.54) { const u = easeOut(seg(tau, 0.5, 0.54)); cpos = arc([MX[i]!, 3.25, 0.44], [MX[i]!, 2.1, 0.95], u, 1.15); csc = seg(tau, 0.5, 0.505); cs = u * Math.PI * 3; cf = seg(tau, 0.53, 0.54); cop = 1; }
      else if (tau >= 0.54) { cpos = [MX[i]!, 2.1, 0.95]; cf = 1; cop = 1; }
      setCoin(coins[i]!, cpos, [0.31, 0.26, 0.26][i]! * Math.max(0.05, csc), cf, cs, cop);
      // night: frosted tudung saji over every bowl (outsiders see frost)
      const du = reduced ? seg(p, 0.9, 0.91) : easeInOut(seg(p, 0.9, 0.95));
      setAt(domes[i]!, [MX[i]!, 2.1, 0.82 + (1 - du) * 1.8], 0.75, 0.95, 1, seg(p, 0.9, 0.92));
    }
  }

  function frame(p: number, info: { vw: number; vh: number }) {
    if (info.vw !== lastW || W === 0) { layout(); lastW = info.vw; }
    if (Math.abs(p - last) < 1e-5) return; // nothing scrolled: CSS idle loops keep running on their own
    last = p;
    // camera (one compositor transform)
    const c = camAt(reduced ? 0 : p);
    const k = base * c.z, ax = c.ax * W, ay = c.ay * H;
    const T: Pt = [ax - (c.cx - VB[0]!) * k, ay - (c.cy - VB[1]!) * k];
    cam.style.transform = cam2.style.transform = `translate3d(${R(T[0])}px,${R(T[1])}px,0) scale(${R(k / U)})`;
    const df = 0.3, kf = base * (1 + (c.z - 1) * df);
    const fcx = C0[0] + (c.cx - C0[0]) * df, fcy = C0[1] + (c.cy - C0[1]) * df;
    const fax = A0[0] + (ax - A0[0]) * df, fay = A0[1] + (ay - A0[1]) * df;
    far.style.transform = `translate3d(${R(fax - (fcx + 24) * kf)}px,${R(fay - (fcy + 10) * kf)}px,0) scale(${R(kf / U)})`;
    story(p);

    // copy: steps rail + panels, then the try block
    const ranges = [[0, 0.27], [0.27, 0.56], [0.56, 0.735]];
    panels.forEach((el, i) => {
      // the outgoing panel is gone before the next one starts (no overlap at the hand-off)
      const r = ranges[i]!;
      const inn = i === 0 ? 1 : smooth(r[0]! + 0.004, r[0]! + 0.024, p);
      const out = i === ranges.length - 1 ? 1 : 1 - smooth(r[1]! - 0.022, r[1]! - 0.002, p);
      const o = inn * out;
      el.style.opacity = R(o).toString(); el.style.transform = `translate3d(0,${R((1 - o) * (p < r[0]! + 0.02 ? 18 : -18))}px,0)`;
      el.style.pointerEvents = o < 0.5 ? "none" : "";
      railIs[i]!.classList.toggle("is-on", o > 0.5);
      railBars[i]!.style.transform = `scaleX(${R(seg(p, r[0]! + 0.01, r[1]! - 0.01))})`;
    });
    const co = 1 - smooth(0.735, 0.755, p);
    copy.style.opacity = R(co).toString(); copy.style.pointerEvents = co < 0.5 ? "none" : "";
    const to = band(p, 0.765, 0.855, 0.015);
    tryEl.style.opacity = R(to).toString(); tryEl.style.pointerEvents = to < 0.5 ? "none" : "";
    tryEl.style.transform = mob ? `translate3d(0,${R((1 - to) * 20)}px,0)` : `translate3d(0,calc(-50% + ${R((1 - to) * 20)}px),0)`;

    // 03 receipts (screen space, crisp text)
    for (let i = 0; i < 3; i++) {
      const o = smooth(0.58 + i * 0.025, 0.605 + i * 0.025, p) * (1 - smooth(0.73, 0.75, p));
      const el = rcpts[i]!;
      if (o < 0.01) { el.style.opacity = "0"; continue; }
      el.style.opacity = R(o).toString();
      if (mob || reduced) { // a row of three under the nav, left to right like the stalls
        const rx = mob ? (W * (2 * i + 1)) / 6 : W * (0.6 + i * 0.12);
        el.style.transform = `translate3d(${R(rx)}px,${R(78 + (1 - o) * 12)}px,0) translate(-50%,0)`;
      } else {
        const w = P(MX[i]!, 1.7, 4.05), sx = ax + (w[0] - c.cx) * k, sy = ay + (w[1] - c.cy) * k;
        el.style.transform = `translate3d(${R(sx)}px,${R(sy + (1 - o) * 12)}px,0) translate(-50%,-100%)`;
      }
    }

    // dusk → night, lights on, hand-over to obsidian
    const du = smooth(0.82, 0.9, p), ni = smooth(0.88, 0.96, p);
    dusk.style.opacity = R(du).toString(); night.style.opacity = R(ni).toString();
    shade.style.opacity = R(du * 0.16 + ni * 0.5).toString();
    farDark.style.opacity = R(smooth(0.86, 0.94, p)).toString();
    pools.setAttribute("opacity", R(smooth(0.9, 0.95, p)).toString());
    hgs.forEach((g, i) => g.setAttribute("opacity", R(smooth(0.9 + i * 0.015, 0.93 + i * 0.015, p)).toString()));
    darkFade.style.opacity = R(smooth(0.88, 0.95, p)).toString();
    endFade.style.opacity = R(smooth(0.94, 0.985, p)).toString(); // ends on clean obsidian for scene 4
    stage.classList.toggle("is-night", ni > 0.5);
    const tone = du > 0.55 ? "dark" : "light"; // the fixed nav reads this every frame
    if (root.dataset.tone !== tone) root.dataset.tone = tone;
  }

  // scroll-driven only: nothing to animate on its own once the progress settles
  scene(root, (p, info) => { frame(p, info); return false; }, 0.12);

  // Keyboard: hidden steps stay focusable; tabbing into one scrolls to where it is readable.
  const READ = [0.15, 0.47, 0.66, 0.81];
  const scrollToP = (target: number) => {
    const top = root.getBoundingClientRect().top + scrollY, span = Math.max(1, root.offsetHeight - innerHeight);
    scrollTo({ top: top + target * span, behavior: reduced ? "auto" : "smooth" });
  };
  root.addEventListener("focusin", (e) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const pi = panels.findIndex((pn) => pn.contains(t));
    const target = pi >= 0 ? READ[pi] : tryEl.contains(t) ? READ[3] : undefined;
    if (target == null) return;
    const span = Math.max(1, root.offsetHeight - innerHeight), now = -root.getBoundingClientRect().top / span;
    if (Math.abs(now - target) > 0.04) requestAnimationFrame(() => scrollToP(target));
  });

  // idle CSS loops run only while the scene is on screen
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { for (const e of es) root.classList.toggle("mk-run", e.isIntersecting && !reduced); }, { rootMargin: "10% 0px" }).observe(root);
  }
}
