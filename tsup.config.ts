import { defineConfig } from "tsup";
import path from "node:path";

/**
 * Builds the publishable library (the drop-in `clickpay` package) from index.ts.
 * The Next.js demo app is unaffected — it keeps importing from source.
 *
 * - ESM (.mjs) + CJS (.js) + type declarations (.d.ts)
 * - react/react-dom and the wallet SDKs stay EXTERNAL (peer/deps, not bundled)
 * - "use client" banner: the whole library is client-only (browser wallet)
 * - "@/..." path alias resolved to the repo root for the bundle
 */
export default defineConfig({
  entry: { index: "index.ts" },
  format: ["esm", "cjs"],
  // The repo's tsconfig enables `incremental` (Next default), which clashes with
  // tsup's single-file dts emit — turn it off just for the declaration build.
  dts: { compilerOptions: { incremental: false, composite: false } },
  clean: true,
  sourcemap: true,
  treeshake: true,
  outDir: "dist",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "ethers",
    "magic-sdk",
    "@particle-network/universal-account-sdk",
  ],
  esbuildOptions(options) {
    options.alias = { "@": path.resolve(process.cwd()) };
  },
  // esbuild strips module-level "use client" while bundling, so re-add it to the
  // top of the JS outputs. Without it, a consumer's Next.js App Router treats the
  // components as Server Components and the hooks throw.
  async onSuccess() {
    const { readFileSync, writeFileSync } = await import("node:fs");
    for (const f of ["dist/index.js", "dist/index.mjs"]) {
      const src = readFileSync(f, "utf8");
      if (!src.startsWith('"use client"')) {
        writeFileSync(f, '"use client";\n' + src);
      }
    }
  },
});
