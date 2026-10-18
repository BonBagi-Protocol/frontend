import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// Strict Content-Security-Policy for the built pages: scripts, styles and
// everything else only from our own origin, no network calls at all
// (connect-src 'none'), no forms posting anywhere. Added at build time only,
// because the dev server needs inline scripts and a websocket for reloads.
// The same policy is also sent as an HTTP header by vercel.json.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

const csp = (): Plugin => ({
  name: "bonbagi-csp",
  apply: "build",
  transformIndexHtml: (html) => html.replace("<head>", `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  plugins: [csp()],
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        gate: resolve(import.meta.dirname, "gate.html"),
        charter: resolve(import.meta.dirname, "charter.html"),
      },
    },
  },
});
