// Page effects: scroll reveals and the "privacy x-ray" explainer.
// No network, no storage; the x-ray uses made-up illustration values only.

document.documentElement.classList.add("js");

// Reveal blocks once as they scroll into view (content is visible without JS).
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  },
  { rootMargin: "0px 0px -8% 0px" },
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

type View = "public" | "buyer" | "member";
interface Row {
  key: string;
  /** Value per viewer; null = hidden from that viewer. */
  public: string | null;
  buyer: string | null;
  member: string | null;
  /** Highlight as "this is you" for the viewer. */
  you?: View[];
}

const ROWS: Row[] = [
  { key: "A transaction happened", public: "Yes — shielded", buyer: "Yes — you sent it", member: "Yes — you received from it" },
  { key: "Shielded actions", public: "4", buyer: "4", member: "4" },
  { key: "Network fee", public: "0.0002 ZEC", buyer: "0.0002 ZEC", member: "0.0002 ZEC" },
  { key: "Sender", public: null, buyer: "You", member: null, you: ["buyer"] },
  { key: "Mentor A · 40%", public: null, buyer: "u1q8f…h6ej9 · 0.004 ZEC", member: "You · 0.004 ZEC", you: ["member"] },
  { key: "Mentor B · 30%", public: null, buyer: "u1x3k…6nu5g · 0.003 ZEC", member: null },
  { key: "Mentor C · 30%", public: null, buyer: "u1m7d…kvkmt · 0.003 ZEC", member: null },
  { key: "Memo (encrypted)", public: null, buyer: "bonbagi:v1 o=ord-7k2m… m=n/3", member: "bonbagi:v1 o=ord-7k2m… m=1/3" },
  { key: "Total paid", public: null, buyer: "0.01 ZEC", member: null },
];

const CAPTION: Record<View, string> = {
  public: "<strong>Anyone on the internet</strong> sees that a shielded transaction happened, its fee and its size. Not who paid, not who was paid, not how much.",
  buyer: "<strong>The buyer</strong> sees every share before paying. That is how they know exactly where the money goes, and it is why the charter must be signed by everyone.",
  member: "<strong>Each member</strong> sees only their own share and their own memo. They agreed to the split when they signed, but they never see the buyer's wallet.",
};

const LABEL: Record<View, string> = { public: "Viewer: the internet", buyer: "Viewer: the buyer", member: "Viewer: Mentor A" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const scan = document.querySelector<HTMLDivElement>("#scan");

function render(view: View) {
  if (!scan) return;
  const visible = ROWS.filter((r) => r[view] !== null).length;
  scan.innerHTML = `
    <div class="scan-head meta"><span>${LABEL[view]}</span><span class="count"><b>${visible}</b> / ${ROWS.length} fields readable</span></div>
    ${ROWS.map((r) => {
      const v = r[view];
      const width = 40 + ((r.key.length * 7) % 45);
      const shown = v === null ? `<span class="redact" style-width="${width}"></span>` : esc(v);
      return `<div class="xrow"><span class="k">${esc(r.key)}</span><span class="v${r.you?.includes(view) ? " you" : ""}">${shown}</span></div>`;
    }).join("")}
    <div class="xcap">${CAPTION[view]}</div>`;
  // Widths via CSSOM (allowed by the CSP), not inline style attributes.
  scan.querySelectorAll<HTMLSpanElement>(".redact").forEach((el) => {
    el.style.width = `${el.getAttribute("style-width")}%`;
    el.removeAttribute("style-width");
  });
  scan.classList.remove("sweep");
  void scan.offsetWidth;
  scan.classList.add("sweep");
}

if (scan) {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>(".xray-tabs [data-view]")];
  for (const t of tabs) {
    t.addEventListener("click", () => {
      for (const o of tabs) o.setAttribute("aria-selected", String(o === t));
      render(t.dataset.view as View);
    });
  }
  render("public");
}
