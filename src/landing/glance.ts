// "At a glance" bento (after Zentry): every card gets its own small 3D object,
// drawn by one WebGL canvas that sits over the cards and renders each scene
// into its card's `.gl-obj` box (scissor viewports). Hovering a card spins it.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { makeCoin } from "./coin.ts";
import { loadProp, makePhone } from "./props.ts";

const GOLD = 0xf4b728;

interface Slot {
  card: HTMLElement;
  box: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  spin: number;
  hover: number;
  tick(t: number): void;
}

function centred(obj: THREE.Object3D, size: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(size / Math.max(dim.x, dim.y, dim.z));
  const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
  obj.position.sub(c);
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

function build(kind: string, gold: THREE.MeshPhysicalMaterial): { root: THREE.Group; tick(t: number): void } {
  const root = new THREE.Group();
  switch (kind) {
    case "coin": {
      const c = makeCoin(gold);
      c.scale.setScalar(1.55);
      root.add(c);
      return { root, tick: (t) => (c.rotation.y = t * 0.8) };
    }
    case "shares": {
      const coins = [0, 1, 2].map((i) => {
        const c = makeCoin(gold);
        c.scale.setScalar(i === 0 ? 0.78 : 0.62);
        root.add(c);
        return c;
      });
      return {
        root,
        tick: (t) =>
          coins.forEach((c, i) => {
            const a = t * 0.6 + (i * Math.PI * 2) / 3;
            c.position.set(Math.cos(a) * 1.05, Math.sin(t * 1.3 + i) * 0.12, Math.sin(a) * 0.5);
            c.rotation.y = t * 1.2 + i;
          }),
      };
    }
    case "vault": {
      // an empty glass box: nothing (and nobody) sits in the middle
      const glass = new THREE.Mesh(
        new RoundedBoxGeometry(1.7, 1.7, 1.7, 4, 0.12),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transmission: 0.96, thickness: 0.6, ior: 1.4, transparent: true, opacity: 0.55 }),
      );
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.7, 1.7, 1.7)), new THREE.LineBasicMaterial({ color: 0x141006 }));
      root.add(glass, edges);
      root.rotation.set(0.45, 0.6, 0);
      return { root, tick: (t) => (root.rotation.y = 0.6 + t * 0.35) };
    }
    case "stamp": {
      const s = new THREE.Group();
      void loadProp("stamp").then((m) => s.add(centred(m, 2.2)));
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.1, 48), new THREE.MeshPhysicalMaterial({ color: 0x9c1d16, roughness: 0.35, clearcoat: 0.8 }));
      seal.position.y = -1.25;
      root.add(s, seal);
      root.rotation.x = 0.35;
      return { root, tick: (t) => {
        s.position.y = 0.1 + Math.abs(Math.sin(t * 1.4)) * 0.35;
        root.rotation.y = t * 0.4;
      } };
    }
    case "lock": {
      const l = new THREE.Group();
      void loadProp("padlock").then((m) => {
        const c = centred(m, 2.0);
        if (!m.userData.shipped) c.rotation.x = Math.PI / 2;
        l.add(c);
      });
      root.add(l);
      return { root, tick: (t) => (root.rotation.y = Math.sin(t * 0.7) * 0.6) };
    }
    case "phone":
    default: {
      const p = centred(makePhone(), 2.6);
      p.rotation.x = Math.PI / 2 - 0.25;
      root.add(p);
      return { root, tick: (t) => (root.rotation.y = Math.sin(t * 0.6) * 0.5) };
    }
  }
}

export function createGlance(canvas: HTMLCanvasElement, cards: HTMLElement[], o: { mobile: boolean; still: boolean }) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, o.mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0);
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const gold = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.22, clearcoat: 0.5 });

  const slots: Slot[] = cards.map((card) => {
    const scene = new THREE.Scene();
    scene.environment = env;
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 4, 5);
    scene.add(key, new THREE.HemisphereLight(0xdff4ff, 0x20242a, 0.6));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 7);
    const { root, tick } = build(card.dataset.obj ?? "coin", gold);
    scene.add(root);
    const slot: Slot = { card, box: card.querySelector<HTMLElement>(".gl-obj") ?? card, scene, camera, root, spin: 0, hover: 0, tick };
    card.addEventListener("pointerenter", () => (slot.hover = 1));
    card.addEventListener("pointerleave", () => (slot.hover = 0));
    return slot;
  });

  let on = false;
  const clock = new THREE.Clock();
  function draw() {
    const w = window.innerWidth, h = window.innerHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    renderer.setScissor(0, 0, w, h);
    renderer.clear();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    for (const s of slots) {
      const r = s.box.getBoundingClientRect();
      if (r.bottom < 0 || r.top > h || r.width < 2 || r.height < 2) continue;
      s.spin += (s.hover * 2.2 - s.spin) * 0.08;
      s.tick(o.still ? 0 : t + s.spin * t * 0.15);
      s.root.position.y = o.still ? 0 : Math.sin(t * 0.9 + r.left) * 0.08;
      s.camera.aspect = r.width / r.height;
      s.camera.position.z = r.width < r.height ? 9 : 7;
      s.camera.updateProjectionMatrix();
      const y = h - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setScissor(r.left, y, r.width, r.height);
      renderer.render(s.scene, s.camera);
    }
    void dt;
  }
  function loop() {
    if (on) draw();
    if (!o.still) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return {
    /** Start or stop drawing (the section entering or leaving the screen). */
    active(v: boolean) {
      on = v;
      canvas.classList.toggle("on", v);
      if (v && o.still) draw();
    },
    redraw() {
      if (on) draw();
    },
  };
}
