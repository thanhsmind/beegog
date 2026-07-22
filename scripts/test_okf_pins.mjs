#!/usr/bin/env node
// Guard: the OKF coverage gate's ground truth must be DERIVED and honest.
//
// f2-1b (F8, supersedes F1). The gate shipped by okf-5/okf-6 compared a
// hand-authored ANCHOR_REGISTRY against hand-authored claims — the exact
// defect this repo promoted as a critical pattern ("a coverage gate derives
// its ground truth; it never compares two hand-authored lists"). The advisor
// consult then MEASURED a second, worse defect: the extractor is
// format-blind. docs/specs/onboarding.md's 22 `- **R1** —` rules inventory as
// R0 and its behaviors as B0, so "lost" anchors read as anchors that never
// existed. Reproducing 26 and 47 proved nothing: advisor-protocol is the very
// file those regexes were written against.
//
// This suite asserts the property that closes both holes:
//
//   NO EXTRACTION RESULT MAY READ AS A PASS UNLESS IT WAS POSITIVELY VERIFIED.
//
// Concretely — a pin is {commit, path, blob_sha, scheme, expected_counts} and
// ALL of it is asserted at check time; an empty extraction, a sha mismatch, a
// count mismatch, an undeclared scheme, and an unresolvable source are each a
// typed exit-1 failure, never a quiet 0/0 green. Plus the visibility that
// makes format-blindness detectable at all: unparsed-block reporting, proven
// here against onboarding.md, which MUST report a non-zero count. A clean
// parse there would mean the extractor is still blind and this suite is
// lying.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const MIGRATE = path.join(REPO_ROOT, "scripts", "okf_migrate.mjs");
const TMP = path.join(REPO_ROOT, ".bee", "tmp", "test_okf_pins");

let failures = 0;
let checks = 0;

function ok(cond, label, detail) {
  checks += 1;
  if (cond) return true;
  failures += 1;
  console.error(`FAIL test_okf_pins: ${label}`);
  if (detail !== undefined) console.error(`      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  return false;
}

function eq(actual, expected, label) {
  return ok(
    JSON.stringify(actual) === JSON.stringify(expected),
    label,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

/** git's own blob id for a byte string — no git process needed. */
function blobSha(text) {
  const body = Buffer.from(text, "utf8");
  return crypto
    .createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${body.length}\0`, "utf8"), body]))
    .digest("hex");
}

function runCli(args) {
  const r = spawnSync(process.execPath, [MIGRATE, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
}

function codes(result) {
  return (result?.issues || []).map((i) => i.code).sort();
}

// ─── load the module under test ─────────────────────────────────────────────

let M;
try {
  M = await import(pathToFileURL(MIGRATE).href);
} catch (error) {
  console.error(`FAIL test_okf_pins: could not import scripts/okf_migrate.mjs: ${error.message}`);
  process.exit(1);
}

for (const name of ["PIN_REGISTRY", "derivePin", "derivePinForArea", "extractByScheme", "resolvePinnedSource", "inventorySpec", "inventoryPatterns"]) {
  ok(typeof M[name] !== "undefined", `scripts/okf_migrate.mjs must export ${name}`);
}
if (failures > 0) {
  console.error("FAIL test_okf_pins: the derived-pin API is missing — nothing further can be asserted");
  process.exit(1);
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// ─── 1. the hand-authored anchor lists are gone ─────────────────────────────

{
  const src = fs.readFileSync(MIGRATE, "utf8");
  const codeOnly = src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
  ok(
    !/\bANCHOR_REGISTRY\b/.test(codeOnly),
    "ANCHOR_REGISTRY's hand-authored anchor list is gone from okf_migrate.mjs (F8: only the pin map remains)",
  );
  ok(
    !/\bPATTERNS_ANCHOR_REGISTRY\b/.test(codeOnly),
    "PATTERNS_ANCHOR_REGISTRY's hand-authored anchor list is gone from okf_migrate.mjs",
  );
  ok(typeof M.PIN_REGISTRY === "object" && M.PIN_REGISTRY !== null, "PIN_REGISTRY is the replacement");
}

// ─── 2. every pin declares all five parts ───────────────────────────────────

for (const [area, pin] of Object.entries(M.PIN_REGISTRY)) {
  if (pin.scheme === null) {
    ok(
      typeof pin.refusal === "string" && pin.refusal.length > 0,
      `pin "${area}" declares no scheme, so it must carry a refusal reason (F9/S5 owns choosing one)`,
    );
    continue;
  }
  for (const field of ["commit", "path", "blob_sha", "scheme", "expected_counts", "source_copy"]) {
    ok(pin[field] !== undefined && pin[field] !== null, `pin "${area}" declares ${field}`);
  }
  ok(/^[0-9a-f]{40}$/.test(pin.blob_sha || ""), `pin "${area}" blob_sha is a full 40-hex blob id`, pin.blob_sha);
  ok(
    typeof pin.expected_counts?.total === "number",
    `pin "${area}" asserts a total (a pin that expects nothing proves nothing)`,
  );
}

// ─── 3. the two shipped areas still derive their shipped counts ─────────────

const advisor = await M.derivePinForArea("advisor-protocol");
ok(advisor.ok, "derived advisor-protocol pin is green", advisor.issues);
eq(
  {
    behaviors: advisor.counts?.behaviors,
    rules: advisor.counts?.rules,
    edges: advisor.counts?.edges,
    pointers: advisor.counts?.pointers,
    total: advisor.counts?.total,
  },
  { behaviors: 4, rules: 9, edges: 6, pointers: 7, total: 26 },
  "advisor-protocol derives 26 anchors (4 B / 9 R / 6 E / 7 P) from the pinned blob",
);
ok(advisor.anchors?.all?.length === 26, "advisor-protocol's derived anchor list has 26 members", advisor.anchors?.all?.length);
ok(advisor.counts?.unparsed_blocks === 0, "advisor-protocol's pinned blob parses with zero unparsed blocks", advisor.counts?.unparsed_blocks);

const patterns = await M.derivePinForArea("critical-patterns");
ok(patterns.ok, "derived critical-patterns pin is green", patterns.issues);
ok(patterns.counts?.total === 47, "critical-patterns derives 47 anchors from the pinned blob", patterns.counts?.total);
ok(patterns.anchors?.all?.length === 47, "critical-patterns' derived anchor list has 47 members", patterns.anchors?.all?.length);

// ─── 4. the committed verbatim source copies exist and hash to blob_sha ─────

for (const [area, pin] of Object.entries(M.PIN_REGISTRY)) {
  if (pin.scheme === null) continue;
  const abs = path.join(REPO_ROOT, ...pin.source_copy.split("/"));
  if (!ok(fs.existsSync(abs), `pin "${area}"'s committed source copy exists at ${pin.source_copy} (shallow-clone fallback)`)) continue;
  ok(
    blobSha(fs.readFileSync(abs, "utf8")) === pin.blob_sha,
    `pin "${area}"'s committed source copy hashes to blob_sha`,
    `${blobSha(fs.readFileSync(abs, "utf8"))} != ${pin.blob_sha}`,
  );
}

// ─── 5. a WRONG SHA exits 1 ─────────────────────────────────────────────────

{
  const bad = { ...M.PIN_REGISTRY["advisor-protocol"], blob_sha: "0".repeat(40) };
  const r = await M.derivePin(bad, "advisor-protocol");
  ok(r.ok === false, "a pin whose blob_sha does not match the pinned commit:path is REFUSED");
  ok(codes(r).includes("PIN_SHA_MISMATCH"), "wrong sha reports the typed code PIN_SHA_MISMATCH", codes(r));

  const cli = runCli(["--derive", JSON.stringify(bad)]);
  ok(cli.code === 1, "CLI --derive exits 1 on a wrong sha", `exit ${cli.code}`);
  ok(/PIN_SHA_MISMATCH/.test(cli.err + cli.out), "CLI names PIN_SHA_MISMATCH", cli.err + cli.out);
}

// ─── 6. right sha + WRONG expected_counts exits 1 ───────────────────────────

{
  const bad = {
    ...M.PIN_REGISTRY["advisor-protocol"],
    expected_counts: { ...M.PIN_REGISTRY["advisor-protocol"].expected_counts, total: 25, rules: 8 },
  };
  const r = await M.derivePin(bad, "advisor-protocol");
  ok(r.ok === false, "a pin with the right sha but the wrong expected_counts is REFUSED (a mismatch, not only an empty set)");
  ok(codes(r).includes("PIN_COUNT_MISMATCH"), "count mismatch reports the typed code PIN_COUNT_MISMATCH", codes(r));

  const cli = runCli(["--derive", JSON.stringify(bad)]);
  ok(cli.code === 1, "CLI --derive exits 1 on a count mismatch", `exit ${cli.code}`);
  ok(/PIN_COUNT_MISMATCH/.test(cli.err + cli.out), "CLI names PIN_COUNT_MISMATCH", cli.err + cli.out);
}

// ─── 7. an EMPTY extraction exits 1 — never 0/0 green ───────────────────────

{
  const empty = "# A spec with no anchors at all\n\nJust prose.\n";
  const rel = ".bee/tmp/test_okf_pins/empty-source.md";
  fs.writeFileSync(path.join(REPO_ROOT, rel), empty);
  const pin = {
    commit: "0".repeat(40),
    path: "docs/specs/does-not-exist.md",
    blob_sha: blobSha(empty),
    scheme: "ba-nine-section",
    expected_counts: { total: 0 },
    source_copy: rel,
  };
  const r = await M.derivePin(pin, "empty-fixture");
  ok(r.ok === false, "an EMPTY extraction is REFUSED even when expected_counts says total 0 — 0/0 is never a pass");
  ok(codes(r).includes("PIN_EMPTY_EXTRACTION"), "empty extraction reports the typed code PIN_EMPTY_EXTRACTION", codes(r));

  const cli = runCli(["--derive", JSON.stringify(pin)]);
  ok(cli.code === 1, "CLI --derive exits 1 on an empty extraction", `exit ${cli.code}`);
  ok(/PIN_EMPTY_EXTRACTION/.test(cli.err + cli.out), "CLI names PIN_EMPTY_EXTRACTION", cli.err + cli.out);
}

// ─── 8. shallow-clone fallback: unresolvable blob + committed copy PASSES ───

{
  const real = M.PIN_REGISTRY["advisor-protocol"];
  const pin = { ...real, commit: "0".repeat(40) }; // `git show <sha>:<path>` cannot resolve this
  const r = await M.derivePin(pin, "advisor-protocol");
  ok(r.ok, "an unresolvable commit falls back to the committed source copy and still verifies", r.issues);
  ok(r.via === "committed-copy", "the fallback reports via=committed-copy (not a silent skip)", r.via);
  ok(r.counts?.total === 26, "the fallback derives the same 26 anchors", r.counts?.total);

  const cli = runCli(["--derive", JSON.stringify(pin)]);
  ok(cli.code === 0, "CLI --derive exits 0 via the committed-copy fallback", `exit ${cli.code} ${cli.err}`);
  ok(/committed-copy/.test(cli.out + cli.err), "CLI names the committed-copy fallback", cli.out);
}

// ─── 9. missing BOTH is exit 1, never a skip ────────────────────────────────

{
  const real = M.PIN_REGISTRY["advisor-protocol"];
  const pin = { ...real, commit: "0".repeat(40), source_copy: ".bee/tmp/test_okf_pins/absent.md" };
  const r = await M.derivePin(pin, "advisor-protocol");
  ok(r.ok === false, "an unresolvable commit with NO committed copy is REFUSED (never skipped)");
  ok(codes(r).includes("PIN_UNRESOLVED"), "missing both reports the typed code PIN_UNRESOLVED", codes(r));

  const cli = runCli(["--derive", JSON.stringify(pin)]);
  ok(cli.code === 1, "CLI --derive exits 1 when neither the blob nor the copy resolves", `exit ${cli.code}`);
}

// ─── 10. a drifted committed copy is refused ────────────────────────────────

{
  const drifted = "# not the pinned source\n";
  const rel = ".bee/tmp/test_okf_pins/drifted.md";
  fs.writeFileSync(path.join(REPO_ROOT, rel), drifted);
  const real = M.PIN_REGISTRY["advisor-protocol"];
  const pin = { ...real, commit: "0".repeat(40), source_copy: rel };
  const r = await M.derivePin(pin, "advisor-protocol");
  ok(r.ok === false, "a committed source copy that does not hash to blob_sha is REFUSED");
  ok(codes(r).includes("PIN_SHA_MISMATCH"), "a drifted copy reports PIN_SHA_MISMATCH", codes(r));
}

// ─── 11. an area with NO declared scheme is refused, never passed 0/0 ───────

{
  const r = await M.derivePinForArea("decision-memory");
  ok(r.ok === false, "decision-memory (no declared anchor scheme) is REFUSED");
  ok(codes(r).includes("PIN_NO_SCHEME"), "an undeclared scheme reports the typed code PIN_NO_SCHEME", codes(r));

  const r2 = await M.derivePinForArea("worktree-parallelism");
  ok(r2.ok === false, "worktree-parallelism (no declared anchor scheme) is REFUSED");
  ok(codes(r2).includes("PIN_NO_SCHEME"), "worktree-parallelism reports PIN_NO_SCHEME", codes(r2));

  const r3 = await M.derivePinForArea("no-such-area-at-all");
  ok(r3.ok === false, "an area with no pin at all is REFUSED");
  ok(codes(r3).includes("PIN_UNKNOWN_AREA"), "an unpinned area reports PIN_UNKNOWN_AREA", codes(r3));

  const r4 = await M.derivePin({ ...M.PIN_REGISTRY["advisor-protocol"], scheme: "invented-scheme" }, "x");
  ok(r4.ok === false, "an unknown scheme name is REFUSED");
  ok(codes(r4).includes("PIN_UNKNOWN_SCHEME"), "an unknown scheme reports PIN_UNKNOWN_SCHEME", codes(r4));
}

{
  const cli = runCli(["--check", "decision-memory"]);
  ok(cli.code === 1, "`--check decision-memory` exits 1 rather than passing an unscheme'd area", `exit ${cli.code}`);
  ok(/PIN_NO_SCHEME/.test(cli.err + cli.out), "`--check decision-memory` names PIN_NO_SCHEME", cli.err + cli.out);
}

// ─── 12. unparsed-block reporting makes format-blindness VISIBLE ────────────

{
  const onboarding = fs.readFileSync(path.join(REPO_ROOT, "docs", "specs", "onboarding.md"), "utf8");
  const inv = M.inventorySpec(onboarding);
  ok(
    typeof inv.unparsed?.blocks?.total === "number",
    "inventorySpec reports an unparsed-block count",
    inv.unparsed,
  );
  ok(
    inv.unparsed.blocks.total > 0,
    "docs/specs/onboarding.md reports a NON-ZERO unparsed-block count — a clean parse here would prove the extractor is still blind",
    inv.unparsed?.blocks,
  );
  ok(
    inv.unparsed.blocks.rules > 0 && inv.unparsed.blocks.behaviors > 0,
    "onboarding's unparsed blocks are attributed per section (its `- **R1** —` rules and unnumbered behaviors)",
    inv.unparsed?.blocks,
  );
  ok(
    typeof inv.unparsed.lines?.total === "number" && inv.unparsed.lines.total > 0,
    "inventorySpec also reports unclassified non-blank body lines per section",
    inv.unparsed?.lines,
  );

  const cli = runCli(["--inventory", "docs/specs/onboarding.md"]);
  ok(cli.code === 0, "`--inventory docs/specs/onboarding.md` runs", cli.err);
  let parsed = null;
  try {
    parsed = JSON.parse(cli.out);
  } catch { /* reported below */ }
  ok(parsed?.unparsed?.blocks?.total > 0, "the --inventory JSON surfaces the non-zero unparsed-block count", parsed?.unparsed);
}

// ─── 13. the shipped chain gates still PASS, from the derived path ──────────

{
  const cli = runCli(["--check", "advisor-protocol"]);
  ok(cli.code === 0, "`--check advisor-protocol` still exits 0", cli.err);
  ok(
    /^PASS okf_migrate --check advisor-protocol: /m.test(cli.out),
    "`--check advisor-protocol` keeps the PASS wording the chain entry depends on",
    cli.out,
  );
  const cli2 = runCli(["--check-patterns"]);
  ok(cli2.code === 0, "`--check-patterns` still exits 0", cli2.err);
  ok(
    /^PASS okf_migrate --check-patterns: /m.test(cli2.out),
    "`--check-patterns` keeps the PASS wording the chain entry depends on",
    cli2.out,
  );
}

// ─── 14. `--verify-pins` asserts every pinned area in one shot ──────────────

{
  const cli = runCli(["--verify-pins"]);
  ok(cli.code === 0, "`--verify-pins` exits 0 with the registry as shipped", cli.err);
  ok(/advisor-protocol/.test(cli.out) && /critical-patterns/.test(cli.out), "`--verify-pins` reports each pinned area", cli.out);
}

// ─── done ───────────────────────────────────────────────────────────────────

fs.rmSync(TMP, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\nFAIL test_okf_pins: ${failures} of ${checks} assertions failed`);
  process.exit(1);
}
console.log(`PASS test_okf_pins: ${checks} assertions — pins are content-addressed and fully asserted (sha, scheme, counts), empty/mismatched/unresolvable/unscheme'd extractions all exit 1, the committed-source fallback verifies via blob hash, and onboarding.md's unparsed-block count is non-zero (format-blindness is visible)`);
