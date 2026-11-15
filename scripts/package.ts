// Zips the built extension (dist/) into release/columngrab-<version>.zip for the Chrome Web Store.
// Run via `npm run package`, which builds first.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist`;
if (!existsSync(`${dist}/manifest.json`)) throw new Error("dist/ is missing; run `npm run build` first.");

const { version } = JSON.parse(readFileSync(`${dist}/manifest.json`, "utf8")) as { version: string };
const out = `${root}release/columngrab-${version}.zip`;

mkdirSync(`${root}release`, { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-r", "-X", "-q", out, ".", "-x", "*.map", ".DS_Store"], { cwd: dist, stdio: "inherit" });
console.log(`Built ${out}`);
