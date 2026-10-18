// Prepares dist/ for a prebuilt static deploy (`vercel deploy dist --prod`):
// copies the security headers from vercel.json and the local project link.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const { headers } = JSON.parse(readFileSync("vercel.json", "utf8"));
writeFileSync("dist/vercel.json", JSON.stringify({ headers }, null, 1));
if (existsSync(".vercel/project.json")) {
  mkdirSync("dist/.vercel", { recursive: true });
  copyFileSync(".vercel/project.json", "dist/.vercel/project.json");
}
