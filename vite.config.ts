import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// Strict Content-Security-Policy for the built pages: scripts, styles and
// everything else only from our own origin, no network calls at all
// (connect-src 'none'), no forms posting anywhere. Added at build time only,
// because the dev server needs inline scripts and a websocket for reloads.
// The same policies are also sent as HTTP headers by vercel.json.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

// The landing page holds no charter and no payment data. It may read its own
// 3D model files (same origin only) and decode their embedded textures.
export const LANDING_CSP = CSP.replace("img-src 'self' data:", "img-src 'self' data: blob:").replace("connect-src 'none'", "connect-src 'self' blob:");

const csp = (): Plugin => ({
  name: "bonbagi-csp",
  apply: "build",
  transformIndexHtml: (html, ctx) => {
    const policy = /(^|[\\/])index\.html$/.test(ctx.filename) ? LANDING_CSP : CSP;
    return html.replace("<head>", `<head>\n  <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
});

export default defineConfig({
  plugins: [csp()],
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        pay: resolve(import.meta.dirname, "pay.html"),
        gate: resolve(import.meta.dirname, "gate.html"),
        charter: resolve(import.meta.dirname, "charter.html"),
      },
    },
  },
});
