// The gold coin used by both scenes: a disc with a rim and a raised "Z" with
// a tick above and below on each face.

import * as THREE from "three";

export function makeCoin(material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 96), material);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  for (const z of [0.07, -0.07]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.565, 0.034, 16, 96), material);
    rim.position.z = z;
    g.add(rim);
  }
  // A "Z" with a tick above and below, extruded on both faces.
  const s = new THREE.Shape();
  s.moveTo(-0.24, 0.25); s.lineTo(0.24, 0.25); s.lineTo(0.24, 0.16); s.lineTo(-0.09, -0.16);
  s.lineTo(0.24, -0.16); s.lineTo(0.24, -0.25); s.lineTo(-0.24, -0.25); s.lineTo(-0.24, -0.16);
  s.lineTo(0.09, 0.16); s.lineTo(-0.24, 0.16); s.closePath();
  const zGeo = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  const tick = new THREE.BoxGeometry(0.06, 0.09, 0.035);
  for (const side of [1, -1]) {
    const z = new THREE.Mesh(zGeo, material);
    z.position.z = 0.07 * side;
    if (side < 0) z.rotation.y = Math.PI;
    g.add(z);
    for (const y of [0.3, -0.3]) {
      const t = new THREE.Mesh(tick, material);
      t.position.set(0, y, 0.085 * side);
      g.add(t);
    }
  }
  return g;
}
