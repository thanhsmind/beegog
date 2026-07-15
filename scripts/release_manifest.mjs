#!/usr/bin/env node
// Release manifest generator + checker (DIST-01/DIST-03/D-03, decision ed0b2920).
//
// Enumerates the release-identity file set for the bee distribution:
//   - skills/bee-hive/templates/lib/*.mjs   -> role "source_lib"
//   - .bee/bin/lib/*.mjs                    -> role "runtime_lib"
//   - .claude-plugin/plugin.json            -> role "plugin_manifest"
//   - .codex-plugin/plugin.json             -> role "plugin_manifest"
//
// The lib directories are enumerated via fs.readdirSync — never a hand-kept
// list (crit-pattern 20260714: hand-kept file lists silently drift from the
// real tree). The two plugin.json files are individually named because they
// are not part of an enumerable lib directory.
//
// Subcommands:
//   --write     regenerate docs/history/codex-harness-hardening/release-manifest.json
//   --check     recompute the manifest from the current tree and compare it
//               against the stored one; prints each mismatch; exit 1 on any
//               path-set/hash/mode diff, exit 0 when identical
//   --selftest  proves the comparison logic actually bites: takes the real
//               (unmutated) manifest as a baseline, mutates ONE covered
//               file's content in a temp copy (never the real tree), and
//               asserts compareManifests() flags exactly that file. Exit 0
//               if the bite is proven, exit 1 if not.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "docs",
  "history",
  "codex-harness-hardening",
  "release-manifest.json",
);

const SOURCE_LIB_DIR = path.join(REPO_ROOT, "skills", "bee-hive", "templates", "lib");
const RUNTIME_LIB_DIR = path.join(REPO_ROOT, ".bee", "bin", "lib");
const NAMED_PLUGIN_MANIFESTS = [
  path.join(REPO_ROOT, ".claude-plugin", "plugin.json"),
  path.join(REPO_ROOT, ".codex-plugin", "plugin.json"),
];

const SCHEMA_VERSION = 1;

/** repo-relative POSIX path for an absolute path under REPO_ROOT. */
function relPosix(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

function sha256File(absPath) {
  const data = fs.readFileSync(absPath);
  return createHash("sha256").update(data).digest("hex");
}

function modeOctal(absPath) {
  const mode = fs.statSync(absPath).mode & 0o777;
  return mode.toString(8).padStart(3, "0");
}

function buildRecord(absPath, role) {
  return {
    path: relPosix(absPath),
    sha256: sha256File(absPath),
    mode: modeOctal(absPath),
    role,
  };
}

/** Enumerate *.mjs files directly inside dirAbsPath (no recursion), sorted. */
function enumerateMjsDir(dirAbsPath, role) {
  if (!fs.existsSync(dirAbsPath)) {
    throw new Error(`release_manifest: expected directory missing: ${dirAbsPath}`);
  }
  return fs
    .readdirSync(dirAbsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => buildRecord(path.join(dirAbsPath, entry.name), role))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Build the current manifest (array of records) by re-reading the real repo
 * tree. Read-only — never mutates anything on disk.
 */
function buildCurrentRecords() {
  const records = [
    ...enumerateMjsDir(SOURCE_LIB_DIR, "source_lib"),
    ...enumerateMjsDir(RUNTIME_LIB_DIR, "runtime_lib"),
    ...NAMED_PLUGIN_MANIFESTS.map((absPath) => {
      if (!fs.existsSync(absPath)) {
        throw new Error(`release_manifest: expected plugin manifest missing: ${absPath}`);
      }
      return buildRecord(absPath, "plugin_manifest");
    }),
  ];
  records.sort((a, b) => a.path.localeCompare(b.path));
  return records;
}

function writeManifestFile(records) {
  const manifest = { schemaVersion: SCHEMA_VERSION, files: records };
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function readStoredManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`release_manifest: stored manifest missing: ${MANIFEST_PATH} (run --write first)`);
  }
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (!parsed || !Array.isArray(parsed.files)) {
    throw new Error(`release_manifest: stored manifest malformed: ${MANIFEST_PATH}`);
  }
  return parsed.files;
}

/**
 * Compare two record arrays (stored vs current). Returns:
 *   { ok, missing, added, changed }
 * - missing: paths present in stored but not current
 * - added: paths present in current but not stored
 * - changed: [{ path, reasons: ["sha256"|"mode"|"role"] }] for paths in both
 *   whose sha256/mode/role differ
 * ok === true iff missing/added/changed are all empty.
 */
function compareManifests(stored, current) {
  const storedByPath = new Map(stored.map((r) => [r.path, r]));
  const currentByPath = new Map(current.map((r) => [r.path, r]));

  const missing = [...storedByPath.keys()].filter((p) => !currentByPath.has(p)).sort();
  const added = [...currentByPath.keys()].filter((p) => !storedByPath.has(p)).sort();

  const changed = [];
  for (const [p, storedRecord] of storedByPath) {
    const currentRecord = currentByPath.get(p);
    if (!currentRecord) continue;
    const reasons = [];
    if (storedRecord.sha256 !== currentRecord.sha256) reasons.push("sha256");
    if (storedRecord.mode !== currentRecord.mode) reasons.push("mode");
    if (storedRecord.role !== currentRecord.role) reasons.push("role");
    if (reasons.length > 0) changed.push({ path: p, reasons });
  }
  changed.sort((a, b) => a.path.localeCompare(b.path));

  const ok = missing.length === 0 && added.length === 0 && changed.length === 0;
  return { ok, missing, added, changed };
}

function printDiff(diffResult) {
  for (const p of diffResult.missing) {
    console.error(`MISMATCH missing (in stored manifest, absent from current tree): ${p}`);
  }
  for (const p of diffResult.added) {
    console.error(`MISMATCH added (in current tree, absent from stored manifest): ${p}`);
  }
  for (const c of diffResult.changed) {
    console.error(`MISMATCH ${c.path}: ${c.reasons.join(", ")} differ`);
  }
}

function runWrite() {
  const records = buildCurrentRecords();
  writeManifestFile(records);
  console.log(`WROTE ${relPosix(MANIFEST_PATH)}: ${records.length} file(s)`);
  return 0;
}

function runCheck() {
  const stored = readStoredManifest();
  const current = buildCurrentRecords();
  const diffResult = compareManifests(stored, current);
  if (diffResult.ok) {
    console.log(`release_manifest --check: ${current.length} file(s) match stored manifest`);
    return 0;
  }
  printDiff(diffResult);
  console.error(
    `release_manifest --check: FAIL (${diffResult.missing.length} missing, ${diffResult.added.length} added, ${diffResult.changed.length} changed)`,
  );
  return 1;
}

function runSelftest() {
  // Baseline: read the real, unmutated tree. Read-only.
  const baseline = buildCurrentRecords();
  if (baseline.length === 0) {
    console.error("FAIL release_manifest --selftest: baseline manifest is empty, cannot prove anything");
    return 1;
  }

  // Pick a covered file to bite on — prefer a source_lib/runtime_lib record
  // so the mutation exercises a real enumerated file, not a named one.
  const target =
    baseline.find((r) => r.role === "source_lib" || r.role === "runtime_lib") ?? baseline[0];

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "release-manifest-selftest-"));
  let selftestOk = false;
  try {
    const realAbsPath = path.join(REPO_ROOT, target.path.split("/").join(path.sep));
    const tempCopyPath = path.join(tempDir, path.basename(target.path));

    // Copy the real file's content into the temp dir, then mutate the COPY.
    const originalContent = fs.readFileSync(realAbsPath);
    fs.writeFileSync(tempCopyPath, originalContent);
    fs.appendFileSync(tempCopyPath, "\n// release_manifest --selftest mutation marker\n");

    const mutatedHash = sha256File(tempCopyPath);
    if (mutatedHash === target.sha256) {
      console.error("FAIL release_manifest --selftest: mutation did not change the file's hash");
      return 1;
    }

    // "current" = baseline with ONLY the target record's sha256 swapped to
    // the mutated hash — models what --check would see if the real file had
    // been changed, without ever touching the real tree.
    const mutatedCurrent = baseline.map((r) =>
      r.path === target.path ? { ...r, sha256: mutatedHash } : { ...r },
    );

    const diffResult = compareManifests(baseline, mutatedCurrent);

    const flagged = diffResult.changed.find((c) => c.path === target.path);
    const bites =
      diffResult.ok === false &&
      diffResult.missing.length === 0 &&
      diffResult.added.length === 0 &&
      diffResult.changed.length === 1 &&
      flagged !== undefined &&
      flagged.reasons.includes("sha256");

    if (!bites) {
      console.error(
        `FAIL release_manifest --selftest: comparison logic did not flag mutated file ${target.path} as expected`,
      );
      console.error(`      diff result: ${JSON.stringify(diffResult)}`);
      return 1;
    }

    console.log(
      `PASS release_manifest --selftest: comparison logic correctly flags a mutated file (${target.path}) as sha256 mismatch, exit 1`,
    );
    selftestOk = true;
    return 0;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (!selftestOk) {
      // no-op: cleanup already ran; kept for clarity that temp dir never
      // leaks regardless of pass/fail.
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const hasFlag = (name) => args.includes(name);

  const flags = ["--write", "--check", "--selftest"].filter(hasFlag);
  if (flags.length !== 1) {
    console.error("usage: release_manifest.mjs (--write | --check | --selftest)");
    process.exit(1);
  }

  let exitCode;
  try {
    if (hasFlag("--write")) exitCode = runWrite();
    else if (hasFlag("--check")) exitCode = runCheck();
    else exitCode = runSelftest();
  } catch (error) {
    console.error(`FAIL release_manifest: ${error.message}`);
    process.exit(1);
  }
  process.exit(exitCode);
}

main();
