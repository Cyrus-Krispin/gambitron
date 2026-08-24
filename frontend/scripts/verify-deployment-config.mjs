import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const globalHeaders = new Map(
  config.headers?.find((rule) => rule.source === "/(.*)")?.headers?.map(({ key, value }) => [key, value]) ?? [],
);
const csp = globalHeaders.get("Content-Security-Policy") ?? "";

for (const directive of [
  "script-src 'self' 'wasm-unsafe-eval'",
  "frame-ancestors 'none'",
  "object-src 'none'",
]) {
  if (!csp.includes(directive)) throw new Error(`Missing CSP directive: ${directive}`);
}
if (csp.includes("'unsafe-eval'")) throw new Error("CSP must not enable general unsafe-eval");

for (const header of [
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
]) {
  if (!globalHeaders.has(header)) throw new Error(`Missing security header: ${header}`);
}

const assetCache = config.headers
  ?.find((rule) => rule.source === "/assets/(.*)")
  ?.headers?.find((header) => header.key === "Cache-Control")?.value;
if (assetCache !== "public, max-age=31536000, immutable") {
  throw new Error("Hashed assets must use immutable caching");
}

console.log("deployment config ok: WebAssembly CSP and security headers present");
