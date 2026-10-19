// Table props built from code: fountain pen, brass seal stamp, leather wallet,
// padlock and balance scale. Used when no model file is shipped for them.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const brass = () => new THREE.MeshPhysicalMaterial({ color: 0xc89b4a, metalness: 1, roughness: 0.28, clearcoat: 0.3 });
const steel = () => new THREE.MeshPhysicalMaterial({ color: 0xb9c1c9, metalness: 1, roughness: 0.22 });
const gold = () => new THREE.MeshPhysicalMaterial({ color: 0xe7b84a, metalness: 1, roughness: 0.18 });

function lathe(points: [number, number][], segments = 48) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

/** Closed fountain pen lying along x. */
export function makePen(): THREE.Group {
  const g = new THREE.Group();
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const body = new THREE.Mesh(lathe([[0, 0], [0.07, 0.02], [0.095, 0.25], [0.1, 1.55], [0.11, 1.6], [0.11, 2.55], [0.09, 2.7], [0, 2.72]]), lacquer);
  const bandA = new THREE.Mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.05, 40), gold());
  bandA.position.y = 1.62;
  const bandB = bandA.clone();
  bandB.position.y = 2.5;
  const clip = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.85, 0.06, 2, 0.02), gold());
  clip.position.set(0, 2.2, 0.13);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), gold());
  finial.position.y = 2.72;
  g.add(body, bandA, bandB, clip, finial);
  g.rotation.z = -Math.PI / 2;
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

/** Brass wax-seal stamp with a turned walnut handle, standing. */
export function makeStamp(): THREE.Group {
  const g = new THREE.Group();
  const walnut = new THREE.MeshPhysicalMaterial({ color: 0x4a2c1a, roughness: 0.45, clearcoat: 0.6 });
  const base = new THREE.Mesh(lathe([[0, 0], [0.34, 0], [0.34, 0.1], [0.24, 0.16], [0.12, 0.26], [0.1, 0.42], [0, 0.42]]), brass());
  const handle = new THREE.Mesh(lathe([[0, 0.4], [0.13, 0.4], [0.2, 0.55], [0.15, 0.8], [0.12, 1.0], [0.19, 1.2], [0.22, 1.36], [0.16, 1.5], [0, 1.54]]), walnut);
  g.add(base, handle);
  return g;
}

/** Closed bifold wallet in dark navy leather, lying flat. */
export function makeWallet(): THREE.Group {
  const g = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x1a2438, roughness: 0.72, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x5c6c8c) });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.24, 1.36, 4, 0.1), leather);
  body.position.y = 0.12;
  const stitchMat = new THREE.MeshStandardMaterial({ color: 0x8e9ab0, roughness: 0.8 });
  const stitch = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 4, 64), stitchMat);
  stitch.scale.set(0.82, 0.6, 1);
  stitch.rotation.x = Math.PI / 2;
  stitch.position.y = 0.245;
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 1.36), new THREE.MeshStandardMaterial({ color: 0x0e1422, roughness: 0.9 }));
  fold.position.set(-0.86, 0.24, 0);
  g.add(body, stitch, fold);
  return g;
}

/** Brass padlock lying on its back, shackle closed. */
export function makePadlock(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.9, 0.42, 4, 0.12), brass());
  body.position.y = 0.45;
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.075, 16, 40, Math.PI), steel());
  shackle.position.y = 0.9;
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.25, 16), steel());
  legL.position.set(-0.3, 0.92, 0);
  const legR = legL.clone();
  legR.position.x = 0.3;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x120c06 }));
  hole.rotation.x = Math.PI / 2;
  hole.position.set(0, 0.5, 0.215);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), hole.material);
  slot.position.set(0, 0.38, 0.215);
  g.add(body, shackle, legL, legR, hole, slot);
  g.rotation.x = -Math.PI / 2;
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

/** Antique brass balance scale with two level pans. */
export function makeScale(): THREE.Group {
  const g = new THREE.Group();
  const m = brass();
  const foot = new THREE.Mesh(lathe([[0, 0], [0.62, 0], [0.62, 0.06], [0.42, 0.12], [0.12, 0.2], [0, 0.2]]), m);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.0, 24), m);
  post.position.y = 1.15;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), m);
  knob.position.y = 2.25;
  const beam = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.07, 0.07, 2, 0.03), m);
  beam.position.y = 2.05;
  g.add(foot, post, knob, beam);
  for (const side of [-1, 1]) {
    const x = side * 1.2;
    for (const dz of [-0.22, 0.22]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), m);
      chain.position.set(x, 1.5, dz);
      chain.rotation.x = dz > 0 ? -0.2 : 0.2;
      g.add(chain);
    }
    const pan = new THREE.Mesh(lathe([[0, 0], [0.32, 0.02], [0.45, 0.1], [0.48, 0.16], [0.46, 0.16], [0.43, 0.11], [0.3, 0.04], [0, 0.02]]), m);
    pan.position.set(x, 0.92, 0);
    g.add(pan);
  }
  return g;
}

export const PROPS: Record<string, () => THREE.Group> = {
  pen: makePen,
  stamp: makeStamp,
  wallet: makeWallet,
  padlock: makePadlock,
  scale: makeScale,
};
