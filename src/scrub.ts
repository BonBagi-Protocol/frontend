// Scroll-scrubbed scenes for the landing page (hero "torn receipt", "pay once"
// band, how-it-works). A tiny timeline engine instead of a library: the CSP
// allows only this site's own scripts, and CSSOM writes (el.style) are allowed.
// Without JS, or with prefers-reduced-motion, the CSS shows every scene in its
// final state as a normal static layout.

type Prop = "x" | "y" | "xp" | "yp" | "r" | "s" | "sx" | "o" | "dash";
type Props = Partial<Record<Prop, number>>;
type Ease = (t: number) => number;

interface Seg { a: number; b: number; from: number; to: number; ease: Ease }

const linear: Ease = (t) => t;
const outCubic: Ease = (t) => 1 - (1 - t) ** 3;
const outBack: Ease = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

const DEFAULTS: Record<Prop, number> = { x: 0, y: 0, xp: 0, yp: 0, r: 0, s: 1, sx: 1, o: 1, dash: 0 };

class Scene {
  private tracks = new Map<Element, Map<Prop, Seg[]>>();
  private target = 0;
  private cur = -1;
  constructor(readonly root: HTMLElement, private lead = 0) {}

  /** Tween every element matching `sel` (inside the scene) between progress a and b. */
  to(sel: string, a: number, b: number, from: Props, to: Props, ease: Ease = outCubic, stagger = 0) {
    this.root.querySelectorAll(sel).forEach((el, i) => {
      let props = this.tracks.get(el);
      if (!props) this.tracks.set(el, (props = new Map()));
      for (const k of Object.keys(to) as Prop[]) {
        const segs = props.get(k) ?? [];
        segs.push({ a: a + i * stagger, b: b + i * stagger, from: from[k] ?? DEFAULTS[k], to: to[k]!, ease });
        segs.sort((p, q) => p.a - q.a);
        props.set(k, segs);
      }
    });
    return this;
  }

  measure() {
    const r = this.root.getBoundingClientRect();
    const vh = window.innerHeight;
    const run = r.height - vh + this.lead * vh;
    this.target = run > 0 ? clamp((this.lead * vh - r.top) / run) : 0;
  }

  /** Ease the drawn progress toward the scroll position; returns true while still moving. */
  step(): boolean {
    if (this.cur < 0) this.cur = this.target;
    const d = this.target - this.cur;
    this.cur = Math.abs(d) < 0.0005 ? this.target : this.cur + d * 0.2;
    this.draw(this.cur);
    return this.cur !== this.target;
  }

  private draw(p: number) {
    this.root.style.setProperty("--p", p.toFixed(4));
    for (const [el, props] of this.tracks) {
      const v = { ...DEFAULTS };
      for (const [k, segs] of props) {
        let seg = segs[0];
        if (!seg) continue;
        for (const s of segs) if (s.a <= p) seg = s;
        const t = seg.b > seg.a ? clamp((p - seg.a) / (seg.b - seg.a)) : p >= seg.a ? 1 : 0;
        v[k] = p < seg.a ? seg.from : seg.from + (seg.to - seg.from) * seg.ease(t);
      }
      const st = (el as HTMLElement | SVGElement).style;
      st.transform = `translate(calc(${v.xp}% + ${v.x}px), calc(${v.yp}% + ${v.y}px)) rotate(${v.r}deg) scale(${v.s * v.sx}, ${v.s})`;
      st.opacity = String(v.o);
      if (props.has("dash")) st.strokeDashoffset = String(v.dash);
    }
  }
}

function buildQr(svg: SVGGElement | null) {
  if (!svg) return;
  const ns = "http://www.w3.org/2000/svg";
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      if (!finder && (r * 7 + c * 13) % 5 >= 2) continue;
      const cell = document.createElementNS(ns, "rect");
      cell.setAttribute("x", String(c * 12));
      cell.setAttribute("y", String(r * 12));
      cell.setAttribute("width", "11");
      cell.setAttribute("height", "11");
      cell.setAttribute("class", "qc");
      svg.appendChild(cell);
    }
  }
}

function scenes(): Scene[] {
  const out: Scene[] = [];
  const hero = document.querySelector<HTMLElement>("#hero");
  if (hero) {
    out.push(
      new Scene(hero)
        .to(".tr-strip:nth-child(1)", 0.12, 0.5, {}, { x: -34, y: 54, r: -8 })
        .to(".tr-strip:nth-child(2)", 0.12, 0.5, {}, { y: 78, r: 2 })
        .to(".tr-strip:nth-child(3)", 0.12, 0.5, {}, { x: 34, y: 54, r: 8 })
        .to(".tr-stamp", 0.5, 0.62, { o: 0, s: 2.4 }, { o: 1, s: 1 }, outBack, 0.08)
        .to(".tr-top", 0.12, 0.5, {}, { y: -14 })
        .to(".hero-cue", 0, 0.12, {}, { o: 0 }, linear),
    );
  }
  const kin = document.querySelector<HTMLElement>("#once");
  if (kin) {
    out.push(
      new Scene(kin, 0.55)
        .to(".once-w1", 0, 0.22, { xp: -120, o: 0 }, { xp: 0, o: 1 })
        .to(".once-w2", 0.06, 0.28, { xp: 120, o: 0 }, { xp: 0, o: 1 })
        .to(".once-one", 0.28, 0.46, { s: 3, o: 0 }, { s: 1, o: 1 })
        .to(".once-one", 0.54, 0.64, { s: 1, o: 1 }, { s: 0.3, o: 0 })
        .to(".once-bar", 0.58, 0.8, { sx: 0 }, { sx: 1 }, outCubic, 0.06)
        .to(".once-bar span", 0.66, 0.84, { o: 0, y: 12 }, { o: 1, y: 0 }, outCubic, 0.06)
        .to(".hb1-facts > div", 0.82, 0.96, { o: 0, y: 20 }, { o: 1, y: 0 }, outCubic, 0.03),
    );
  }
  const how = document.querySelector<HTMLElement>("#how");
  if (how) {
    buildQr(how.querySelector<SVGGElement>(".qr"));
    const third = 1 / 3;
    out.push(
      new Scene(how)
        // one big step at a time
        .to(".how-step:nth-child(1)", third - 0.04, third, { o: 1 }, { o: 0, y: -30 }, linear)
        .to(".how-step:nth-child(2)", third, third + 0.04, { o: 0, y: 30 }, { o: 1, y: 0 })
        .to(".how-step:nth-child(2)", 2 * third - 0.04, 2 * third, { o: 1 }, { o: 0, y: -30 }, linear)
        .to(".how-step:nth-child(3)", 2 * third, 2 * third + 0.04, { o: 0, y: 30 }, { o: 1, y: 0 })
        // progress bars
        .to(".how-prog i:nth-child(1) b", 0, third, { sx: 0 }, { sx: 1 }, linear)
        .to(".how-prog i:nth-child(2) b", third, 2 * third, { sx: 0 }, { sx: 1 }, linear)
        .to(".how-prog i:nth-child(3) b", 2 * third, 1, { sx: 0 }, { sx: 1 }, linear)
        // 01 · signatures draw, then the seal lands
        .to(".how-sig", 0.03, 0.14, { dash: 1 }, { dash: 0 }, linear, 0.05)
        .to(".how-seal", 0.24, 0.3, { s: 0, o: 0 }, { s: 1, o: 1 }, outBack)
        // 02 · the QR assembles, the pay button pulses
        .to(".qc", 0.36, 0.42, { s: 0 }, { s: 1 }, outBack, 0.0028)
        .to(".how-paybtn", 0.56, 0.6, { s: 1 }, { s: 1.08 }, outCubic)
        .to(".how-paybtn", 0.6, 0.64, { s: 1.08 }, { s: 1 }, outCubic)
        // 03 · one coin splits into three outputs
        .to(".how-coin", 0.7, 0.75, { s: 1, o: 1 }, { s: 0.4, o: 0 })
        .to(".how-out-a", 0.72, 0.84, { o: 0, s: 0.6 }, { x: -115, y: 140, o: 1, s: 1 }, outBack)
        .to(".how-out-b", 0.72, 0.84, { o: 0, s: 0.6 }, { y: 140, o: 1, s: 1 }, outBack)
        .to(".how-out-c", 0.72, 0.84, { o: 0, s: 0.6 }, { x: 115, y: 140, o: 1, s: 1 }, outBack)
        .to(".how-lunas", 0.86, 0.92, { o: 0, s: 2 }, { o: 1, s: 1 }, outBack, 0.03),
    );
  }
  return out;
}

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
if (!reduce.matches) {
  document.documentElement.classList.add("scrub");
  const list = scenes();
  let raf = 0;
  const tick = () => {
    let moving = false;
    for (const s of list) moving = s.step() || moving;
    raf = moving ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => {
    for (const s of list) s.measure();
    if (!raf) raf = requestAnimationFrame(tick);
  };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  kick();
}
