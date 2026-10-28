import "@fontsource/sofia-sans-extra-condensed/800.css";
import "@fontsource/sofia-sans-extra-condensed/900.css";
import "@fontsource-variable/sofia-sans";
import "@fontsource-variable/martian-mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/caveat";
import "./tokens.css";

import { start } from "./scroll";
import { mount as mountPrint } from "./sec-print";
import { mount as mountSplit } from "./sec-split";
import { mount as mountMarket } from "./sec-market";
import { mount as mountProof } from "./sec-proof";
import { mount as mountClose } from "./sec-close";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const only = new URLSearchParams(location.search).get("only");

// `?only=<id>` mounts one scene for development; the others stay empty and collapse.
const scenes: [string, (root: HTMLElement) => void][] = [
  ["s-print", mountPrint],
  ["s-split", mountSplit],
  ["s-market", mountMarket],
  ["s-proof", mountProof],
  ["s-close", mountClose],
];
for (const [id, mount] of scenes) {
  const root = $(id);
  if (!root) continue;
  if (only && only !== id) { root.hidden = true; continue; }
  mount(root);
}

// The nav flips to light text over dark scenes (sections marked data-tone="dark").
const nav = $("nav");
// Scenes can flip their own tone while scrolling (scene 4 brightens at its end), so read it every frame.
const toned = [...document.querySelectorAll<HTMLElement>("[data-tone]")];
let lastY = scrollY;
function navTick() {
  const probe = 32;
  const dark = toned.some((el) => { if (el.dataset.tone !== "dark") return false; const r = el.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; });
  nav.classList.toggle("is-dark", dark);
  // Latch: hide while scrolling down past the first screen, show again only on a real scroll up.
  const y = scrollY;
  if (y < innerHeight * 0.6) nav.classList.remove("is-hidden");
  else if (y > lastY + 4) nav.classList.add("is-hidden");
  else if (y < lastY - 12) nav.classList.remove("is-hidden");
  if (Math.abs(y - lastY) > 4) lastY = y;
  requestAnimationFrame(navTick);
}
requestAnimationFrame(navTick);

start();
