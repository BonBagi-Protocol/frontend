// Dot-matrix wordmark for the footer (after op.al): the word is sampled into a
// grid of dots; dots near the pointer swell, warm to gold and drift away from
// it, then settle back.

interface Dot { x: number; y: number; r: number; dx: number; dy: number; heat: number }

export function mountDots(host: HTMLElement, word: string, o: { still: boolean }) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  host.textContent = "";
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  let dots: Dot[] = [];
  let W = 0, H = 0, dpr = 1, step = 7;
  const pointer = { x: -9999, y: -9999, in: false };
  let raf = 0;

  async function layout() {
    try {
      await document.fonts.load('900 200px "Archivo"');
    } catch {
      /* fall back to whatever face is available */
    }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = host.clientWidth;
    if (W < 1) return; // not laid out yet (hidden, or mid-resize); the next resize lays it out
    step = W < 600 ? 5 : 7;
    // size the word to the box width
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = '900 100px "Archivo", "Arial Black", sans-serif';
    const fs = Math.floor((W * 0.98 * 100) / probe.measureText(word).width);
    H = Math.ceil(fs * 0.86);
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    // rasterise the word and keep one dot per grid cell that falls inside it
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const oc = off.getContext("2d")!;
    oc.fillStyle = "#000";
    oc.font = `900 ${fs}px "Archivo", "Arial Black", sans-serif`;
    oc.textAlign = "center";
    oc.textBaseline = "alphabetic";
    oc.fillText(word, W / 2, H * 0.82);
    const data = oc.getImageData(0, 0, W, H).data;
    dots = [];
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        if (data[(Math.floor(y) * W + Math.floor(x)) * 4 + 3]! > 128) dots.push({ x, y, r: 1, dx: 0, dy: 0, heat: 0 });
      }
    }
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let moving = false;
    const R = 120;
    for (const d of dots) {
      let target = 0, tx = 0, ty = 0;
      if (pointer.in && !o.still) {
        const vx = d.x - pointer.x, vy = d.y - pointer.y;
        const dist = Math.hypot(vx, vy);
        if (dist < R) {
          target = 1 - dist / R;
          const push = target * 10;
          tx = (vx / (dist || 1)) * push;
          ty = (vy / (dist || 1)) * push;
        }
      }
      d.heat += (target - d.heat) * 0.16;
      d.dx += (tx - d.dx) * 0.16;
      d.dy += (ty - d.dy) * 0.16;
      if (Math.abs(target - d.heat) > 0.004 || Math.abs(tx - d.dx) > 0.05) moving = true;
      const r = 1.05 + d.heat * 2.4;
      const h = d.heat;
      ctx.fillStyle = h > 0.02 ? `rgba(${Math.round(233 + (244 - 233) * h)}, ${Math.round(238 + (183 - 238) * h)}, ${Math.round(242 + (40 - 242) * h)}, ${0.5 + h * 0.5})` : "rgba(233, 238, 242, 0.5)";
      ctx.beginPath();
      ctx.arc(d.x + d.dx, d.y + d.dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = moving || pointer.in ? requestAnimationFrame(draw) : 0;
  }

  const kick = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };
  host.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.in = true;
    kick();
  });
  host.addEventListener("pointerleave", () => {
    pointer.in = false;
    kick();
  });
  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = window.setTimeout(layout, 150);
  });
  void layout();
}
