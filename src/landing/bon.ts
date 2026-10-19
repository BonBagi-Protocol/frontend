// "Bon di balik es" (the receipt behind the ice): the landing's hero.
// The protagonist is the bon itself, a paper receipt anyone can read. Three
// frosted ice slabs, one per member and each etched with that member's
// signature, slide in front of it: the receipt is still there but blurred,
// which is what a shielded payment looks like from outside. Behind the ice the
// receipt tears into its three shares; at the end the ice opens, the shares go
// to their members stamped LUNAS (paid), and the receipt joins up again.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export interface BonLook {
  /** 0 = no ice, 1 = the three slabs closed in front of the receipt. */
  shield: number;
  /** 0 = one receipt, 1 = torn into three shares (behind the ice). */
  tear: number;
  /** 0 = shares at the receipt, 1 = shares delivered to the members. */
  deliver: number;
}

const W = 2.5; // receipt width
const TOP_H = 2.25; // header part
const STRIP_H = 1.75; // the three shares
const SHARES = [
  { label: "Mentor A", pct: "40%", zec: "0.0040", w: 0.4 },
  { label: "Mentor B", pct: "30%", zec: "0.0030", w: 0.3 },
  { label: "Mentor C", pct: "30%", zec: "0.0030", w: 0.3 },
];
const PX = 420; // canvas pixels per world unit

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const seg = (v: number, a: number, b: number) => ease(clamp((v - a) / (b - a)));

function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * PX);
  cv.height = Math.round(h * PX);
  const c = cv.getContext("2d")!;
  draw(c, cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const INK = "#14120f";
const MUTE = "#6b665e";
const PAPER = "#f6f3ec";
const FONT_D = "900 {s}px Archivo, 'Arial Black', sans-serif";
const FONT_M = "500 {s}px 'Plex Mono', ui-monospace, monospace";
const f = (tpl: string, s: number) => tpl.replace("{s}", String(Math.round(s)));

/** zigzag (torn) edge along the top or bottom of a paper canvas */
function zig(c: CanvasRenderingContext2D, w: number, y: number, up: boolean) {
  const step = 22, depth = 14;
  c.save();
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.moveTo(0, y);
  for (let x = 0; x <= w + step; x += step) c.lineTo(x, y + ((x / step) % 2 ? (up ? -depth : depth) : 0));
  c.lineTo(w, up ? -10 : y + 100);
  c.lineTo(0, up ? -10 : y + 100);
  c.closePath();
  c.fill();
  c.restore();
}

function headerTexture() {
  return tex(W, TOP_H, (c, w, h) => {
    c.fillStyle = PAPER;
    c.fillRect(0, 0, w, h);
    c.fillStyle = INK;
    c.textAlign = "center";
    c.font = f(FONT_D, 74);
    c.fillText("B O N B A G I", w / 2, 150);
    c.font = f(FONT_M, 30);
    c.fillStyle = MUTE;
    c.fillText("bon = receipt  ·  bagi = split", w / 2, 205);
    c.setLineDash([12, 12]);
    c.strokeStyle = "#a9a296";
    c.lineWidth = 3;
    const line = (y: number) => {
      c.beginPath();
      c.moveTo(60, y);
      c.lineTo(w - 60, y);
      c.stroke();
    };
    line(260);
    c.setLineDash([]);
    c.textAlign = "left";
    c.fillStyle = INK;
    c.font = f(FONT_M, 38);
    c.fillText("Class ticket ×1", 70, 340);
    c.textAlign = "right";
    c.fillText("0.0100", w - 70, 340);
    c.textAlign = "left";
    c.fillStyle = MUTE;
    c.font = f(FONT_M, 30);
    c.fillText("collective · 3 members · signed", 70, 400);
    c.setLineDash([12, 12]);
    line(450);
    c.setLineDash([]);
    c.fillStyle = INK;
    c.fillRect(60, 480, w - 120, 6);
    c.font = f(FONT_D, 64);
    c.textAlign = "left";
    c.fillText("TOTAL ZEC", 70, 580);
    c.textAlign = "right";
    c.fillText("0.0100", w - 70, 580);
    c.font = f(FONT_M, 30);
    c.fillStyle = MUTE;
    c.textAlign = "center";
    c.fillText("1 shielded transaction  ·  3 outputs", w / 2, 660);
    // perforation the shares tear along
    c.setLineDash([8, 10]);
    c.strokeStyle = "#8f877a";
    line(h - 40);
    c.setLineDash([]);
    zig(c, w, 18, true);
  });
}

function stripTexture(i: number) {
  const s = SHARES[i]!;
  return tex(W * s.w, STRIP_H, (c, w, h) => {
    c.fillStyle = PAPER;
    c.fillRect(0, 0, w, h);
    c.fillStyle = ["#f4b728", "#9fd8e8", "#d98a6a"][i]!;
    c.fillRect(24, 26, w - 48, 14);
    c.fillStyle = INK;
    c.textAlign = "center";
    c.font = f(FONT_D, 130);
    c.fillText(s.pct, w / 2, 230);
    c.font = f(FONT_M, 34);
    c.fillText(s.label, w / 2, 300);
    c.fillStyle = MUTE;
    c.font = f(FONT_M, 30);
    c.fillText(`${s.zec} ZEC`, w / 2, 350);
    zig(c, w, h - 20, false);
  });
}

function stampTexture() {
  return tex(1.0, 0.42, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "#c0341d";
    c.fillStyle = "#c0341d";
    c.lineWidth = 12;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.font = f(FONT_D, 112);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("LUNAS", w / 2, h / 2 + 6);
  });
}

/** a member's signature scribble, glowing inside the ice */
function signatureTexture(seed: number) {
  return tex(1.0, 1.0, (c, w, h) => {
    c.fillStyle = "#000";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#fff";
    c.lineWidth = 9;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const x = 60 + (k / n) * (w - 120);
      const y = h * 0.55 + Math.sin(k * 1.7 + seed * 2.3) * 70 + Math.cos(k * 3.1 + seed) * 30;
      if (k === 0) c.moveTo(x, y);
      else c.quadraticCurveTo(x - 20, y - 60 * Math.sin(k + seed), x, y);
    }
    c.stroke();
    c.font = f(FONT_M, 46);
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.fillText(["A", "B", "C"][seed]!, w / 2, h * 0.86);
  });
}

/** paper: a subdivided plane with a gentle curl */
function paperGeometry(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h, 24, 24);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin((x / W) * Math.PI) * 0.05 + Math.sin(y * 1.3) * 0.04);
  }
  g.computeVertexNormals();
  return g;
}

export function createBon(o: { mobile: boolean }) {
  const root = new THREE.Group();
  // opaque with an alpha cut-out, so the ice (transmission) can see and blur it
  const paper = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, color: 0xe9e6df, roughness: 0.92, side: THREE.DoubleSide, alphaTest: 0.5 });

  // the receipt: header + three shares
  const receipt = new THREE.Group();
  const top = new THREE.Mesh(paperGeometry(W, TOP_H), paper(headerTexture()));
  top.position.y = STRIP_H / 2 + 0.02;
  receipt.add(top);
  const strips: { mesh: THREE.Mesh; home: THREE.Vector3; torn: THREE.Vector3; tornR: number; to: THREE.Vector3; stamp: THREE.Mesh }[] = [];
  const stampTex = stampTexture();
  let x = -W / 2;
  SHARES.forEach((s, i) => {
    const w = W * s.w;
    const m = new THREE.Mesh(paperGeometry(w, STRIP_H), paper(stripTexture(i)));
    const home = new THREE.Vector3(x + w / 2, -TOP_H / 2 + 0.02, 0.0);
    x += w;
    m.position.copy(home);
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, w * 0.36), new THREE.MeshBasicMaterial({ map: stampTex, transparent: true, opacity: 0, depthWrite: false }));
    stamp.position.set(0, -0.45, 0.03);
    stamp.rotation.z = [-0.18, 0.12, -0.08][i]!;
    m.add(stamp);
    receipt.add(m);
    strips.push({
      mesh: m,
      home,
      torn: home.clone().add(new THREE.Vector3([-0.28, 0, 0.28][i]!, -0.22 - (i === 1 ? 0.12 : 0), 0)),
      tornR: [-0.12, 0.03, 0.12][i]!,
      to: new THREE.Vector3([-3.1, 0, 3.1][i]!, [-0.9, -1.55, -0.9][i]!, 1.1),
      stamp,
    });
  });
  root.add(receipt);

  // three ice slabs, one per member, each carrying that member's signature
  const slabs = [0, 1, 2].map((i) => {
    const mat = o.mobile
      ? new THREE.MeshPhysicalMaterial({ color: 0xe9f3f6, roughness: 0.5, transparent: true, opacity: 0.9, clearcoat: 1, emissive: 0xf2f7f8, emissiveMap: signatureTexture(i), emissiveIntensity: 0.2 })
      : new THREE.MeshPhysicalMaterial({
          color: 0xffffff, roughness: 0.55, transmission: 1, thickness: 0.8, ior: 1.31, clearcoat: 1, clearcoatRoughness: 0.2,
          attenuationColor: new THREE.Color(0xe4f2f6), attenuationDistance: 3,
          emissive: 0xf2f7f8, emissiveMap: signatureTexture(i), emissiveIntensity: 0.16,
        });
    const m = new THREE.Mesh(new RoundedBoxGeometry(W / 3 + 0.08, TOP_H + STRIP_H + 0.5, 0.26, 4, 0.06), mat);
    const home = new THREE.Vector3((i - 1) * (W / 3 + 0.08), 0, 1.05);
    const from = new THREE.Vector3((i - 1) * 5.5, [4.5, -5, 4.5][i]!, 2.5);
    m.position.copy(from);
    root.add(m);
    return { m, home, from, spin: [0.9, -0.7, 0.6][i]! };
  });

  const tmp = new THREE.Vector3();
  function update(t: number, look: BonLook, tilt: THREE.Vector2) {
    const S = clamp(look.shield);
    // receipt idles and leans toward the pointer
    receipt.rotation.y = Math.sin(t * 0.35) * 0.12 + tilt.x * 0.25;
    receipt.rotation.x = Math.sin(t * 0.27) * 0.05 - tilt.y * 0.15;
    receipt.position.y = Math.sin(t * 0.8) * 0.05;

    slabs.forEach((s, i) => {
      const k = seg(S, i * 0.16, 0.68 + i * 0.16);
      tmp.lerpVectors(s.from, s.home, k);
      s.m.position.copy(tmp);
      s.m.rotation.set((1 - k) * s.spin, (1 - k) * s.spin * 1.4 + Math.sin(t * 0.4 + i) * 0.03 * k, (1 - k) * -s.spin);
      s.m.visible = k > 0.001;
    });

    const tear = clamp(look.tear), out = clamp(look.deliver);
    strips.forEach((s, i) => {
      const kt = seg(tear, i * 0.12, 0.7 + i * 0.12);
      tmp.lerpVectors(s.home, s.torn, kt);
      const ko = seg(out, i * 0.1, 0.7 + i * 0.1);
      tmp.lerp(s.to, ko);
      s.mesh.position.copy(tmp);
      s.mesh.rotation.z = s.tornR * kt * (1 - ko) + Math.sin(t * 0.9 + i) * 0.04 * ko;
      s.mesh.rotation.y = -receipt.rotation.y * ko;
      const stampIn = seg(out, 0.55 + i * 0.1, 0.8 + i * 0.07);
      (s.stamp.material as THREE.MeshBasicMaterial).opacity = stampIn;
      s.stamp.scale.setScalar(1 + (1 - stampIn) * 0.8);
    });
  }

  return { root, update };
}
