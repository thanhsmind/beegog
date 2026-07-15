#!/usr/bin/env node
// Guard: the release-version tuple must never desync. DIST-05 (SPEC), decision
// ed0b2920: BEE_VERSION is duplicated across the templates/lib mirror and the
// live .bee/bin/lib copy, and the two plugin manifests carry their own
// top-level `.version`. All four must always read the same value — this is
// the mechanical guard that catches a release that bumped one and missed
// another.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const COMPONENTS = [
  {
    name: "skills/bee-hive/templates/lib/state.mjs (BEE_VERSION)",
    path: path.join(REPO_ROOT, "skills", "bee-hive", "templates", "lib", "state.mjs"),
    kind: "js-const",
  },
  {
    name: ".bee/bin/lib/state.mjs (BEE_VERSION)",
    path: path.join(REPO_ROOT, ".bee", "bin", "lib", "state.mjs"),
    kind: "js-const",
  },
  {
    name: ".claude-plugin/plugin.json (.version)",
    path: path.join(REPO_ROOT, ".claude-plugin", "plugin.json"),
    kind: "json-version",
  },
  {
    name: ".codex-plugin/plugin.json (.version)",
    path: path.join(REPO_ROOT, ".codex-plugin", "plugin.json"),
    kind: "json-version",
  },
];

const BEE_VERSION_RE = /export\s+const\s+BEE_VERSION\s*=\s*['"]([^'"]+)['"]/;

/**
 * Extracts BEE_VERSION from a state.mjs source string. Returns null if not
 * found (caller treats that as a read failure, not a silent pass).
 */
function extractJsConstVersion(source) {
  const match = source.match(BEE_VERSION_RE);
  return match ? match[1] : null;
}

/**
 * Reads a single component's version given its {path, kind}. Returns the
 * version string, or throws with a message naming the component.
 */
function readComponentVersion(component, readFileFn = fs.readFileSync) {
  let raw;
  try {
    raw = readFileFn(component.path, "utf8");
  } catch (error) {
    throw new Error(`could not read ${component.name} at ${component.path}: ${error.message}`);
  }

  if (component.kind === "js-const") {
    const version = extractJsConstVersion(raw);
    if (!version) {
      throw new Error(`${component.name}: no BEE_VERSION export found in ${component.path}`);
    }
    return version;
  }

  if (component.kind === "json-version") {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${component.name}: could not parse JSON at ${component.path}: ${error.message}`);
    }
    if (typeof parsed.version !== "string" || !parsed.version) {
      throw new Error(`${component.name}: no top-level .version string in ${component.path}`);
    }
    return parsed.version;
  }

  throw new Error(`${component.name}: unknown component kind "${component.kind}"`);
}

/**
 * Given a list of {name, version} entries, checks they are all equal.
 * Returns { ok, desynced } — desynced is the list of {name, version} entries
 * that do not match the majority/first value, empty when all equal.
 */
function checkTupleEquality(entries) {
  if (entries.length === 0) {
    return { ok: true, desynced: [] };
  }
  const baseline = entries[0].version;
  const desynced = entries.filter((entry) => entry.version !== baseline);
  return { ok: desynced.length === 0, desynced };
}

// ─── internal self-test: prove the checker actually bites ─────────────────
// Feed checkTupleEquality() a synthetic desynced tuple built in-memory only —
// no real file is touched — and assert it is flagged. This proves the
// equality check is not a rubber stamp before trusting it on the real tuple.
{
  const syntheticEntries = [
    { name: "synthetic-a", version: "0.1.44" },
    { name: "synthetic-b", version: "0.1.44" },
    { name: "synthetic-c (desynced)", version: "0.1.43" },
    { name: "synthetic-d", version: "0.1.44" },
  ];

  const selfTestResult = checkTupleEquality(syntheticEntries);

  if (selfTestResult.ok || !selfTestResult.desynced.some((e) => e.name === "synthetic-c (desynced)")) {
    console.error("FAIL test_release_tuple: internal self-test did not catch a synthetic desynced tuple");
    console.error(`      synthetic entries: ${JSON.stringify(syntheticEntries)}`);
    console.error(`      checker result: ${JSON.stringify(selfTestResult)}`);
    process.exit(1);
  }

  console.log("PASS test_release_tuple: internal self-test — checker correctly flags a synthetic desynced tuple");
}

// ─── real check: THIS repo's real release tuple ────────────────────────────

const entries = [];
for (const component of COMPONENTS) {
  try {
    const version = readComponentVersion(component);
    entries.push({ name: component.name, version });
  } catch (error) {
    console.error(`FAIL test_release_tuple: ${error.message}`);
    process.exit(1);
  }
}

const result = checkTupleEquality(entries);
if (!result.ok) {
  console.error(`FAIL test_release_tuple: release-version tuple is desynced across ${result.desynced.length} component(s):`);
  for (const entry of entries) {
    const marker = result.desynced.includes(entry) ? " <-- DESYNCED" : "";
    console.error(`      ${entry.name}: ${entry.version}${marker}`);
  }
  process.exit(1);
}

console.log(`PASS test_release_tuple: all ${entries.length} components agree on version ${entries[0].version} (${entries.map((e) => e.name).join(", ")})`);
