/**
 * Verification driver.
 *
 * Bundles src/verifyCore.ts into a single self-contained Node ESM script with
 * esbuild (already present as a Vite dependency) and runs it. This makes the
 * source module graph's extensionless TypeScript imports resolve the same way
 * esbuild/Vite resolve them for the browser build — no extra test framework,
 * and no Node-native TS-loader quirks.
 *
 * Usage: node scripts/verify.mjs   (also exposed as `npm run verify`)
 * Exits non-zero if any check fails.
 */
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const result = await build({
  entryPoints: ["src/verifyCore.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});

const bundled = result.outputFiles[0].text;
const dir = mkdtempSync(join(tmpdir(), "ss-verify-"));
const file = join(dir, "verify.mjs");
writeFileSync(file, bundled);

const { runVerification } = await import(pathToFileURL(file).href);
const report = runVerification();

console.log(`\nSolar System data & scale verification — ${report.total} checks\n`);
for (const c of report.checks) {
  const mark = c.ok ? "PASS" : "FAIL";
  const detail = c.detail ? `  (${c.detail})` : "";
  console.log(`  ${mark.padEnd(4)} ${c.name}${detail}`);
}
console.log(`\n${report.total - report.failures}/${report.total} checks passed`);

if (report.failures > 0) {
  console.error(`\n❌ ${report.failures} verification check(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log("\n✅ Verification passed");
}
