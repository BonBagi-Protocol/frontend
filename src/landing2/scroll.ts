// One rAF loop for the whole landing. Each scene registers its track element and
// gets the scroll progress through it (0 when its top reaches the viewport top,
// 1 when its bottom reaches the viewport bottom) plus whether it is near view,
// so idle loops can stop when the scene is off screen.
// The loop only runs while something can change: after a scroll, resize, pointer or key
// event, while a scene's smoothed progress is still catching up, and (full motion only)
// while a visible scene keeps animating on its own. Idle, or under reduced motion once
// things settle, it stops and costs nothing. All layout reads happen first in a frame,
// before any scene writes styles, so a frame never forces a synchronous layout.

/** `top` is the scene element's viewport top, read at the start of the frame (use it instead of getBoundingClientRect). */
export type Tick = (p: number, info: { visible: boolean; time: number; dt: number; vh: number; vw: number; top: number }) => void | boolean;

interface Scene { el: HTMLElement; tick: Tick; p: number; smooth: number; visible: boolean }

const scenes: Scene[] = [];
const q = new URLSearchParams(location.search);

/** `?rm=1` forces reduced motion for testing. */
export const reduced = q.has("rm") || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Register a scene. `smoothing` 0 = raw scroll, ~0.12 = gentle inertia. A tick returns `false` when it has nothing left to animate on its own. */
export function scene(el: HTMLElement, tick: Tick, smoothing = 0.14): void {
  scenes.push({ el, tick, p: 0, smooth: reduced ? 1 : smoothing, visible: false });
}

/** Extra per-frame work outside the scenes: `read` runs with the layout reads, `write` after the scenes. */
const hooks: { read: () => void; write: () => void }[] = [];
export function onFrame(read: () => void, write: () => void): void {
  hooks.push({ read, write });
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export { clamp };

/** After the last event, keep frames coming this long so springs, intros and timers settle. */
const SETTLE_MS = 2500;
let last = performance.now();
let lastEvent = last;
let raf = 0;
let started = false;

function frame(now: number) {
  raf = 0;
  const dt = Math.min(64, now - last);
  last = now;
  const vh = innerHeight, vw = innerWidth;
  // read phase: every rect before any style write
  const rects = scenes.map((s) => s.el.getBoundingClientRect());
  for (const h of hooks) h.read();
  // write phase
  let busy = now - lastEvent < SETTLE_MS;
  scenes.forEach((s, i) => {
    const r = rects[i]!;
    const span = Math.max(1, r.height - vh);
    const target = clamp(-r.top / span);
    const k = s.smooth >= 1 ? 1 : 1 - Math.pow(1 - s.smooth, dt / 16.7);
    s.p += (target - s.p) * k;
    if (Math.abs(target - s.p) < 0.0004) s.p = target;
    else busy = true;
    s.visible = r.bottom > -vh * 0.25 && r.top < vh * 1.25;
    if (s.visible && s.tick(s.p, { visible: true, time: now, dt, vh, vw, top: r.top }) !== false && !reduced) busy = true;
  });
  for (const h of hooks) h.write();
  if (busy) raf = requestAnimationFrame(frame);
}

/** Something may have changed: make sure frames are running. */
export function kick(): void {
  lastEvent = performance.now();
  if (!started || raf) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

/** Start the loop. Call once after all scenes are registered. `?y=` presets the scroll for screenshots. */
export function start(): void {
  if (q.has("y")) scrollTo(0, Number(q.get("y")));
  started = true;
  for (const ev of ["scroll", "resize", "pointermove", "pointerdown", "pointerup", "keydown", "focusin", "visibilitychange"]) {
    addEventListener(ev, kick, { passive: true });
  }
  document.fonts?.ready.then(kick).catch(() => undefined);
  kick();
}
