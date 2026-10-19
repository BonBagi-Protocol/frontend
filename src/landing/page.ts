// Landing page: infinite looping scroll (the page wraps back to the hero),
// the WebGL stage behind it, the "letter" chapter over a 3D table, scramble text.
// No network, no storage. With prefers-reduced-motion the page is a normal,
// still, non-looping page.

import { createStage } from "./scene.ts";

// Old pay links pointed at the site root: forward them to the pay page,
// keeping the fragment (it never leaves the browser).
if (/(^#|&)c=/.test(location.hash)) location.replace(`./pay.html${location.hash}`);

const root = document.documentElement;
root.classList.add("js");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
if (!reduced) root.classList.add("loop");

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%*+=<>_";

const hero = $<HTMLElement>("#hero")!;
const table = $<HTMLElement>("#table")!;
const glance = $<HTMLElement>("#glance")!;
const end = $<HTMLElement>("#end")!;
const track = $<HTMLElement>("#track")!;
const chapterEl = $<HTMLElement>("#chapter");
const capEl = $<HTMLElement>("#hero-cap");

// ---------- loader (000 → 100)
const loader = $<HTMLElement>("#loader");
const loaderNum = $<HTMLElement>("#loader-num");
let loadT = 0;
let stageReady = false;
const loadStart = performance.now();
function tickLoader() {
  if (!loader || !loaderNum) return;
  const timed = ((performance.now() - loadStart) / 1300) * 100;
  loadT = Math.max(loadT, Math.min(stageReady ? 100 : 92, timed), stageReady ? Math.min(100, loadT + 4) : 0);
  loaderNum.textContent = String(Math.floor(loadT)).padStart(3, "0");
  loader.style.setProperty("--load", String(loadT / 100));
  if (loadT >= 100) {
    loader.classList.add("done");
    root.classList.add("loaded");
    setTimeout(() => loader.remove(), 900);
    runScrambles(document.querySelectorAll<HTMLElement>(".hud [data-scramble], #hero [data-scramble]"));
    return;
  }
  requestAnimationFrame(tickLoader);
}
if (reduced) {
  loader?.remove();
  root.classList.add("loaded");
} else requestAnimationFrame(tickLoader);
setTimeout(() => (stageReady = true), 2600);
// never trap the page behind the loader, even if animation frames are throttled
setTimeout(() => {
  if (!root.classList.contains("loaded")) {
    stageReady = true;
    loadT = 100;
    tickLoader();
  }
}, 4500);

// ---------- stage
const canvas = $<HTMLCanvasElement>("#gl")!;
let stage: ReturnType<typeof createStage> = null;
try {
  stage = createStage(canvas, { mobile, still: reduced });
} catch {
  stage = null;
}
if (!stage) {
  root.classList.add("no-gl");
  stageReady = true;
} else stage.onReady(() => (stageReady = true));

window.addEventListener(
  "pointermove",
  (e) => stage?.pointer((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1),
  { passive: true },
);

// ---------- loop clone of the hero (decorative, hidden from assistive tech)
let clone: HTMLElement | null = null;
if (!reduced) {
  clone = hero.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  clone.classList.add("is-clone");
  track.appendChild(clone);
}

// ---------- scramble text
function scramble(el: HTMLElement) {
  const final = el.dataset.text ?? el.textContent ?? "";
  el.dataset.text = final;
  if (reduced) {
    el.textContent = final;
    return;
  }
  let f = 0;
  const step = () => {
    f += 1;
    const reveal = Math.floor(f * 0.9);
    el.textContent = [...final].map((ch, i) => (i < reveal || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    if (reveal < final.length) requestAnimationFrame(step);
  };
  step();
}
function runScrambles(list: Iterable<HTMLElement>) {
  for (const el of list) scramble(el);
}
const scrIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting && root.classList.contains("loaded")) scramble(e.target as HTMLElement);
});
document.querySelectorAll<HTMLElement>("#table [data-scramble], #glance [data-scramble], #end [data-scramble]").forEach((el) => scrIO.observe(el));

// ---------- headline letters
document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
  const lines = el.innerHTML.split(/<br\s*\/?>/i);
  let n = 0;
  el.innerHTML = lines
    .map((line) =>
      [...line]
        .map((ch) => (ch === " " ? " " : `<span class="ch" data-i="${n++}">${ch}</span>`))
        .join(""),
    )
    .join("<br />");
  el.querySelectorAll<HTMLElement>(".ch").forEach((s) => s.style.setProperty("--i", s.dataset.i ?? "0"));
});

// ---------- letter chapter: the 3D table follows the paragraph being read
const parts = [...table.querySelectorAll<HTMLElement>(".tb-part")];
function story() {
  const mid = window.innerHeight * 0.55;
  return parts.reduce((sum, el) => {
    const r = el.getBoundingClientRect();
    return sum + clamp((mid - r.top) / r.height);
  }, 0);
}

// ---------- glance cards tilt (Zentry-style)
if (!reduced && !mobile) {
  glance.querySelectorAll<HTMLElement>(".gl-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateZ(0)`;
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  });
}

// ---------- scroll → stage + loop wrap
const CHAPTERS: [HTMLElement, string][] = [
  [hero, "01 / 04 · The vault"],
  [table, "02 / 04 · The split"],
  [glance, "03 / 04 · At a glance"],
  [end, "04 / 04 · Your turn"],
];
function progress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const run = r.height - window.innerHeight;
  return run > 0 ? clamp(-r.top / run) : r.top <= 0 ? 1 : 0;
}
let lastCover = 0;
let wrapping = false;
function onScroll() {
  if (clone && !wrapping) {
    const loopAt = clone.offsetTop;
    if (window.scrollY >= loopAt - 1) {
      wrapping = true;
      window.scrollTo({ top: window.scrollY - loopAt, behavior: "instant" });
      stage?.glitch(1);
      wrapping = false;
    }
  }
  const hp = progress(hero), ep = progress(end);
  const tr = table.getBoundingClientRect();
  const cover = clamp((Math.min(tr.bottom, window.innerHeight) - Math.max(tr.top, 0)) / window.innerHeight);
  if ((lastCover < 0.5) !== (cover < 0.5)) stage?.glitch(0.8);
  lastCover = cover;
  stage?.set({
    assemble: smooth(0.04, 0.8, hp),
    burst: smooth(0.12, 0.55, ep),
    split: smooth(0.22, 0.5, ep) * (1 - smooth(0.78, 0.97, ep)),
    dim: 0,
    table: cover,
    story: story(),
  });
  if (capEl) capEl.textContent = hp > 0.82 ? "// sealed · shielded · 51 blocks" : "// loose · exposed · scroll to seal";
  if (chapterEl) {
    const mid = window.innerHeight / 2;
    const cur = CHAPTERS.find(([el]) => {
      const r = el.getBoundingClientRect();
      return r.top <= mid && r.bottom > mid;
    });
    chapterEl.textContent = (cur ?? CHAPTERS[0]!)[1];
  }
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
onScroll();
