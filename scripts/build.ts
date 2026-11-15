// Builds the extension into dist/ (load that folder unpacked in chrome://extensions).
//   node scripts/build.ts            one-off build
//   node scripts/build.ts --watch    rebuild on change
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const outdir = `${root}dist`;
const watch = process.argv.includes("--watch");

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const copyPublic = (): void => cpSync(`${root}public`, outdir, { recursive: true });

const options: esbuild.BuildOptions = {
  absWorkingDir: root,
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    offscreen: "src/offscreen.ts",
    options: "src/options.ts",
  },
  outdir,
  bundle: true,
  // Content scripts and this service worker are classic scripts, so wrap each bundle in an IIFE.
  format: "iife",
  target: "chrome120",
  sourcemap: watch ? "inline" : false,
  minify: false, // Web Store reviewers prefer readable code.
  logLevel: "info",
  plugins: [
    {
      name: "copy-public",
      setup(build) {
        build.onEnd(copyPublic);
      },
    },
  ],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
