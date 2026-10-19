// The landing's WebGL stage: a night snowfield, a pile of glossy ice blocks
// that assemble into a sealed dome around a gold coin (the "shielded" vault),
// then burst and split the coin into three shares. Built from code only: no
// model files, no textures from the network (the CSP allows only this site).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { makeCoin } from "./coin.ts";
import { createTable } from "./table.ts";

export interface Look {
  /** 0 = loose blocks floating, 1 = sealed dome. */
  assemble: number;
  /** 0 = dome intact, 1 = blocks thrown back out (returns to the loose state). */
  burst: number;
  /** 0 = one coin, 1 = three shares apart. */
  split: number;
  /** 1 = fully covered by page content; rendering pauses. */
  dim: number;
  /** > 0.5 = the letter chapter is on screen: render the table scene. */
  table: number;
  /** progress through the letter, 0..3 (one unit per part). */
  story: number;
}

export interface Stage {
  set(look: Partial<Look>): void;
  glitch(amount?: number): void;
  pointer(nx: number, ny: number): void;
  onReady(fn: () => void): void;
}

const NIGHT = 0x0a0d12;
const GOLD = 0xf4b728;
const ICE = 0xdff4ff;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Small value-noise for the terrain (deterministic, no textures needed).
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  let f = 0, amp = 0.5, fr = 1;
  for (let i = 0; i < 5; i++) {
    f += amp * vnoise(x * fr, y * fr);
    fr *= 2.03;
    amp *= 0.5;
  }
  return f;
}

function makeTerrain(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(180, 180, 180, 180);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const ridge = THREE.MathUtils.smoothstep(d, 7, 34);
    const h = fbm(x * 0.05 + 3, z * 0.05 - 7) * 13 * ridge + (fbm(x * 0.4, z * 0.4) - 0.5) * 0.35;
    pos.setY(i, h - 0.05);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4f6170, roughness: 0.97, metalness: 0, envMapIntensity: 0.25 });
  return new THREE.Mesh(geo, mat);
}

function snowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d")!;
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.4, "rgba(230,245,255,.6)");
  gr.addColorStop(1, "rgba(230,245,255,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const GlitchShader = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uAmt; uniform float uTime; varying vec2 vUv;
    float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float band = floor(uv.y * 28.0);
      float tick = floor(uTime * 18.0);
      float on = step(0.55, rnd(vec2(band * 1.7, tick)));
      uv.x += (rnd(vec2(band, tick)) - 0.5) * 0.09 * uAmt * on;
      float ca = 0.014 * uAmt + 0.0012;
      vec4 c;
      c.r = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;
      c.a = 1.0;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * 0.85;
      gl_FragColor = c;
    }`,
};

export function createStage(canvas: HTMLCanvasElement, o: { mobile: boolean; still: boolean }): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !o.mobile, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, o.mobile ? 1.3 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !o.mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.FogExp2(NIGHT, 0.042);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 220);

  const moon = new THREE.DirectionalLight(0xbfe3ff, 1.25);
  moon.position.set(-7, 11, 6);
  scene.add(moon);
  scene.add(new THREE.HemisphereLight(0x8fb4cc, 0x05070a, 0.35));
  const ember = new THREE.PointLight(GOLD, 8, 10, 1.5);
  ember.position.set(0, 0.9, 0.2);
  scene.add(ember);

  scene.add(makeTerrain());

  // ---- coin and its three shares
  const goldMat = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.2, clearcoat: 0.5, emissive: 0x4a2c00, emissiveIntensity: 0.4 });
  const coin = makeCoin(goldMat);
  scene.add(coin);
  const shares = [0, 1, 2].map(() => {
    const c = makeCoin(goldMat);
    c.visible = false;
    scene.add(c);
    return c;
  });
  const shareTo = [new THREE.Vector3(-2.3, 1.5, 1.4), new THREE.Vector3(0, 2.5, 1.9), new THREE.Vector3(2.3, 1.5, 1.4)];
  const shareSize = [0.66, 0.56, 0.56];

  // ---- ice blocks: dome ("sealed") and pile ("loose") poses
  const domeR = 2.05, baseY = 0.22;
  const ringPhi = [0.11, 0.41, 0.71, 1.0, 1.28];
  const ringCount = [14, 13, 11, 8, 4];
  const domePos: THREE.Vector3[] = [], domeQ: THREE.Quaternion[] = [], ringOf: number[] = [];
  const dummy = new THREE.Object3D();
  ringPhi.forEach((phi, r) => {
    const n = ringCount[r]!;
    for (let j = 0; j < n; j++) {
      const th = ((j + (r % 2) * 0.5) / n) * Math.PI * 2;
      const p = new THREE.Vector3(domeR * Math.cos(phi) * Math.cos(th), baseY + domeR * Math.sin(phi), domeR * Math.cos(phi) * Math.sin(th));
      dummy.position.copy(p);
      dummy.lookAt(0, baseY, 0);
      domePos.push(p);
      domeQ.push(dummy.quaternion.clone());
      ringOf.push(r);
    }
  });
  // cap
  dummy.position.set(0, baseY + domeR + 0.02, 0);
  dummy.rotation.set(-Math.PI / 2, 0, 0.4);
  domePos.push(dummy.position.clone());
  domeQ.push(dummy.quaternion.clone());
  ringOf.push(5);
  const N = domePos.length;

  const rand = (a: number, b: number, i: number, k: number) => a + (b - a) * hash(i * 3.1 + k, k * 7.3 + i);
  const pilePos: THREE.Vector3[] = [], pileQ: THREE.Quaternion[] = [];
  for (let i = 0; i < N; i++) {
    const a = rand(0, Math.PI * 2, i, 1), r = rand(0.9, 3.0, i, 2), y = rand(0.7, 3.9, i, 3);
    pilePos.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.75));
    dummy.rotation.set(rand(0, 6.3, i, 4), rand(0, 6.3, i, 5), rand(0, 6.3, i, 6));
    pileQ.push(dummy.quaternion.clone());
  }

  const iceMat = o.mobile
    ? new THREE.MeshPhysicalMaterial({ color: 0xd6f0fa, roughness: 0.3, clearcoat: 1, transparent: true, opacity: 0.88, emissive: 0x2a6f86, emissiveIntensity: 0.6 })
    : new THREE.MeshPhysicalMaterial({
        color: ICE, roughness: 0.32, metalness: 0, transmission: 0.7, thickness: 0.9, ior: 1.31,
        clearcoat: 1, clearcoatRoughness: 0.1, attenuationColor: new THREE.Color(0x7fc7de), attenuationDistance: 0.9,
        sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xcff3ff),
        emissive: 0x2a6f86, emissiveIntensity: 0.55,
      });
  const blocks = new THREE.InstancedMesh(new RoundedBoxGeometry(0.8, 0.43, 0.42, 3, 0.07), iceMat, N);
  blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(blocks);

  // pointer springs (Lusion-style push)
  const off = Array.from({ length: N }, () => new THREE.Vector3());
  const vel = Array.from({ length: N }, () => new THREE.Vector3());
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane();
  let pointerActive = false;

  // ---- snow
  const flakes = o.mobile ? 600 : 1500;
  const snowGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(flakes * 3);
  for (let i = 0; i < flakes; i++) {
    sp[i * 3] = rand(-22, 22, i, 8);
    sp[i * 3 + 1] = rand(0, 14, i, 9);
    sp[i * 3 + 2] = rand(-24, 10, i, 10);
  }
  snowGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.07, map: snowTexture(), transparent: true, depthWrite: false, opacity: 0.85, color: 0xe6f4ff }));
  scene.add(snow);

  // ---- post
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const table = createTable(renderer, { mobile: o.mobile });
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.65, 0.8);
  if (!o.mobile) composer.addPass(bloom);
  const glitchPass = new ShaderPass(GlitchShader);
  composer.addPass(glitchPass);
  composer.addPass(new OutputPass());

  const target: Look = { assemble: 0, burst: 0, split: 0, dim: 0, table: 0, story: 0 };
  const cur: Look = { ...target };
  let glitchAmt = 0;
  const parallax = new THREE.Vector2();
  const camLoose = new THREE.Vector3(0.6, 2.9, 12.5), lookLoose = new THREE.Vector3(-2.6, 2.0, 0);
  const camSealed = new THREE.Vector3(6.4, 3.4, 9.4), lookSealed = new THREE.Vector3(-2.5, 1.1, 0);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1), mtx = new THREE.Matrix4();

  let portrait = false;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 58 : 36;
    portrait = w < h;
    camera.updateProjectionMatrix();
    table.resize(w, h);
  }
  resize();
  window.addEventListener("resize", () => {
    resize();
    if (o.still) frame(0);
  });

  const clock = new THREE.Clock();
  let readyFns: (() => void)[] = [];
  let ready = false;

  function frame(dt: number) {
    const t = clock.elapsedTime;
    const k = o.still ? 1 : 0.075;
    (Object.keys(target) as (keyof Look)[]).forEach((key) => (cur[key] += (target[key] - cur[key]) * k));
    if (target.table > 0.5) {
      cur.story += (target.story - cur.story) * (o.still ? 1 : 0.1);
      table.update(t, dt, cur.story);
      renderPass.scene = table.scene;
      renderPass.camera = table.camera;
      bloom.enabled = false;
      glitchAmt *= 0.9;
      glitchPass.uniforms.uAmt!.value = glitchAmt;
      glitchPass.uniforms.uTime!.value = t;
      composer.render(dt);
      return;
    }
    renderPass.scene = scene;
    renderPass.camera = camera;
    bloom.enabled = true;
    const A = clamp(cur.assemble * (1 - cur.burst));
    const burstKick = Math.sin(clamp(cur.burst) * Math.PI);

    // camera
    camPos.lerpVectors(camLoose, camSealed, ease(A));
    camLook.lerpVectors(lookLoose, lookSealed, ease(A));
    if (portrait) {
      camLook.x = 0;
      camLook.y -= 1.9;
      camPos.x *= 0.4;
      camPos.z += 2.5;
    }
    const orbit = Math.sin(t * 0.07) * 0.35;
    camPos.x += orbit + parallax.x * 0.5;
    camPos.y += parallax.y * 0.3;
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // pointer target point on a plane facing the camera
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tmpP).negate(), camLook);
    let hasHit = false;
    if (pointerActive) {
      ray.setFromCamera(ndc, camera);
      hasHit = ray.ray.intersectPlane(plane, hit) !== null;
    }
    const push = 0.05 * (1 - A * 0.75);

    for (let i = 0; i < N; i++) {
      const delay = (ringOf[i]! / 5) * 0.42;
      const ti = ease(clamp((A - delay) / 0.58));
      tmpP.lerpVectors(pilePos[i]!, domePos[i]!, ti);
      tmpP.y += Math.sin(ti * Math.PI) * 0.9;
      const loose = 1 - ti;
      tmpP.y += Math.sin(t * 0.9 + i * 1.7) * 0.12 * loose;
      tmpP.x += Math.cos(t * 0.6 + i) * 0.06 * loose;
      // burst throws blocks outward on the way back to the pile
      if (burstKick > 0.001) {
        const dir = domePos[i]!.clone().setY(0).normalize();
        tmpP.addScaledVector(dir, burstKick * 1.6);
        tmpP.y += burstKick * 0.8;
      }
      // springs
      const v = vel[i]!, d = off[i]!;
      if (hasHit) {
        const away = tmpP.clone().add(d).sub(hit);
        const dist = away.length();
        if (dist < 1.7) v.addScaledVector(away.normalize(), (1.7 - dist) * push);
      }
      v.addScaledVector(d, -0.045).multiplyScalar(0.9);
      d.add(v);
      tmpP.add(d);
      tmpQ.slerpQuaternions(pileQ[i]!, domeQ[i]!, ti);
      if (loose > 0.01) {
        dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0.3, 1, 0.2).normalize(), t * 0.25 * loose + i);
        tmpQ.multiply(dummy.quaternion.slerp(new THREE.Quaternion(), ti));
      }
      const spin = v.length() * 2.5;
      if (spin > 0.001) tmpQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(v.z, 0, -v.x).normalize(), spin));
      mtx.compose(tmpP, tmpQ, tmpS);
      blocks.setMatrixAt(i, mtx);
    }
    blocks.instanceMatrix.needsUpdate = true;

    // coin
    const split = ease(clamp(cur.split));
    coin.position.set(0, mix(2.1, 0.95, ease(A)) + Math.sin(t * 1.1) * 0.06, 0);
    coin.rotation.y = t * 0.55;
    coin.rotation.z = Math.sin(t * 0.4) * 0.08;
    const main = 1 - clamp(split * 1.4);
    coin.scale.setScalar(Math.max(main, 0.0001));
    coin.visible = main > 0.01;
    shares.forEach((s, i) => {
      s.visible = split > 0.01;
      s.position.lerpVectors(coin.position, shareTo[i]!, split);
      s.scale.setScalar(Math.max(shareSize[i]! * clamp(split * 1.6), 0.0001));
      s.rotation.y = t * 0.8 + i * 2;
    });
    ember.position.copy(coin.position);
    ember.intensity = 6 + 26 * A + 14 * split;
    goldMat.emissiveIntensity = 0.3 + 0.9 * A + 0.6 * split;

    // snow
    const arr = snowGeo.attributes.position as THREE.BufferAttribute;
    if (!o.still) {
      for (let i = 0; i < flakes; i++) {
        let y = arr.getY(i) - dt * (0.35 + (i % 7) * 0.05);
        if (y < 0) y += 14;
        arr.setY(i, y);
        arr.setX(i, arr.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.08);
      }
      arr.needsUpdate = true;
    }

    glitchAmt *= 0.9;
    glitchPass.uniforms.uAmt!.value = glitchAmt;
    glitchPass.uniforms.uTime!.value = t;
    composer.render(dt);
    if (!ready) {
      ready = true;
      readyFns.forEach((f) => f());
      readyFns = [];
    }
  }

  if (o.still) {
    target.assemble = cur.assemble = 1;
    clock.getDelta();
    frame(0);
  } else {
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      if (target.dim < 0.985 && !document.hidden) frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  return {
    set(look) {
      Object.assign(target, look);
      if (o.still) frame(0);
    },
    glitch(amount = 1) {
      if (!o.still) glitchAmt = Math.max(glitchAmt, amount);
    },
    pointer(nx, ny) {
      pointerActive = true;
      ndc.set(nx, ny);
      parallax.set(nx, ny);
    },
    onReady(fn) {
      if (ready) fn();
      else readyFns.push(fn);
    },
  };
}
