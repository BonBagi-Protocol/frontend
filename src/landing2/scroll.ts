// One rAF loop for the whole landing. Each scene registers its track element and
// gets the scroll progress through it (0 when its top reaches the viewport top,
// 1 when its bottom reaches the viewport bottom) plus whether it is near view,
// so idle loops can stop when the scene is off screen.

export type Tick = (p: number, info: { visible: boolean; time: number; dt: number; vh: number; vw: number }) => void;

interface Scene { el: HTMLElement; tick: Tick; p: number; smooth: number; visible: boolean }

const scenes: Scene[] = [];
const q = new URLSearchParams(location.search);

/** `?rm=1` forces reduced motion for testing. */
export const reduced = q.has("rm") || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Register a scene. `smoothing` 0 = raw scroll, ~0.12 = gentle inertia. */
export function scene(el: HTMLElement, tick: Tick, smoothing = 0.14): void {
  scenes.push({ el, tick, p: 0, smooth: reduced ? 1 : smoothing, visible: false });
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export { clamp };

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(64, now - last);
  last = now;
  const vh = innerHeight, vw = innerWidth;
  for (const s of scenes) {
    const r = s.el.getBoundingClientRect();
    const span = Math.max(1, r.height - vh);
    const target = clamp(-r.top / span);
    const k = s.smooth >= 1 ? 1 : 1 - Math.pow(1 - s.smooth, dt / 16.7);
    s.p += (target - s.p) * k;
    if (Math.abs(target - s.p) < 0.0004) s.p = target;
    s.visible = r.bottom > -vh * 0.25 && r.top < vh * 1.25;
    if (s.visible) s.tick(s.p, { visible: true, time: now, dt, vh, vw });
  }
  requestAnimationFrame(frame);
}

/** Start the loop. Call once after all scenes are registered. `?y=` presets the scroll for screenshots. */
export function start(): void {
  if (q.has("y")) scrollTo(0, Number(q.get("y")));
  requestAnimationFrame(frame);
}
