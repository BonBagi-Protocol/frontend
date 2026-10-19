// The landing's WebGL stage. Hero: "bon di balik es" (bon.ts), a paper receipt
// that three signed ice slabs shield, tear and deliver. The letter chapter
// switches the same renderer to the 3D table (table.ts). No network: every
// texture is drawn in code, models come from this site only.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createBon } from "./bon.ts";
import { createTable } from "./table.ts";

export interface Look {
  /** 0 = no ice, 1 = the signed ice slabs closed in front of the receipt. */
  assemble: number;
  /** 0 = ice closed, 1 = ice opened again (end of the loop). */
  burst: number;
  /** 0 = shares at the receipt, 1 = shares delivered to the members. */
  split: number;
  /** 0 = one receipt, 1 = torn into its shares. */
  tear: number;
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

const NIGHT = 0x0d0c0b; // warm black, close to the Zcash black
const GOLD = 0xf4b728;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

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
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !o.mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.FogExp2(NIGHT, 0.05);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  const key = new THREE.DirectionalLight(0xfff4e2, 2.0);
  key.position.set(-4, 6, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe8f5, 1.2);
  rim.position.set(5, 2, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x0d0c0b, 0.35));
  const glow = new THREE.PointLight(GOLD, 6, 9, 1.6);
  glow.position.set(0, -1, 2.4);
  scene.add(glow);

  // dark, slightly glossy floor far below so the paper floats in a studio
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.55, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.4;
  scene.add(floor);

  const bon = createBon({ mobile: o.mobile });
  scene.add(bon.root);

  // a little snow, the cold that makes the ice
  const flakes = o.mobile ? 300 : 700;
  const snowGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(flakes * 3);
  for (let i = 0; i < flakes; i++) {
    sp[i * 3] = (hash(i, 8) - 0.5) * 30;
    sp[i * 3 + 1] = (hash(i, 9) - 0.3) * 12;
    sp[i * 3 + 2] = (hash(i, 10) - 0.7) * 20;
  }
  snowGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.05, map: snowTexture(), transparent: true, depthWrite: false, opacity: 0.7, color: 0xf3f6f8 })));

  // ---- post
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const table = createTable(renderer, { mobile: o.mobile });
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.86);
  if (!o.mobile) composer.addPass(bloom);
  const glitchPass = new ShaderPass(GlitchShader);
  composer.addPass(glitchPass);
  composer.addPass(new OutputPass());

  const target: Look = { assemble: 0, burst: 0, split: 0, tear: 0, dim: 0, table: 0, story: 0 };
  const cur: Look = { ...target };
  let glitchAmt = 0;
  const tilt = new THREE.Vector2();
  const tiltCur = new THREE.Vector2();

  let portrait = false;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    portrait = w < h;
    camera.aspect = w / h;
    camera.fov = portrait ? 50 : 32;
    camera.updateProjectionMatrix();
    // receipt to the right of the headline on wide screens, above it on phones
    bon.root.position.set(portrait ? 0 : 2.3, portrait ? 2.2 : -0.15, 0);
    bon.root.scale.setScalar(portrait ? 0.56 : 0.82);
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
    const k = o.still ? 1 : 0.08;
    (Object.keys(target) as (keyof Look)[]).forEach((key) => (cur[key] += (target[key] - cur[key]) * k));
    glitchAmt *= 0.9;
    glitchPass.uniforms.uAmt!.value = glitchAmt;
    glitchPass.uniforms.uTime!.value = t;

    if (target.table > 0.5) {
      cur.story += (target.story - cur.story) * (o.still ? 1 : 0.1);
      table.update(t, dt, cur.story);
      renderPass.scene = table.scene;
      renderPass.camera = table.camera;
      bloom.enabled = false;
      composer.render(dt);
      return;
    }
    renderPass.scene = scene;
    renderPass.camera = camera;
    bloom.enabled = true;

    tiltCur.lerp(tilt, 0.06);
    camera.position.set(tiltCur.x * 0.35, 0.35 + tiltCur.y * 0.2, portrait ? 10.5 : 9.2);
    camera.lookAt(0, portrait ? 0.6 : 0, 0);
    bon.update(o.still ? 0 : t, { shield: clamp(cur.assemble * (1 - cur.burst)), tear: cur.tear, deliver: cur.split }, tiltCur);
    glow.intensity = 3 + 10 * clamp(cur.split);

    const arr = snowGeo.attributes.position as THREE.BufferAttribute;
    if (!o.still) {
      for (let i = 0; i < flakes; i++) {
        let y = arr.getY(i) - dt * (0.25 + (i % 7) * 0.04);
        if (y < -4) y += 12;
        arr.setY(i, y);
      }
      arr.needsUpdate = true;
    }
    composer.render(dt);
    if (!ready) {
      ready = true;
      readyFns.forEach((f) => f());
      readyFns = [];
    }
  }

  if (o.still) {
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
      tilt.set(nx, ny);
    },
    onReady(fn) {
      if (ready) fn();
      else readyFns.push(fn);
    },
  };
}
