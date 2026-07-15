#!/usr/bin/env node
// Guard: skills/bee-hive/templates/lib/ and .bee/bin/lib/ must stay byte-
// identical mirrors of each other. PROJ-08 (SPEC), crit-pattern 20260714
// (derive file lists, never hand-enumerate): the template copy is what ships
// to a fresh onboard, the .bee/bin copy is what actually runs in this repo —
// if they drift, a fix lands in one and silently never reaches the other.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const TEMPLATES_LIB = path.join(REPO_ROOT, "skills", "bee-hive", "templates", "lib");
const BIN_LIB = path.join(REPO_ROOT, ".bee", "bin", "lib");

/**
 * Lists the plain files (not directories) directly inside dir, derived via
 * fs.readdirSync — never a hand-maintained list.
 */
function listFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Compares two directories of flat files: every file present in one side
 * must be present and byte-identical in the other. Returns
 * { ok, missingInB, extraInB, diffing } where:
 *   - missingInB: files present in dirA but absent from dirB
 *   - extraInB:   files present in dirB but absent from dirA
 *   - diffing:    files present in both but with different byte content
 */
function compareDirs(dirA, dirB) {
  const filesA = new Set(listFiles(dirA));
  const filesB = new Set(listFiles(dirB));

  const missingInB = [...filesA].filter((f) => !filesB.has(f)).sort();
  const extraInB = [...filesB].filter((f) => !filesA.has(f)).sort();

  const common = [...filesA].filter((f) => filesB.has(f)).sort();
  const diffing = common.filter((file) => {
    const bufA = fs.readFileSync(path.join(dirA, file));
    const bufB = fs.readFileSync(path.join(dirB, file));
    return !bufA.equals(bufB);
  });

  const ok = missingInB.length === 0 && extraInB.length === 0 && diffing.length === 0;
  return { ok, missingInB, extraInB, diffing };
}

// ─── internal self-test: prove the checker actually bites ─────────────────
// Build two TEMP directories (never the real tree), seed them identically,
// then inject a single byte-diff into one file on the copy side and assert
// compareDirs() flags exactly that file. Everything is cleaned up after.
{
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "test-lib-mirror-selftest-"));
  const dirA = path.join(tmpRoot, "a");
  const dirB = path.join(tmpRoot, "b");
  fs.mkdirSync(dirA);
  fs.mkdirSync(dirB);

  try {
    fs.writeFileSync(path.join(dirA, "same.mjs"), "export const x = 1;\n");
    fs.writeFileSync(path.join(dirB, "same.mjs"), "export const x = 1;\n");
    fs.writeFileSync(path.join(dirA, "diverges.mjs"), "export const y = 2;\n");
    fs.writeFileSync(path.join(dirB, "diverges.mjs"), "export const y = 3;\n"); // injected byte-diff
    fs.writeFileSync(path.join(dirA, "only-in-a.mjs"), "export const z = 4;\n");
    fs.writeFileSync(path.join(dirB, "only-in-b.mjs"), "export const w = 5;\n");

    const selfTestResult = compareDirs(dirA, dirB);

    const caughtDiff = selfTestResult.diffing.includes("diverges.mjs");
    const caughtMissing = selfTestResult.missingInB.includes("only-in-a.mjs");
    const caughtExtra = selfTestResult.extraInB.includes("only-in-b.mjs");

    if (selfTestResult.ok || !caughtDiff || !caughtMissing || !caughtExtra) {
      console.error("FAIL test_lib_mirror: internal self-test did not catch the injected byte-diff / missing / extra files");
      console.error(`      checker result: ${JSON.stringify(selfTestResult)}`);
      process.exit(1);
    }

    console.log("PASS test_lib_mirror: internal self-test — checker correctly flags injected byte-diff, missing file, and extra file");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ─── real check: THIS repo's real templates/lib <-> .bee/bin/lib mirror ────

if (!fs.existsSync(TEMPLATES_LIB)) {
  console.error(`FAIL test_lib_mirror: ${TEMPLATES_LIB} does not exist`);
  process.exit(1);
}
if (!fs.existsSync(BIN_LIB)) {
  console.error(`FAIL test_lib_mirror: ${BIN_LIB} does not exist`);
  process.exit(1);
}

const result = compareDirs(TEMPLATES_LIB, BIN_LIB);
if (!result.ok) {
  console.error("FAIL test_lib_mirror: skills/bee-hive/templates/lib/ and .bee/bin/lib/ have drifted:");
  if (result.missingInB.length) {
    console.error(`      present in templates/lib but missing from .bee/bin/lib: ${result.missingInB.join(", ")}`);
  }
  if (result.extraInB.length) {
    console.error(`      present in .bee/bin/lib but missing from templates/lib: ${result.extraInB.join(", ")}`);
  }
  if (result.diffing.length) {
    console.error(`      byte-diffing in both: ${result.diffing.join(", ")}`);
  }
  process.exit(1);
}

console.log(`PASS test_lib_mirror: templates/lib and .bee/bin/lib are byte-identical (${listFiles(TEMPLATES_LIB).length} files)`);
