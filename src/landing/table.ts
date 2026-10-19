// "The split" chapter as a 3D table seen from above (after op.al): objects lie
// along the left and right edges and leave the centre free for the letter.
// As the reader scrolls, the camera pans down the table and the objects act
// out each paragraph: the charter gets signed and sealed, the phone shows one
// QR for one payment, one coin becomes three shares that slide to three
// wallets, and a lock and frosted glass close over them.
// Props are built from code (props.ts); a prop listed in SHIPPED is loaded
// from a GLB model file on this site instead.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import qrcode from "qrcode-generator";
import { makeCoin } from "./coin.ts";
import { PROPS } from "./props.ts";

export interface Table {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** story: 0..3, one unit per letter part (charter, pay, split). */
  update(t: number, dt: number, story: number): void;
  resize(w: number, h: number): void;
}

const GOLD = 0xf4b728;
/** Props shipped as model files in public/models/<name>.glb. */
const SHIPPED: string[] = [];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const seg = (v: number, a: number, b: number) => ease(clamp((v - a) / (b - a)));

interface Placed {
  obj: THREE.Object3D;
  side: -1 | 1;
  /** distance from the centre line as a fraction of the visible half-width */
  u: number;
  z: number;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d")!;
  draw(c);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, c, cv };
}

function frostTexture() {
  return canvasTex(512, 512, (c) => {
    const img = c.createImageData(512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.random() * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }).tex;
}

// ---- the charter: drawn on a canvas so its signatures can appear while reading
const SIGS = [
  [[0, 30], [18, 4], [30, 34], [46, 8], [60, 30], [80, 12], [96, 26], [118, 18]],
  [[0, 22], [14, 34], [28, 6], [44, 30], [58, 14], [72, 32], [90, 10], [114, 24]],
  [[0, 26], [20, 12], [34, 32], [50, 6], [64, 28], [84, 16], [100, 30], [120, 14]],
];
function drawCharter(c: CanvasRenderingContext2D, signed: number) {
  const W = c.canvas.width, H = c.canvas.height;
  c.fillStyle = "#f3efe6";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#0b1016";
  c.textAlign = "center";
  c.font = "900 64px Archivo, 'Arial Black', sans-serif";
  c.fillText("CHARTER", W / 2, 120);
  c.font = "500 26px 'Plex Mono', monospace";
  c.fillStyle = "#56606b";
  c.fillText("collective · 3 members · signed", W / 2, 168);
  c.fillRect(70, 200, W - 140, 3);
  const rows = [
    ["Mentor A", "40%", "u1q8f…h6ej9"],
    ["Mentor B", "30%", "u1x3k…6nu5g"],
    ["Mentor C", "30%", "u1m7d…kvkmt"],
  ];
  rows.forEach(([name, share, addr], i) => {
    const y = 300 + i * 250;
    c.textAlign = "left";
    c.fillStyle = "#0b1016";
    c.font = "900 46px Archivo, 'Arial Black', sans-serif";
    c.fillText(name!, 90, y);
    c.textAlign = "right";
    c.fillText(share!, W - 90, y);
    c.textAlign = "left";
    c.font = "500 26px 'Plex Mono', monospace";
    c.fillStyle = "#56606b";
    c.fillText(addr!, 90, y + 46);
    c.strokeStyle = "#c9c2b2";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(90, y + 160);
    c.lineTo(W - 90, y + 160);
    c.stroke();
    // signature stroke, drawn up to its share of `signed`
    const part = clamp(signed * 3 - i);
    if (part > 0) {
      const pts = SIGS[i]!;
      const n = Math.max(2, Math.floor(pts.length * part));
      c.strokeStyle = "#1d3a8a";
      c.lineWidth = 6;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      pts.slice(0, n).forEach(([x, yy], k) => {
        const px = 380 + x! * 3.2, py = y + 150 - yy! * 2.6;
        if (k === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.stroke();
    }
  });
}

function drawReceipt(c: CanvasRenderingContext2D) {
  const W = c.canvas.width;
  c.fillStyle = "#f6f3ec";
  c.fillRect(0, 0, W, c.canvas.height);
  c.fillStyle = "#0b1016";
  c.textAlign = "center";
  c.font = "900 54px Archivo, 'Arial Black', sans-serif";
  c.fillText("B O N B A G I", W / 2, 96);
  c.font = "500 30px 'Plex Mono', monospace";
  const line = (y: number, l: string, r: string, bold = false) => {
    c.font = bold ? "900 40px Archivo, 'Arial Black', sans-serif" : "500 30px 'Plex Mono', monospace";
    c.textAlign = "left";
    c.fillText(l, 50, y);
    c.textAlign = "right";
    c.fillText(r, W - 50, y);
  };
  c.setLineDash([10, 10]);
  c.strokeStyle = "#9a9384";
  c.lineWidth = 3;
  [150, 260, 520].forEach((y) => {
    c.beginPath();
    c.moveTo(40, y);
    c.lineTo(W - 40, y);
    c.stroke();
  });
  line(215, "Class ticket ×1", "0.0100");
  line(330, "Mentor A · 40%", "0.0040");
  line(390, "Mentor B · 30%", "0.0030");
  line(450, "Mentor C · 30%", "0.0030");
  line(600, "TOTAL ZEC", "0.0100", true);
  c.font = "500 26px 'Plex Mono', monospace";
  c.textAlign = "center";
  c.fillStyle = "#56606b";
  c.fillText("1 transaction · 3 shielded outputs", W / 2, 690);
}

function drawPhoneScreen(c: CanvasRenderingContext2D) {
  const W = c.canvas.width, H = c.canvas.height;
  c.fillStyle = "#0c1218";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#e9eef2";
  c.textAlign = "center";
  c.font = "900 44px Archivo, 'Arial Black', sans-serif";
  c.fillText("Pay 0.0100 ZEC", W / 2, 120);
  c.font = "500 24px 'Plex Mono', monospace";
  c.fillStyle = "#93a6b5";
  c.fillText("3 members · signatures valid", W / 2, 166);
  const qr = qrcode(0, "M");
  qr.addData("https://bonbagi.vercel.app/pay.html");
  qr.make();
  const n = qr.getModuleCount(), size = W - 140, cell = size / n, x0 = 70, y0 = 230;
  c.fillStyle = "#f3f6f8";
  c.fillRect(x0 - 24, y0 - 24, size + 48, size + 48);
  c.fillStyle = "#0b1016";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) c.fillRect(x0 + k * cell, y0 + r * cell, cell + 0.5, cell + 0.5);
  c.fillStyle = "#f4b728";
  const by = y0 + size + 90;
  c.fillRect(70, by, W - 140, 96);
  c.fillStyle = "#141006";
  c.font = "900 40px Archivo, 'Arial Black', sans-serif";
  c.fillText("Open in wallet", W / 2, by + 62);
}

/** Scale a loaded model so its longest side is `size`, centre it, and rest it on y = 0. */
function fit(obj: THREE.Object3D, size: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dim.x, dim.y, dim.z);
  obj.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
  const g = new THREE.Group();
  g.add(obj);
  obj.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

export function createTable(renderer: THREE.WebGLRenderer, o: { mobile: boolean }): Table {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a0e);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.up.set(0, 0, -1);

  const key = new THREE.DirectionalLight(0xd8eeff, 1.5);
  key.position.set(-6, 14, -4);
  key.castShadow = !o.mobile;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -14;
  key.shadow.camera.right = key.shadow.camera.top = 14;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0x9fc3d8, 0x05070a, 0.45));
  const warm = new THREE.PointLight(GOLD, 0, 7, 1.6);
  scene.add(warm);

  // frosted glass table
  const frost = frostTexture();
  frost.wrapS = frost.wrapT = THREE.RepeatWrapping;
  frost.repeat.set(6, 12);
  const tableMat = new THREE.MeshPhysicalMaterial({ color: 0x18222c, roughness: 0.6, roughnessMap: frost, bumpMap: frost, bumpScale: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.5, metalness: 0.05 });
  const tableTop = new THREE.Mesh(new THREE.PlaneGeometry(60, 90), tableMat);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.receiveShadow = true;
  scene.add(tableTop);

  const placed: Placed[] = [];
  const put = (obj: THREE.Object3D, side: -1 | 1, u: number, z: number, rotY = 0) => {
    obj.rotation.y = rotY;
    scene.add(obj);
    placed.push({ obj, side, u, z });
    return obj;
  };
  const paperMat = (tex: THREE.Texture) => new THREE.MeshStandardMaterial({ map: tex, color: 0xd9d5cc, roughness: 0.92, envMapIntensity: 0.3 });
  const flatPaper = (w: number, h: number, tex: THREE.Texture) => {
    const edge = new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.92 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, h), [edge, edge, paperMat(tex), edge, edge, edge]);
    m.castShadow = m.receiveShadow = true;
    m.position.y = 0.011;
    const g = new THREE.Group();
    g.add(m);
    return g;
  };

  // ---------- part 1 · the charter (left), pens and seal (right)
  const charter = canvasTex(1024, 1100, (c) => drawCharter(c, 0));
  const charterObj = put(flatPaper(3.3, 3.55, charter.tex), -1, 0.7, -7.0, 0.06);
  let charterSigned = -1;
  const sealMat = new THREE.MeshPhysicalMaterial({ color: 0x9c1d16, roughness: 0.35, clearcoat: 0.8 });
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.08, 48), sealMat);
  seal.castShadow = true;
  seal.position.set(1.1, 0.05, 1.35);
  seal.scale.setScalar(0.0001);
  charterObj.add(seal);

  const ice = new THREE.MeshPhysicalMaterial({ color: 0xe6f6ff, roughness: 0.08, transmission: o.mobile ? 0 : 0.95, thickness: 0.4, ior: 1.31, transparent: o.mobile, opacity: o.mobile ? 0.75 : 1 });
  const cubeGeo = new RoundedBoxGeometry(0.55, 0.55, 0.55, 3, 0.08);
  const cube = (side: -1 | 1, u: number, z: number, r: number) => {
    const m = new THREE.Mesh(cubeGeo, ice);
    m.castShadow = true;
    m.position.y = 0.275;
    const g = new THREE.Group();
    g.add(m);
    put(g, side, u, z, r);
  };
  cube(1, 0.9, -9.6, 0.4);
  cube(1, 0.8, -9.3, 1.1);
  cube(-1, 0.9, -4.4, 0.7);

  // ---------- part 2 · one QR, one payment (phone + receipt right, coin left)
  const phone = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.14, 3.8, 4, 0.2), new THREE.MeshPhysicalMaterial({ color: 0x0d1117, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
  body.position.y = 0.07;
  body.castShadow = true;
  const screenTex = canvasTex(640, 1280, drawPhoneScreen);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex.tex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 3.52), screenMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.145;
  phone.add(body, screen);
  put(phone, 1, 0.7, -0.5, -0.12);

  const receipt = canvasTex(640, 740, drawReceipt);
  const receiptObj = put(flatPaper(1.9, 2.2, receipt.tex), 1, 0.72, 2.2, 0.08);

  const goldMat = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.22, clearcoat: 0.5, emissive: 0x4a2c00, emissiveIntensity: 0.3 });
  const coinFlat = () => {
    const c = makeCoin(goldMat);
    c.rotation.x = -Math.PI / 2;
    c.position.y = 0.1;
    c.scale.setScalar(1.3);
    c.traverse((m) => ((m as THREE.Mesh).castShadow = true));
    const g = new THREE.Group();
    g.add(c);
    return g;
  };
  const payCoin = put(coinFlat(), -1, 0.7, 0.1);
  cube(-1, 0.86, -2.0, 0.2);
  cube(-1, 0.8, 2.2, 0.9);
  cube(1, 0.92, -3.2, 0.5);

  // ---------- part 3 · the split (wallets left, lock right)
  const walletZ = [5.2, 7.1, 9.0];
  const shares = walletZ.map(() => put(coinFlat(), -1, 0.66, 5.2));
  const shareFrom = { u: 0.66, z: 3.6 };
  const splitCoin = put(coinFlat(), -1, 0.66, 3.6);
  const frostPane = new THREE.Mesh(
    new RoundedBoxGeometry(2.8, 0.08, 2.0, 3, 0.04),
    new THREE.MeshPhysicalMaterial({ color: 0xdaf0fa, roughness: 0.55, transmission: o.mobile ? 0 : 0.9, thickness: 0.3, transparent: o.mobile, opacity: o.mobile ? 0.6 : 1 }),
  );
  frostPane.castShadow = true;
  const paneG = new THREE.Group();
  paneG.add(frostPane);
  put(paneG, 1, 0.7, 7.0, 0.05);
  cube(1, 0.9, 10.2, 0.5);

  // ---------- props (model file when shipped, otherwise built from code)
  const loader = new GLTFLoader();
  const want: [string, number, (g: THREE.Group) => void][] = [
    ["pen", 3.2, (g) => {
      put(g, 1, 0.66, -8.1, 0.5);
      const g2 = g.clone();
      put(g2, 1, 0.8, -6.9, -0.25);
      const g3 = g.clone();
      put(g3, -1, 0.9, -9.8, 1.2);
    }],
    ["stamp", 1.5, (g) => put(g, 1, 0.74, -5.3, 0.3)],
    ["wallet", 1.8, (g) => {
      walletZ.forEach((z, i) => put(i ? g.clone() : g, -1, 0.8, z, 0.15 - i * 0.12));
    }],
    ["padlock", 1.4, (g) => put(g, 1, 0.82, 5.1, -0.4)],
    ["scale", 2.4, (g) => put(g, 1, 0.72, 9.1, 0.2)],
  ];
  for (const [name, size, place] of want) {
    // laid out by the first resize(), which runs right after creation
    const build = () => place(fit(PROPS[name]!(), size));
    if (!SHIPPED.includes(name)) {
      build();
      continue;
    }
    loader.load(
      `/models/${name}.glb`,
      (gltf) => {
        place(fit(gltf.scene, size));
        layout();
      },
      undefined,
      build,
    );
  }

  let halfW = 6;
  let height = 14;
  function layout() {
    for (const p of placed) p.obj.position.set(p.side * p.u * halfW, p.obj.position.y, p.z);
  }
  function resize(w: number, h: number) {
    const aspect = w / h;
    camera.aspect = aspect;
    height = aspect < 1 ? 22 : 14;
    camera.updateProjectionMatrix();
    halfW = Math.max(height * Math.tan(THREE.MathUtils.degToRad(15)) * aspect, 2.6);
    if (aspect < 1) halfW = Math.max(halfW, 3.2);
    layout();
  }

  function update(t: number, _dt: number, story: number) {
    const s = clamp(story, 0, 3);
    const z = -10.5 + s * 7;
    camera.position.set(Math.sin(t * 0.1) * 0.15, height, z + height * 0.32);
    camera.lookAt(0, 0, z);
    key.position.set(-6, 14, z - 4);
    key.target.position.set(0, 0, z);

    const p0 = clamp(s), p1 = clamp(s - 1), p2 = clamp(s - 2);
    // part 1: signatures, then the seal lands
    const signed = Math.round(seg(p0, 0.15, 0.75) * 48) / 48;
    if (signed !== charterSigned) {
      charterSigned = signed;
      drawCharter(charter.c, signed);
      charter.tex.needsUpdate = true;
    }
    const sealIn = seg(p0, 0.75, 0.9);
    seal.scale.setScalar(Math.max(sealIn, 0.0001));
    seal.position.y = 0.05 + (1 - sealIn) * 0.6;

    // part 2: the coin glows, the receipt prints out from under the phone
    const glow = seg(p1, 0.1, 0.5) * (1 - seg(p2, 0.0, 0.2));
    goldMat.emissiveIntensity = 0.3 + glow * 1.4;
    warm.intensity = glow * 14;
    warm.position.set(payCoin.position.x, 1.2, payCoin.position.z);
    payCoin.rotation.y = t * 0.3;
    receiptObj.position.z = 1.3 - (1 - seg(p1, 0.25, 0.8)) * 1.4;
    screenMat.color.setScalar(0.55 + 0.45 * seg(p1, 0.0, 0.3));

    // part 3: one coin → three shares → three wallets; the pane slides over
    const sp = seg(p2, 0.05, 0.55);
    splitCoin.scale.setScalar(Math.max(1 - sp * 1.3, 0.0001));
    shares.forEach((c, i) => {
      const k = seg(p2, 0.12 + i * 0.06, 0.6 + i * 0.06);
      const zTo = walletZ[i]! - 0.2;
      c.position.z = THREE.MathUtils.lerp(shareFrom.z, zTo, k);
      c.position.x = -halfW * THREE.MathUtils.lerp(shareFrom.u, 0.66, k);
      c.scale.setScalar(k > 0 ? 0.7 : 0.0001);
      c.rotation.y = t * 0.4 + i;
    });
    const pane = seg(p2, 0.55, 0.9);
    paneG.position.x = halfW * THREE.MathUtils.lerp(1.05, 0.7, pane);
    paneG.position.y = 0.04 + (1 - pane) * 0.5;
  }

  return { scene, camera, update, resize };
}
