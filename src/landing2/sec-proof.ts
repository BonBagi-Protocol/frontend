import "./sec-proof.css";
import { scene, seg, easeInOut, easeOut, clamp, reduced } from "./scroll";

// Scene 4 · after dark, the view from outside.
// Night is the outside world: strangers in a plaza read a public ledger wall. The old
// way (buyer → treasurer → members) is readable to anyone; our payment arrives as one
// row and frosts. Then the real testnet run types itself out, with who sees what, and
// the night brightens into the studio of scene 5.

const TXID = "485623f7eaf97802d5399faa3610212b39749618fd024d4ad9201f4f31a5f520";
const EXPLORER = `https://blockexplorer.one/zcash/testnet/tx/${TXID}`;
const THREAT = "https://github.com/BonBagi/frontend/blob/main/docs/THREAT-MODEL.md";

// What a transparent ledger shows anyone walking past (the old way, with a treasurer).
const LEDGER = [
  { t: "t1Vx…2Lq → t1Pe…9sa · 1.2500 ZEC", dim: true },
  { t: "buyer → treasurer · 0.0100 ZEC", dim: false },
  { t: "treasurer → Ayu · 0.0040 ZEC", dim: false },
  { t: "treasurer → Bima · 0.0030 ZEC", dim: false },
  { t: "treasurer → Citra · 0.0030 ZEC", dim: false },
  { t: "t1Kd…7Hc → t1Rb…3Wm · 0.4200 ZEC", dim: true },
] as const;

const ROWS = [
  ["Public chain", "a shielded transaction and its action count", "who paid (from a shielded balance), who was paid, amounts, memos"],
  ["The buyer", "every member and amount, by design", "members’ balances"],
  ["Each member", "their own amount and memo", "the buyer or other buyers"],
  ["The page host", "requests for static files", "the charter, addresses or prices"],
] as const;

const IMG_A = 1920 / 1072;
const WALL = { x0: 0.275, x1: 0.71 }; // the glass ledger wall in the photo (fractions)
const COIN = { x: 0.622, y: 0.794 }; // the coin on the bench
const HEX = "0123456789abcdef";

// The choreography is written on one timeline; these knots squeeze it into the track
// (260vh desktop, 280vh phones) so the proof is fully read and brightened just as the
// stage unpins, with no idle bright tail before scene 5.
const KNOTS_D: [number, number][] = [[0, 0], [0.7375, 0.69], [0.8875, 0.87], [1, 1]];
const KNOTS_M: [number, number][] = [[0, 0], [0.695, 0.69], [1, 1]];
function remap(p: number, k: [number, number][]): number {
  for (let i = 1; i < k.length; i++) {
    const [x0, y0] = k[i - 1]!, [x1, y1] = k[i]!;
    if (p <= x1) return y0 + (y1 - y0) * clamp((p - x0) / (x1 - x0));
  }
  return 1;
}

type RGBA = [number, number, number, number];
const hex = (h: string, a = 1): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const mixc = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
const rgba = (c: RGBA) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Night palette → studio palette for the proof text.
const PAL: Record<string, [RGBA, RGBA]> = {
  "--pf-fg": [hex("#f2eee5"), hex("#151515")],
  "--pf-fg2": [hex("#cfc9bc"), hex("#3f3e39")],
  "--pf-mute": [hex("#9c978c"), hex("#67625a")],
  "--pf-acc": [hex("#f4b728"), hex("#7d5104")],
  "--pf-rule": [hex("#f2eee5", 0.16), hex("#151515", 0.16)],
  "--pf-chip": [hex("#f2eee5", 0.06), hex("#151515", 0.05)],
};
const BG_NIGHT = hex("#090909");
const BG_STUDIO = hex("#efede9");
const FROST_IN = hex("#0e1013", 0.38);
const FROST_SMOKE = hex("#100f0d", 0.66);
const FROST_SMOKE_M = hex("#100f0d", 0.92);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function markup(): string {
  const ledger = LEDGER.map((r) => `<li class="pf-lrow${r.dim ? " is-dim" : ""}">${esc(r.t)}</li>`).join("");
  const slot = (n: number) =>
    `<span class="pf-slot"><span class="pf-noise" aria-hidden="true">${"0".repeat(n)}</span><span class="pf-bar" aria-hidden="true"></span><span class="sr-only">hidden</span></span>`;
  const rows = ROWS.map(
    ([who, sees, not]) => `<li class="pf-row"><span class="pf-rule" aria-hidden="true"></span>
      <p class="pf-row-who">${esc(who)}</p>
      <p class="pf-row-l"><span class="pf-tag">Sees</span>${esc(sees)}</p>
      <p class="pf-row-l is-not"><span class="pf-tag">Not</span>${esc(not)}</p>
    </li>`,
  ).join("");
  const chars = [...TXID].map((c) => `<span class="pf-c">${c}</span>`).join("");
  return `<div class="stage pf-stage">
  <div class="pf-plate">
    <picture class="pf-pic" aria-hidden="true">
      <source media="(max-width: 720px)" srcset="/landing/plaza-sm.jpg" />
      <img class="pf-img" src="/landing/plaza.jpg" alt="" width="1920" height="1072" decoding="async" />
    </picture>
    <i class="pf-glint" aria-hidden="true"></i>
    <div class="pf-ledger">
      <p class="pf-lhead"><span>Public ledger</span><span class="pf-live">live</span></p>
      <ol class="pf-lrows" aria-label="Payments anyone can read on a transparent chain">
        <li class="pf-lrow is-ours"><span class="pf-tid">485623f7…</span> · <b>shielded</b> · ${slot(5)} → ${slot(5)} · ${slot(6)}</li>
        ${ledger}
      </ol>
      <p class="pf-lcap">time, fee and output count stay public</p>
    </div>
  </div>
  <div class="pf-grad" aria-hidden="true"></div>
  <div class="pf-veil" aria-hidden="true"></div>
  <div class="pf-intro">
    <div class="pf-intro-main">
      <p class="pf-kick">After dark · the view from outside</p>
      <h2 class="pf-h"><span class="pf-ln"><span>Out here,</span></span> <span class="pf-ln"><span><em>nobody can read it.</em></span></span></h2>
    </div>
    <p class="pf-sub">A public chain shows every payment to everyone. A shielded one shows that a payment happened, and that is all: not who paid, not who was paid, not how much.</p>
  </div>
  <div class="pf-frost" aria-hidden="true"></div>
  <div class="pf-edge" aria-hidden="true"></div>
  <div class="pf-proof">
    <div class="pf-proof-in">
      <div class="pf-col pf-col-a">
        <p class="pf-pk">Zcash testnet · 18 October</p>
        <h2 class="pf-ph"><span class="pf-ln"><span>On testnet, it</span></span> <span class="pf-ln"><span><em>already happened.</em></span></span></h2>
        <p class="pf-pp">Our team ran a dry run on Zcash testnet on 18 October: one transaction, three shielded outputs (0.0012 / 0.0009 / 0.0009 TAZ) to our own test wallets, each memo read by the receiving wallet.</p>
        <div class="pf-tx">
          <div class="pf-txl"><span>Transaction id</span><button class="pf-copy" type="button">Copy</button></div>
          <code class="pf-txc" aria-hidden="true">${chars}</code>
          <span class="sr-only">${TXID}</span>
        </div>
        <p class="pf-meta"><span class="pf-block">Block 4514615</span><a class="pf-link" href="${EXPLORER}" target="_blank" rel="noopener noreferrer">See it on an explorer <span aria-hidden="true">↗</span></a></p>
        <p class="pf-xp"><span class="pf-xp-l">What the explorer shows:</span> <span class="pf-chip">0 ZEC</span><span class="sr-only">, </span><span class="pf-chip">no sender</span><span class="sr-only">, </span><span class="pf-chip">no recipients</span><span class="sr-only">.</span></p>
      </div>
      <div class="pf-col pf-col-b">
        <h3 class="pf-wh">Who sees what</h3>
        <ul class="pf-rows">${rows}</ul>
        <a class="pf-link pf-tm" href="${THREAT}" target="_blank" rel="noopener noreferrer">Threat model <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </div>
</div>`;
}

export function mount(root: HTMLElement): void {
  root.innerHTML = markup();
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
  const $$ = <T extends Element>(s: string) => Array.from(root.querySelectorAll<T>(s));

  const stage = $<HTMLElement>(".pf-stage");
  const plate = $<HTMLElement>(".pf-plate");
  const img = $<HTMLImageElement>(".pf-img");
  const glint = $<HTMLElement>(".pf-glint");
  const ledger = $<HTMLElement>(".pf-ledger");
  const lhead = $<HTMLElement>(".pf-lhead");
  const lrows = $$<HTMLElement>(".pf-lrow");
  const ours = lrows[0]!;
  const old = lrows.slice(1);
  const noises = $$<HTMLElement>(".pf-noise");
  const bars = $$<HTMLElement>(".pf-bar");
  const lcap = $<HTMLElement>(".pf-lcap");
  const grad = $<HTMLElement>(".pf-grad");
  const veil = $<HTMLElement>(".pf-veil");
  const intro = $<HTMLElement>(".pf-intro");
  const introLines = $$<HTMLElement>(".pf-intro .pf-ln > span");
  const kick = $<HTMLElement>(".pf-kick");
  const sub = $<HTMLElement>(".pf-sub");
  const frost = $<HTMLElement>(".pf-frost");
  const edgeEl = $<HTMLElement>(".pf-edge");
  const proof = $<HTMLElement>(".pf-proof");
  const inner = $<HTMLElement>(".pf-proof-in");
  const pk = $<HTMLElement>(".pf-pk");
  const phLines = $$<HTMLElement>(".pf-ph .pf-ln > span");
  const pp = $<HTMLElement>(".pf-pp");
  const txl = $<HTMLElement>(".pf-txl");
  const copyBtn = $<HTMLButtonElement>(".pf-copy");
  const chars = $$<HTMLElement>(".pf-c");
  const meta = $<HTMLElement>(".pf-meta");
  const xp = $<HTMLElement>(".pf-xp");
  const wh = $<HTMLElement>(".pf-wh");
  const rows = $$<HTMLElement>(".pf-row");
  const rules = $$<HTMLElement>(".pf-rule");
  const tm = $<HTMLElement>(".pf-tm");

  if (reduced) root.classList.add("is-still");

  // ---------- layout ----------
  interface Lay {
    W: number; H: number; mob: boolean;
    origin: [number, number]; rowH: number;
    over: number; padTop: number; rowTop: number[];
  }
  let lay: Lay | null = null;
  let dirty = true;

  function layout(): Lay {
    const W = stage.clientWidth, H = stage.clientHeight, mob = W <= 720;
    // where the photo lands (object-fit: cover, object-position from the CSS)
    const iw = Math.max(W, H * IMG_A), ih = iw / IMG_A;
    const posX = mob ? 0.37 : 0.5;
    const ox = (W - iw) * posX, oy = (H - ih) * 0.5;
    const wx0 = ox + WALL.x0 * iw, wx1 = ox + WALL.x1 * iw;
    let lw: number, lx: number;
    if (mob) { lw = W - 44; lx = 22; }
    else { lw = clamp((wx1 - wx0) * 0.8, 440, 620); lx = (wx0 + wx1) / 2 - lw / 2; }
    const ly = mob ? 92 : Math.max(104, oy + ih * 0.1);
    ledger.style.left = `${lx.toFixed(1)}px`;
    ledger.style.top = `${ly.toFixed(1)}px`;
    ledger.style.width = `${lw.toFixed(1)}px`;
    const gx = ox + COIN.x * iw, gy = oy + COIN.y * ih;
    glint.style.left = `${gx.toFixed(1)}px`;
    glint.style.top = `${gy.toFixed(1)}px`;
    glint.style.display = gx > W - 10 || gx < 10 ? "none" : "";
    const rowH = old[0]!.offsetHeight + (parseFloat(getComputedStyle(old[0]!.parentElement!).rowGap) || 0);
    lcap.style.top = `${(ours.offsetTop + ours.offsetHeight + 8).toFixed(1)}px`;
    const origin: [number, number] = [lx + lw / 2, ly + ledger.offsetHeight * 0.55];
    plate.style.transformOrigin = `${origin[0].toFixed(1)}px ${origin[1].toFixed(1)}px`;

    // proof: how far the content must travel when it is taller than the stage (phones)
    const cs = getComputedStyle(proof);
    const padTop = parseFloat(cs.paddingTop) || 0, padBot = parseFloat(cs.paddingBottom) || 0;
    const over = Math.max(0, inner.offsetHeight - (H - padTop - padBot));
    const rowTop = rows.map((r) => r.offsetTop);
    return { W, H, mob, origin, rowH, over, padTop, rowTop };
  }

  const ro = new ResizeObserver(() => { dirty = true; });
  ro.observe(stage);
  ro.observe(inner);
  ro.observe(ledger);
  img.addEventListener("load", () => { dirty = true; });

  new IntersectionObserver((es) => {
    root.classList.toggle("is-idle", !es.some((e) => e.isIntersecting));
  }).observe(root);

  // ---------- copy + keyboard focus ----------
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(TXID);
      copyBtn.textContent = "Copied";
    } catch {
      const sel = getSelection(), r = document.createRange();
      r.selectNodeContents($(".pf-txc"));
      sel?.removeAllRanges();
      sel?.addRange(r);
      copyBtn.textContent = "Selected";
    }
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1600);
  });
  // Tabbing into the proof while it is still hidden jumps the scroll to where it reads.
  proof.addEventListener("focusin", () => {
    if (lastP > 0.86) return;
    const top = root.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + (root.offsetHeight - innerHeight) * 0.9, behavior: reduced ? "auto" : "smooth" });
  });

  // ---------- per-frame ----------
  let lastP = 0, entrySm = reduced ? 1 : 0, palK = -1, lastScr = -1, lastScrT = -1, lastNoiseT = -1;
  const cst: number[] = chars.map(() => -1);
  const show = (el: HTMLElement, v: number, dy = 18) => {
    el.style.opacity = v.toFixed(3);
    el.style.transform = v >= 1 ? "" : `translate3d(0,${((1 - v) * dy).toFixed(1)}px,0)`;
  };
  const rise = (el: HTMLElement, v: number) => { el.style.transform = v >= 1 ? "" : `translate3d(0,${((1 - v) * 108).toFixed(1)}%,0)`; };
  const step = (on: boolean) => (on ? 1 : 0);

  scene(root, (pRaw, { time, dt, top }) => {
    if (dirty) { lay = layout(); dirty = false; }
    const Ly = lay!;
    const { H, mob } = Ly;
    const p = remap(pRaw, mob ? KNOTS_M : KNOTS_D);
    lastP = p;

    // entry: how far the section has risen into view (before it pins)
    const entry = clamp(1 - top / H);
    const k = reduced ? 1 : 1 - Math.pow(1 - 0.16, dt / 16.7);
    entrySm += (entry - entrySm) * k;
    const en = reduced ? 1 : entrySm;

    // ---- the plaza: slow push-in toward the wall, a little parallax on the way in ----
    const push = reduced ? 0 : easeInOut(seg(p, 0, 0.62));
    const s = mob ? 1.02 + 0.08 * push : 1.04 + 0.16 * push;
    const py = reduced ? 0 : (1 - easeOut(en)) * -H * 0.07;
    plate.style.transform = `translate3d(0,${py.toFixed(1)}px,0) scale(${s.toFixed(4)})`;

    const fr = reduced ? step(p > 0.55) : easeInOut(seg(p, 0.5, 0.635)); // frost rises
    const bright = easeInOut(seg(p, 0.85, 0.99));
    veil.style.opacity = (lerp(1, 0.7, seg(p, 0, 0.08)) * (1 - fr)).toFixed(3);

    // ---- intro copy ----
    const out = reduced ? step(p > 0.5) : easeInOut(seg(p, 0.45, 0.56));
    intro.style.opacity = (1 - out).toFixed(3);
    intro.style.transform = out > 0 && !reduced ? `translate3d(0,${(-out * 56).toFixed(1)}px,0)` : "";
    intro.style.visibility = out >= 1 ? "hidden" : "";
    introLines.forEach((el, i) => rise(el, reduced ? 1 : easeOut(seg(en, 0.45 + i * 0.1, 0.9 + i * 0.08))));
    show(kick, reduced ? 1 : easeOut(seg(en, 0.4, 0.8)), 10);
    show(sub, reduced ? 1 : easeOut(seg(en, 0.6, 1)), 14);
    grad.style.opacity = (1 - out * 0.5).toFixed(3);

    // ---- the ledger wall ----
    // rows flip on as the scene arrives
    show(lhead, reduced ? 1 : easeOut(seg(en, 0.2, 0.6)), 8);
    // our payment arrives at the top and pushes the board down by one row
    const arrive = reduced ? step(p > 0.14) : easeInOut(seg(p, 0.1, 0.19));
    const shift = (arrive - 1) * Ly.rowH;
    old.forEach((r, i) => {
      const flip = reduced ? 1 : easeOut(seg(en, 0.3 + i * 0.07, 0.62 + i * 0.07));
      const gone = reduced ? step(p > 0.3) * 0.82 : easeInOut(seg(p, 0.27 + i * 0.022, 0.37 + i * 0.022)) * 0.82;
      r.style.opacity = (flip * (1 - gone)).toFixed(3);
      r.style.transform = `translate3d(0,${(shift + (1 - flip) * 10).toFixed(1)}px,0)`;
      r.style.filter = gone > 0.01 ? `blur(${(gone * 5).toFixed(2)}px)` : "";
    });
    ours.style.opacity = arrive.toFixed(3);
    ours.style.transform = `translate3d(0,${((arrive - 1) * Ly.rowH * 0.6).toFixed(1)}px,0)`;
    // the arrival flashes gold, then settles
    const flash = reduced ? 0 : seg(p, 0.15, 0.19) * (1 - seg(p, 0.19, 0.3));
    ours.style.setProperty("--pf-flash", flash.toFixed(3));
    // its parties and amount scramble, then frost over
    const frostRow = reduced ? step(p > 0.14) : easeInOut(seg(p, 0.2, 0.28));
    const noiseT = Math.floor(time / 80);
    if (!reduced && frostRow < 1 && arrive > 0 && noiseT !== lastNoiseT) {
      lastNoiseT = noiseT;
      for (const n of noises) {
        let str = "";
        for (let i = 0; i < (n.textContent?.length ?? 5); i++) str += HEX[(Math.random() * 16) | 0];
        n.textContent = str;
      }
    }
    noises.forEach((n) => {
      n.style.opacity = (1 - frostRow).toFixed(3);
      n.style.filter = frostRow > 0.01 ? `blur(${(frostRow * 4).toFixed(2)}px)` : "";
    });
    bars.forEach((b) => { b.style.opacity = frostRow.toFixed(3); });
    show(lcap, reduced ? step(p > 0.3) : easeOut(seg(p, 0.31, 0.38)), 8);
    ledger.style.opacity = (1 - 0.4 * fr).toFixed(3);

    // ---- frost rises over the plaza ----
    const edge = H * (1 - fr);
    frost.style.visibility = fr > 0.001 ? "visible" : "hidden";
    frost.style.clipPath = `inset(${edge.toFixed(1)}px 0 0 0)`;
    const fc = mixc(mixc(FROST_IN, mob ? FROST_SMOKE_M : FROST_SMOKE, fr), BG_STUDIO, bright);
    frost.style.backgroundColor = rgba(fc);
    edgeEl.style.opacity = (fr > 0.001 && fr < 1 ? 1 : 0).toString();
    edgeEl.style.transform = `translate3d(0,${edge.toFixed(1)}px,0)`;

    // ---- proof ----
    // Hidden by opacity only (never visibility), so Tab still reaches Copy and the links;
    // focusing one before its phase scrolls to where the proof reads.
    proof.style.opacity = p > 0.6 ? "1" : "0";
    proof.classList.toggle("is-live", p > 0.66);
    const R_ = (a0: number, b0: number) => (reduced ? step(p > 0.62) : easeOut(seg(p, a0, b0)));
    // phones: the column is taller than the stage, so it travels up like a page
    const scrollT = mob ? easeInOut(seg(p, 0.72, 0.975)) : 0;
    const shiftP = -Ly.over * scrollT;
    inner.style.transform = shiftP ? `translate3d(0,${shiftP.toFixed(1)}px,0)` : "";
    const onScreen = (y: number) => Math.max(clamp((H - 30 - (Ly.padTop + shiftP + y)) / 110), seg(scrollT, 0.86, 1));
    show(pk, R_(0.62, 0.68), 10);
    phLines.forEach((el, i) => rise(el, R_(0.625 + i * 0.02, 0.7 + i * 0.02)));
    show(pp, R_(0.66, 0.73));
    show(txl, R_(0.69, 0.74), 10);
    const typed = reduced ? (p > 0.62 ? 64 : 0) : Math.round(seg(p, 0.7, mob ? 0.79 : 0.8) * 64);
    const scrT = Math.floor(time / 70);
    if (typed !== lastScr || (typed > 0 && typed < 64 && scrT !== lastScrT)) {
      lastScrT = scrT;
      for (let i = 0; i < 64; i++) {
        const st = i < typed ? 2 : i < typed + 4 && typed > 0 && typed < 64 ? 1 : 0;
        const c = chars[i]!;
        if (st === 1) c.textContent = HEX[(Math.random() * 16) | 0]!;
        else if (cst[i] !== st || cst[i] === 1) c.textContent = TXID[i]!;
        if (cst[i] !== st) {
          c.classList.toggle("is-off", st === 0);
          c.classList.toggle("is-scr", st === 1);
        }
        c.classList.toggle("is-cur", st === 1 && i === typed);
        cst[i] = st;
      }
      lastScr = typed;
    }
    show(meta, R_(0.76, 0.81), 12);
    show(xp, R_(0.78, 0.83), 12);
    show(wh, R_(0.68, 0.74), 10);
    rows.forEach((r, i) => {
      const v0 = Math.min(R_(0.71 + i * 0.025, 0.77 + i * 0.025), mob && !reduced ? onScreen(Ly.rowTop[i]!) : 1);
      show(r, v0, 22);
      rules[i]!.style.transform = `scaleX(${v0.toFixed(3)})`;
    });
    show(tm, Math.min(R_(0.82, 0.87), mob && !reduced ? onScreen(tm.offsetTop) : 1), 10);

    // ---- night → studio ----
    if (Math.abs(bright - palK) > 0.002 || palK < 0) {
      palK = bright;
      // text flips where ivory and ink have equal contrast on the grey (≈ #767472), and fast
      const kt = easeInOut(clamp((bright - 0.4) / 0.15));
      for (const key in PAL) {
        const [d0, l0] = PAL[key]!;
        stage.style.setProperty(key, rgba(mixc(d0, l0, kt)));
      }
      const bg = rgba(mixc(BG_NIGHT, BG_STUDIO, bright));
      stage.style.backgroundColor = bg;
      root.style.backgroundColor = bg;
      root.dataset.tone = bright > 0.5 ? "light" : "dark";
    }
  });
}
