#!/usr/bin/env node
// okf_migrate.mjs — migration tooling for the OKF knowledge bundle
// (okf-foundation cell okf-5, D20/D24/D29/D33/D35/D37; rebuilt on
// content-addressed pins by okf-migration-f2 cell f2-1b, decision F8).
//
// Bee-repo tooling ONLY — lives in scripts/, never shipped to hosts (D24).
// The authoring itself is agent work, not script magic: this script
// INVENTORIES a source BA spec's numbered anchors and VERIFIES a finished
// migration's coverage; it never writes a concept, a stub, or anything else.
//
// ─── the property this file exists to hold (F8) ─────────────────────────────
//
//   NO EXTRACTION RESULT MAY READ AS A PASS UNLESS IT WAS POSITIVELY VERIFIED.
//
// The first version of this gate compared a hand-authored ANCHOR_REGISTRY
// constant against a hand-authored stub map and hand-authored concept claims:
// internal consistency dressed as coverage (promoted as a critical pattern —
// docs/knowledge/patterns/20260722-a-coverage-gate-derives-ground-truth-*.md).
// The advisor consult for okf-migration-f2 then MEASURED a second, worse
// defect: the extractor is format-blind. docs/specs/onboarding.md's 22 rules,
// written `- **R1** — …`, inventoried as R0 and its unnumbered behaviors as
// B0, so *lost* content read as content that never existed. Reproducing 26
// and 47 proved nothing — advisor-protocol is the very file those regexes
// were written against, so the test passed by construction.
//
// The fix has four parts, and every one of them is asserted at check time:
//
//   1. PINS. Ground truth comes from a content-addressed pin
//      {commit, path, blob_sha, scheme, expected_counts} — see PIN_REGISTRY.
//      All of it is asserted: the blob is resolved, its sha verified, the
//      declared scheme applied, and the derived counts compared against
//      expected_counts. A count MISMATCH is a loud typed failure, not just an
//      empty set. An area with no declared scheme is REFUSED, never passed
//      0/0.
//   2. SHALLOW-CLONE FALLBACK. `git show <sha>:<path>` fails outright in a
//      `--depth 1` clone, so each pinned source is also committed verbatim
//      under docs/history/okf-migration-f2/sources/<area>.md and verified
//      with `git hash-object` against blob_sha. Missing BOTH is exit 1 —
//      never a skip.
//   3. UNPARSED-LINE REPORTING. Every inventory reports how many
//      block-starting lines it did not classify, per section, plus the raw
//      unclassified-line count. This is the visibility that makes
//      format-blindness detectable at all: `--inventory docs/specs/
//      onboarding.md` MUST report a large unparsed count. A clean parse there
//      would mean the extractor is still blind.
//   4. SCHEME AWARENESS. Two schemes exist today — `ba-nine-section`
//      (B*/R*/E*/P*) and `flat-pattern-list` (PAT*). The shape is declared
//      per area in the pin and the extractor dispatches on it. Areas whose
//      shape has not been decided yet (decision-memory, worktree-parallelism)
//      carry `scheme: null` and a refusal reason: choosing their scheme is
//      F9/S5 work, and until then the gate refuses them by name.
//
// Subcommands:
//   --inventory <path>       Parse a file with the nine-section BA scheme and
//                            emit its anchor inventory + unparsed report. JSON
//                            to stdout. Diagnostic; asserts nothing.
//   --inventory-pin <area>   Same, but against the area's PINNED blob, with
//                            every pin assertion applied.
//   --derive <pin-json>      Assert an ad-hoc pin object (the authoring aid
//                            for a new area's pin, and the gate's own test
//                            surface). Exit 0 green, exit 1 with typed codes.
//   --verify-pins            Assert every pin in PIN_REGISTRY.
//   --check <area>           Coverage check (D35), chain-failing. Asserts
//                            set-equality across three sets for the area:
//                              (1) the anchors DERIVED from the area's pinned
//                                  pre-migration blob (the "no loss" baseline
//                                  that survives the source becoming a stub),
//                              (2) the anchors recorded in the pointer stub's
//                                  anchor map (docs/specs/<area>.md, D37),
//                              (3) the anchors claimed by concepts under
//                                  docs/knowledge/areas/<area>/ via bee.sources
//                                  entries of the form
//                                  "docs/specs/<area>.md#<ANCHOR>".
//                            Every anchor must be owned by EXACTLY ONE concept
//                            (no loss, no duplication), the stub map's target
//                            path must be the claiming concept's own path, and
//                            that file must exist. Exit 0 with counts on green,
//                            exit 1 naming every violation on red.
//   --check-patterns         The same coverage law for critical-patterns.md's
//                            migration into docs/knowledge/patterns/ (okf-6),
//                            against the flat-pattern-list scheme.
//
// No --strict flag exists here on purpose: the check is already binary.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

// ─── the pin registry (F8) — the ONLY ground truth ──────────────────────────
// Replaces the hand-authored ANCHOR_REGISTRY / PATTERNS_ANCHOR_REGISTRY
// constants. Nothing here is an anchor list: a pin says *where the truth
// lives* and *what shape it has*, and the anchors are derived from the pinned
// bytes on every run.
//
// A pin's fields, all asserted (derivePin):
//   commit          the commit whose tree holds the pre-migration source
//   path            that source's repo-relative path at that commit
//   blob_sha        the exact blob id — the content address; a differing blob
//                   at commit:path, or a committed copy that hashes to
//                   anything else, is PIN_SHA_MISMATCH
//   scheme          the anchor scheme to extract with (null = undecided,
//                   refused by name)
//   expected_counts the counts the extraction MUST produce, `total` required;
//                   any declared key that differs is PIN_COUNT_MISMATCH
//   source_copy     the verbatim committed copy used when git cannot resolve
//                   the blob (a --depth 1 clone); missing it while git works
//                   is PIN_COPY_MISSING, missing BOTH is PIN_UNRESOLVED
//
// How the two shipped pins were chosen: each area's source became a pointer
// stub in the commit that migrated it, so the pin is the commit BEFORE that
// one — advisor-protocol: a0ea0cc^ = 19c0e50 (okf-4); critical-patterns:
// b0d495d^ = a0ea0cc (okf-5).
export const PIN_REGISTRY = {
  "advisor-protocol": {
    kind: "area",
    commit: "19c0e50d6d9464a3dfb0b5aa56a97bb1b53aade9",
    path: "docs/specs/advisor-protocol.md",
    blob_sha: "f3f123173726517c6a5068fd07d2b6c048a94043",
    scheme: "ba-nine-section",
    expected_counts: {
      behaviors: 4,
      rules: 9,
      edges: 6,
      pointers: 7,
      total: 26,
      // The pinned blob is a clean nine-section spec: every block-starting
      // line in an anchor-bearing section IS an anchor. Asserting 0 here is
      // what stops a future extractor regression from silently reclassifying
      // anchors as prose while the totals happen to still add up.
      unparsed_blocks: 0,
    },
    source_copy: "docs/history/okf-migration-f2/sources/advisor-protocol.md",
    note: "the 202-line BA spec as of okf-4, immediately before okf-5 (a0ea0cc) turned it into a D37 pointer stub",
  },
  "critical-patterns": {
    kind: "patterns",
    commit: "a0ea0cc40bf199192c40d425cdc11f50d4b943e5",
    path: "docs/history/learnings/critical-patterns.md",
    blob_sha: "2bf112090761cb8d1b2fbc63c897b525ac0f3b9f",
    scheme: "flat-pattern-list",
    expected_counts: { patterns: 47, total: 47, unparsed_blocks: 0 },
    source_copy: "docs/history/okf-migration-f2/sources/critical-patterns.md",
    note: "the 703-line flat dated pattern list as of okf-5, immediately before okf-6 (b0d495d) migrated it into docs/knowledge/patterns/",
  },

  // ─── declared, deliberately UNSCHEME'D (F9/S5 owns choosing their shape) ──
  // These two areas are free-form prose: the advisor's measured run produced
  // ZERO anchors for both, and worktree-parallelism has no `## Business
  // Rules` / `## Edge Cases` sections at all. Inventing a B*/R* scheme for
  // them here would fabricate structure the source never had (D10). They are
  // listed — rather than merely absent — so the gate refuses them BY NAME
  // with the reason, instead of the generic "unknown area" shrug.
  "decision-memory": {
    kind: "area",
    scheme: null,
    refusal:
      "no anchor scheme has been decided for decision-memory yet — its rules are written `- **R1 — …**`, which neither shipped scheme classifies. Choosing one is F9/S5 work (okf-migration-f2). Refusing is correct: passing it 0/0 would be the exact lie this gate exists to prevent.",
  },
  "worktree-parallelism": {
    kind: "area",
    scheme: null,
    refusal:
      "no anchor scheme has been decided for worktree-parallelism yet — it is free-form prose with no `## Business Rules` or `## Edge Cases Settled` sections at all, so every shipped scheme yields an empty set. Choosing one is F9/S5 work (okf-migration-f2).",
  },
};

const PATTERNS_SOURCE = "docs/history/learnings/critical-patterns.md";
const PATTERNS_CONCEPT_DIR = "docs/knowledge/patterns";

// ─── pin resolution ─────────────────────────────────────────────────────────

function git(args) {
  const r = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, stdout: r.stdout || "", stderr: r.stderr || "", error: r.error };
}

/** git's own blob id for a byte string, computed in-process. Used as the
 *  no-git fallback for hashObject and as a cross-check: the two must agree,
 *  and accepting either keeps a checkout whose filters differ from CI from
 *  failing the gate for a reason that has nothing to do with coverage. */
function blobShaOf(buf) {
  const body = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return crypto
    .createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${body.length}\0`, "utf8"), body]))
    .digest("hex");
}

/** The blob ids a working-tree file could legitimately carry: `git
 *  hash-object` (what git itself would store) and the in-process computation
 *  (raw bytes). Identical in this repo; both are returned so a filtered
 *  checkout or a missing git binary is not mistaken for content drift. */
export function hashObject(absPath) {
  const shas = new Set();
  const r = git(["hash-object", "--", absPath]);
  if (r.ok && /^[0-9a-f]{40}$/.test(r.stdout.trim())) shas.add(r.stdout.trim());
  try {
    shas.add(blobShaOf(fs.readFileSync(absPath)));
  } catch { /* the caller already checked existence */ }
  return [...shas];
}

function issue(code, message) {
  return { code, message };
}

/**
 * Resolve a pin's pinned bytes, asserting the content address on the way.
 * Order: the git object database first (`git rev-parse <commit>:<path>` —
 * which is exactly what fails in a `--depth 1` clone), then the committed
 * verbatim copy verified with `git hash-object` against blob_sha.
 *
 * Returns { ok, text, via, issues }. `via` is "git" or "committed-copy" —
 * never absent on a green result, so a caller can never mistake a skip for a
 * verification.
 */
export function resolvePinnedSource(pin) {
  const issues = [];
  let gitText = null;

  if (pin.commit && pin.path) {
    const rev = git(["rev-parse", "--verify", "--quiet", `${pin.commit}:${pin.path}`]);
    const resolved = rev.ok ? rev.stdout.trim() : null;
    if (resolved && /^[0-9a-f]{40}$/.test(resolved)) {
      if (resolved !== pin.blob_sha) {
        issues.push(
          issue(
            "PIN_SHA_MISMATCH",
            `${pin.commit.slice(0, 8)}:${pin.path} resolves to blob ${resolved}, but the pin declares ${pin.blob_sha} — the pin and the history disagree about what the pinned source IS`,
          ),
        );
        return { ok: false, text: null, via: null, issues };
      }
      const cat = git(["cat-file", "blob", resolved]);
      if (cat.ok) gitText = cat.stdout;
    }
  }

  // The committed copy is verified whenever the pin declares one — including
  // when git already answered. A copy that has drifted from the blob is the
  // failure the fallback would otherwise hide the day a clone goes shallow.
  let copyText = null;
  if (pin.source_copy) {
    const abs = path.join(REPO_ROOT, ...pin.source_copy.split("/"));
    if (!fs.existsSync(abs)) {
      if (gitText !== null) {
        issues.push(
          issue(
            "PIN_COPY_MISSING",
            `the pinned source copy ${pin.source_copy} is missing. git can still resolve the blob here, but a --depth 1 clone cannot — commit the verbatim copy (F8)`,
          ),
        );
        return { ok: false, text: null, via: null, issues };
      }
      issues.push(
        issue(
          "PIN_UNRESOLVED",
          `neither git nor a committed copy can produce the pinned source: ${pin.commit ? `${pin.commit.slice(0, 8)}:${pin.path}` : "<no commit pinned>"} is unresolvable and ${pin.source_copy} does not exist. This is exit 1, never a skip`,
        ),
      );
      return { ok: false, text: null, via: null, issues };
    }
    const shas = hashObject(abs);
    if (!shas.includes(pin.blob_sha)) {
      issues.push(
        issue(
          "PIN_SHA_MISMATCH",
          `the committed source copy ${pin.source_copy} hashes to ${shas.join(" / ") || "<unhashable>"}, but the pin declares blob ${pin.blob_sha} — the copy is not the pinned source`,
        ),
      );
      return { ok: false, text: null, via: null, issues };
    }
    copyText = fs.readFileSync(abs, "utf8");
  }

  if (gitText !== null) return { ok: true, text: gitText, via: "git", issues };
  if (copyText !== null) return { ok: true, text: copyText, via: "committed-copy", issues };

  issues.push(
    issue(
      "PIN_UNRESOLVED",
      `the pinned blob ${pin.blob_sha} could not be resolved from git and the pin declares no committed source copy to fall back to. This is exit 1, never a skip`,
    ),
  );
  return { ok: false, text: null, via: null, issues };
}

// ─── inventory / extraction ─────────────────────────────────────────────────

const BA_SECTIONS = {
  behaviors: (h) => h.startsWith("behaviors"),
  rules: (h) => h.startsWith("business rules"),
  edges: (h) => h.startsWith("edge cases"),
  pointers: (h) => h.startsWith("pointers"),
};

function baSectionOf(heading) {
  const h = heading.toLowerCase();
  for (const [name, test] of Object.entries(BA_SECTIONS)) {
    if (test(h)) return name;
  }
  return null;
}

// A "block start" is a line that opens a new unit of meaning in an
// anchor-bearing section: a top-level bullet or a bold-lead paragraph. Wrapped
// continuation prose and nested bullets are neither — they belong to whatever
// block precedes them. Counting UNCLASSIFIED block starts is what makes
// format-blindness visible: docs/specs/onboarding.md's 22 `- **R1** —` rules
// and its unnumbered `**Detect (every run).**` behaviors are all block starts
// that no shipped regex classifies, so they surface as unparsed instead of
// silently not existing.
const BLOCK_START_RE = /^(-\s+|\*\*)/;

function emptyUnparsed() {
  return {
    blocks: { behaviors: 0, rules: 0, edges: 0, pointers: 0, total: 0 },
    lines: { behaviors: 0, rules: 0, edges: 0, pointers: 0, total: 0 },
    samples: [],
  };
}

// Parse a nine-section BA spec's numbered anchors. Returns
// { behaviors, rules, edges, pointers, all, unparsed } where behaviors/rules
// carry the source's own B-/R-numbered ids and edges/pointers are assigned
// E-/P-ids by top-level-bullet position inside their sections (document
// order). Classification is unchanged from okf-5 — deliberately: the two
// shipped areas must still derive 26 and 47 from the same rules. What is new
// is `unparsed`, which reports what the classification could NOT see.
export function inventorySpec(text) {
  const lines = text.split("\n");
  const behaviors = [];
  const rules = [];
  let edgeBullets = 0;
  let pointerBullets = 0;
  let section = null; // classification section (edges/pointers only, as shipped)
  let anchorSection = null; // accounting section (all four)
  const unparsed = emptyUnparsed();
  let lineNo = 0;

  for (const line of lines) {
    lineNo += 1;
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      const h = heading[1].toLowerCase();
      if (h.startsWith("edge cases")) section = "edges";
      else if (h.startsWith("pointers")) section = "pointers";
      else section = null;
      anchorSection = baSectionOf(heading[1]);
      continue;
    }

    let classified = false;
    const bold = /^\*\*(B\d+)\s+—/.exec(line);
    if (bold) {
      behaviors.push(bold[1]);
      classified = true;
    } else {
      const rule = /^-\s+(R\d+)\s+—/.exec(line);
      if (rule) {
        rules.push(rule[1]);
        classified = true;
      } else if (/^-\s+/.test(line)) {
        if (section === "edges") {
          edgeBullets += 1;
          classified = true;
        } else if (section === "pointers") {
          pointerBullets += 1;
          classified = true;
        }
      }
    }

    if (classified || !anchorSection) continue;
    if (!line.trim()) continue;
    if (/^#/.test(line)) continue; // structural sub-headings, not content

    unparsed.lines[anchorSection] += 1;
    unparsed.lines.total += 1;
    if (BLOCK_START_RE.test(line)) {
      unparsed.blocks[anchorSection] += 1;
      unparsed.blocks.total += 1;
      if (unparsed.samples.length < 12) {
        unparsed.samples.push(`${anchorSection} L${lineNo}: ${line.trim().slice(0, 100)}`);
      }
    }
  }

  const edges = Array.from({ length: edgeBullets }, (_, i) => `E${i + 1}`);
  const pointers = Array.from({ length: pointerBullets }, (_, i) => `P${i + 1}`);
  return {
    behaviors,
    rules,
    edges,
    pointers,
    all: [...behaviors, ...rules, ...edges, ...pointers],
    unparsed,
  };
}

/** Parse critical-patterns.md's own shape: one anchor per `## [YYYYMMDD] …`
 *  heading, document order. Mirrors inventorySpec's role for the BA shape.
 *  Its unparsed report counts `##` headings that are NOT dated pattern
 *  headings — for this flat scheme a heading IS the block start — plus the
 *  raw body-line count. */
export function inventoryPatterns(text) {
  const headingRe = /^## \[(\d{8})\] .+$/;
  const anyH2Re = /^##\s+/;
  let n = 0;
  const unparsed = {
    blocks: { headings: 0, total: 0 },
    lines: { body: 0, total: 0 },
    samples: [],
  };
  let lineNo = 0;
  let seenFirst = false;
  for (const line of text.split("\n")) {
    lineNo += 1;
    if (headingRe.test(line)) {
      n += 1;
      seenFirst = true;
      continue;
    }
    if (anyH2Re.test(line)) {
      unparsed.blocks.headings += 1;
      unparsed.blocks.total += 1;
      if (unparsed.samples.length < 12) unparsed.samples.push(`L${lineNo}: ${line.trim().slice(0, 100)}`);
      continue;
    }
    if (!seenFirst) continue; // front matter / document title, before any pattern
    if (/^#/.test(line)) continue;
    if (!line.trim()) continue;
    unparsed.lines.body += 1;
    unparsed.lines.total += 1;
  }
  const all = Array.from({ length: n }, (_, i) => `PAT${i + 1}`);
  return { patterns: all, all, unparsed };
}

export const SCHEMES = {
  "ba-nine-section": (text) => {
    const inv = inventorySpec(text);
    return {
      anchors: inv,
      counts: {
        behaviors: inv.behaviors.length,
        rules: inv.rules.length,
        edges: inv.edges.length,
        pointers: inv.pointers.length,
        total: inv.all.length,
        unparsed_blocks: inv.unparsed.blocks.total,
      },
      unparsed: inv.unparsed,
    };
  },
  "flat-pattern-list": (text) => {
    const inv = inventoryPatterns(text);
    return {
      anchors: inv,
      counts: {
        patterns: inv.all.length,
        total: inv.all.length,
        unparsed_blocks: inv.unparsed.blocks.total,
      },
      unparsed: inv.unparsed,
    };
  },
};

/** Dispatch extraction on the pin's declared scheme. An unknown scheme name
 *  is a refusal, never an empty result. */
export function extractByScheme(scheme, text) {
  const fn = SCHEMES[scheme];
  if (!fn) {
    const err = new Error(
      `no extractor for scheme "${scheme}" (known: ${Object.keys(SCHEMES).join(", ")})`,
    );
    err.code = "PIN_UNKNOWN_SCHEME";
    throw err;
  }
  return fn(text);
}

// ─── pin assertion ──────────────────────────────────────────────────────────

/**
 * Assert a pin end to end and return its derived anchors.
 *
 * Every failure mode is typed and every one of them is exit-1 material:
 *   PIN_NO_SCHEME        the area's anchor shape has not been decided
 *   PIN_UNKNOWN_SCHEME   the declared scheme has no extractor
 *   PIN_INCOMPLETE       the pin asserts no total (a pin that expects nothing
 *                        proves nothing)
 *   PIN_SHA_MISMATCH     commit:path, or the committed copy, is not blob_sha
 *   PIN_COPY_MISSING     no committed copy to survive a shallow clone
 *   PIN_UNRESOLVED       neither git nor a copy can produce the source
 *   PIN_EMPTY_EXTRACTION the extraction produced nothing — 0/0 is NEVER a pass
 *   PIN_COUNT_MISMATCH   a derived count differs from expected_counts
 */
export function derivePin(pin, label = "<pin>") {
  const fail = (...issues) => ({ ok: false, label, issues, counts: null, anchors: null, unparsed: null, via: null });

  if (!pin || typeof pin !== "object") {
    return fail(issue("PIN_UNKNOWN_AREA", `no pin object supplied for "${label}"`));
  }
  if (pin.scheme === null || pin.scheme === undefined) {
    return fail(
      issue(
        "PIN_NO_SCHEME",
        `"${label}" declares no anchor scheme, so it is REFUSED rather than passed 0/0. ${pin.refusal || "Declare a scheme in PIN_REGISTRY before gating this area."}`,
      ),
    );
  }
  if (!SCHEMES[pin.scheme]) {
    return fail(
      issue("PIN_UNKNOWN_SCHEME", `"${label}" declares scheme "${pin.scheme}", which has no extractor (known: ${Object.keys(SCHEMES).join(", ")})`),
    );
  }
  if (!pin.blob_sha || !/^[0-9a-f]{40}$/.test(pin.blob_sha)) {
    return fail(issue("PIN_INCOMPLETE", `"${label}" declares no usable blob_sha — a pin without a content address is not a pin`));
  }
  if (typeof pin.expected_counts?.total !== "number") {
    return fail(issue("PIN_INCOMPLETE", `"${label}" declares no expected_counts.total — a pin that expects nothing proves nothing`));
  }

  const resolved = resolvePinnedSource(pin);
  if (!resolved.ok) return fail(...resolved.issues);

  let extracted;
  try {
    extracted = extractByScheme(pin.scheme, resolved.text);
  } catch (error) {
    return fail(issue(error.code || "PIN_UNKNOWN_SCHEME", `"${label}": ${error.message}`));
  }

  const issues = [];

  // An empty extraction is refused BEFORE the count comparison, so a pin that
  // declares `total: 0` can never launder a format-blind read into a green.
  if (!extracted.anchors.all || extracted.anchors.all.length === 0) {
    issues.push(
      issue(
        "PIN_EMPTY_EXTRACTION",
        `"${label}": scheme "${pin.scheme}" extracted ZERO anchors from the pinned source (${resolved.via}). An empty extraction never reads as a pass — either the pin points at the wrong blob or the scheme cannot see this file's shape`,
      ),
    );
  }

  for (const [key, want] of Object.entries(pin.expected_counts)) {
    const got = extracted.counts[key];
    if (got !== want) {
      issues.push(
        issue(
          "PIN_COUNT_MISMATCH",
          `"${label}": expected_counts.${key} = ${want}, but the pinned blob (${resolved.via}) derives ${got}`,
        ),
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, label, issues, counts: extracted.counts, anchors: extracted.anchors, unparsed: extracted.unparsed, via: resolved.via };
  }
  return {
    ok: true,
    label,
    issues: [],
    counts: extracted.counts,
    anchors: extracted.anchors,
    unparsed: extracted.unparsed,
    via: resolved.via,
    blob_sha: pin.blob_sha,
    commit: pin.commit,
  };
}

/** derivePin for a registered area, with an explicit refusal for an area that
 *  carries no pin at all. */
export function derivePinForArea(area) {
  const pin = PIN_REGISTRY[area];
  if (!pin) {
    return {
      ok: false,
      label: area,
      counts: null,
      anchors: null,
      unparsed: null,
      via: null,
      issues: [
        issue(
          "PIN_UNKNOWN_AREA",
          `no pin for area "${area}" — it has no content-addressed ground truth, so it cannot be gated (pinned: ${Object.keys(PIN_REGISTRY).join(", ")})`,
        ),
      ],
    };
  }
  return derivePin(pin, area);
}

function reportPinFailure(label, result) {
  console.error(`FAIL okf_migrate pin ${label}: ${result.issues.length} problem(s) — the derived ground truth is NOT trustworthy`);
  for (const i of result.issues) console.error(`  - ${i.code}: ${i.message}`);
}

// ─── check mode helpers ─────────────────────────────────────────────────────

/** Anchor → target concept path rows from a D37 pointer-stub anchor map.
 *  Rows look like: | B1 | [docs/knowledge/areas/<area>/x.md](../…) | (also
 *  matches multi-letter anchor prefixes such as critical-patterns.md's
 *  `PAT1`..`PATn`, okf-6 — the BA-spec single-letter anchors B1/R2/E3/P4
 *  are the special case of one-or-more-letters, so this is additive.) */
export function parseStubAnchorMap(text) {
  const map = new Map();
  const issues = [];
  for (const line of text.split("\n")) {
    const row = /^\|\s*`?([A-Z]+\d+)`?\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!row) continue;
    const anchor = row[1];
    const cell = row[2];
    const link = /\[([^\]]+)\]\([^)]+\)/.exec(cell);
    const target = (link ? link[1] : cell).replace(/`/g, "").trim();
    if (map.has(anchor)) {
      issues.push(`stub anchor map lists ${anchor} more than once`);
      continue;
    }
    map.set(anchor, target);
  }
  return { map, issues };
}

/** bee.sources claims of the form <source>#<ANCHOR> from every concept in a
 *  directory (index.md/log.md excluded). Shared by both check modes. */
async function collectClaims({ dir, source, anchorPattern }) {
  const knowledge = await import(
    pathToFileURL(path.join(REPO_ROOT, ".bee", "bin", "lib", "knowledge.mjs")).href
  );
  const absDir = path.join(REPO_ROOT, ...dir.split("/"));
  const claims = new Map(); // anchor -> [concept repo-relative path, ...]
  const issues = [];
  if (!fs.existsSync(absDir)) {
    issues.push(`concept directory missing: ${dir}/`);
    return { claims, issues };
  }
  const claimRe = new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#(${anchorPattern})$`);
  for (const name of fs.readdirSync(absDir).sort()) {
    if (!name.endsWith(".md") || name === "index.md" || name === "log.md") continue;
    const rel = `${dir}/${name}`;
    const parsed = knowledge.parseFrontmatter(fs.readFileSync(path.join(absDir, name), "utf8"));
    if (!parsed.ok || !parsed.present) {
      issues.push(`${rel}: frontmatter missing or unparseable — cannot read bee.sources claims`);
      continue;
    }
    const bee = parsed.data.bee && typeof parsed.data.bee === "object" ? parsed.data.bee : {};
    const sources = Array.isArray(bee.sources) ? bee.sources : [];
    for (const entry of sources) {
      const m = typeof entry === "string" ? claimRe.exec(entry) : null;
      if (!m) continue;
      if (!claims.has(m[1])) claims.set(m[1], []);
      claims.get(m[1]).push(rel);
    }
  }
  return { claims, issues };
}

/** The shared D35 coverage law: every derived anchor owned by exactly one
 *  concept, mapped by the stub to that same concept, and that file present. */
function coverageIssues({ expected, stubMap, claims, stubLabel, registryLabel }) {
  const issues = [];
  const expectedSet = new Set(expected);
  let duplicated = 0;
  let lost = 0;

  for (const anchor of expected) {
    const owners = claims.get(anchor) || [];
    const mapped = stubMap.get(anchor);
    if (!mapped) {
      issues.push(`LOST in stub map: ${anchor} has no row in ${stubLabel}'s anchor map (D37)`);
    }
    if (owners.length === 0) {
      lost += 1;
      issues.push(`LOST in concepts: ${anchor} is claimed by no concept's bee.sources (expected one owner)`);
      continue;
    }
    if (owners.length > 1) {
      duplicated += 1;
      issues.push(`DUPLICATED: ${anchor} is claimed by ${owners.length} concepts: ${owners.join(", ")}`);
      continue;
    }
    const owner = owners[0];
    if (mapped && mapped !== owner) {
      issues.push(`MAP MISMATCH: stub map sends ${anchor} to "${mapped}" but the claiming concept is "${owner}"`);
    }
    if (!fs.existsSync(path.join(REPO_ROOT, owner))) {
      issues.push(`MISSING FILE: ${anchor}'s owner "${owner}" does not exist on disk`);
    }
  }
  for (const anchor of stubMap.keys()) {
    if (!expectedSet.has(anchor)) {
      issues.push(`EXTRA in stub map: ${anchor} is not in ${registryLabel}`);
    }
  }
  for (const anchor of claims.keys()) {
    if (!expectedSet.has(anchor)) {
      issues.push(`EXTRA claim: ${anchor} (claimed by ${claims.get(anchor).join(", ")}) is not in ${registryLabel}`);
    }
  }

  const owned = expected.filter((a) => (claims.get(a) || []).length === 1).length;
  return { issues, owned, duplicated, lost };
}

export async function runCheck(area) {
  // Ground truth first: a pin that cannot be asserted stops the check dead.
  // There is no path from here to a green without a verified extraction.
  const derived = derivePinForArea(area);
  if (!derived.ok) {
    reportPinFailure(`--check ${area}`, derived);
    console.error(`FAIL okf_migrate --check ${area}: ground truth could not be derived — refusing to report coverage`);
    return 1;
  }
  const expected = derived.anchors.all;

  const issues = [];
  const stubRel = `docs/specs/${area}.md`;
  const stubPath = path.join(REPO_ROOT, "docs", "specs", `${area}.md`);
  let stubMap = new Map();
  if (!fs.existsSync(stubPath)) {
    issues.push(`pointer stub missing: ${stubRel} (the path is never deleted — D20)`);
  } else {
    const parsedStub = parseStubAnchorMap(fs.readFileSync(stubPath, "utf8"));
    stubMap = parsedStub.map;
    issues.push(...parsedStub.issues);
  }
  const { claims, issues: claimIssues } = await collectClaims({
    dir: `docs/knowledge/areas/${area}`,
    source: `docs/specs/${area}.md`,
    anchorPattern: "[A-Z]\\d+",
  });
  issues.push(...claimIssues);

  const cov = coverageIssues({
    expected,
    stubMap,
    claims,
    stubLabel: stubRel,
    registryLabel: `the anchors derived from ${area}'s pinned source (${derived.commit.slice(0, 8)}:${PIN_REGISTRY[area].path}, blob ${derived.blob_sha.slice(0, 12)}, via ${derived.via})`,
  });
  issues.push(...cov.issues);

  if (issues.length > 0) {
    console.error(`FAIL okf_migrate --check ${area}: ${expected.length} anchors, ${cov.owned} owned, ${cov.duplicated} duplicated, ${cov.lost} lost`);
    for (const i of issues) console.error(`  - ${i}`);
    return 1;
  }
  console.log(`PASS okf_migrate --check ${area}: ${expected.length} anchors, ${cov.owned} owned, 0 duplicated, 0 lost — every source anchor lands in exactly one concept and the stub map agrees (D35/D37)`);
  console.log(`     ground truth DERIVED from pinned blob ${derived.blob_sha} (${derived.commit.slice(0, 8)}:${PIN_REGISTRY[area].path}, via ${derived.via}, scheme ${PIN_REGISTRY[area].scheme}) — counts asserted ${JSON.stringify(derived.counts)}`);
  return 0;
}

export async function runCheckPatterns() {
  const derived = derivePinForArea("critical-patterns");
  if (!derived.ok) {
    reportPinFailure("--check-patterns", derived);
    console.error("FAIL okf_migrate --check-patterns: ground truth could not be derived — refusing to report coverage");
    return 1;
  }
  const expected = derived.anchors.all;

  const issues = [];
  const stubPath = path.join(REPO_ROOT, ...PATTERNS_SOURCE.split("/"));
  let stubMap = new Map();
  if (!fs.existsSync(stubPath)) {
    issues.push(`pointer stub missing: ${PATTERNS_SOURCE} (the path is never deleted — D20)`);
  } else {
    const parsedStub = parseStubAnchorMap(fs.readFileSync(stubPath, "utf8"));
    stubMap = parsedStub.map;
    issues.push(...parsedStub.issues);
  }
  const { claims, issues: claimIssues } = await collectClaims({
    dir: PATTERNS_CONCEPT_DIR,
    source: PATTERNS_SOURCE,
    anchorPattern: "[A-Z]+\\d+",
  });
  issues.push(...claimIssues);

  const cov = coverageIssues({
    expected,
    stubMap,
    claims,
    stubLabel: PATTERNS_SOURCE,
    registryLabel: `the anchors derived from critical-patterns' pinned source (${derived.commit.slice(0, 8)}:${PATTERNS_SOURCE}, blob ${derived.blob_sha.slice(0, 12)}, via ${derived.via})`,
  });
  issues.push(...cov.issues);

  if (issues.length > 0) {
    console.error(`FAIL okf_migrate --check-patterns: ${expected.length} anchors, ${cov.owned} owned, ${cov.duplicated} duplicated, ${cov.lost} lost`);
    for (const i of issues) console.error(`  - ${i}`);
    return 1;
  }
  console.log(`PASS okf_migrate --check-patterns: ${expected.length} anchors, ${cov.owned} owned, 0 duplicated, 0 lost — every critical-patterns.md heading lands in exactly one bee.pattern concept and the stub map agrees (D35/D37)`);
  console.log(`     ground truth DERIVED from pinned blob ${derived.blob_sha} (${derived.commit.slice(0, 8)}:${PATTERNS_SOURCE}, via ${derived.via}, scheme flat-pattern-list) — counts asserted ${JSON.stringify(derived.counts)}`);
  return 0;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printDerived(label, result) {
  console.log(
    JSON.stringify(
      {
        pin: label,
        ok: result.ok,
        via: result.via,
        blob_sha: result.blob_sha ?? null,
        counts: result.counts,
        unparsed: result.unparsed,
        issues: result.issues,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--inventory" && args[1]) {
    const abs = path.resolve(REPO_ROOT, args[1]);
    if (!fs.existsSync(abs)) {
      console.error(`okf_migrate --inventory: no such file: ${args[1]}`);
      return 1;
    }
    const inv = inventorySpec(fs.readFileSync(abs, "utf8"));
    console.log(
      JSON.stringify(
        {
          file: args[1],
          scheme: "ba-nine-section",
          counts: {
            behaviors: inv.behaviors.length,
            rules: inv.rules.length,
            edges: inv.edges.length,
            pointers: inv.pointers.length,
            total: inv.all.length,
          },
          // Unparsed blocks are the honesty signal: a block-starting line in
          // an anchor-bearing section that no rule classified. A non-zero
          // count means this scheme cannot see part of this file — the
          // anchors are not missing from the world, they are missing from the
          // extractor.
          unparsed: inv.unparsed,
          anchors: {
            behaviors: inv.behaviors,
            rules: inv.rules,
            edges: inv.edges,
            pointers: inv.pointers,
            all: inv.all,
          },
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (args[0] === "--inventory-pin" && args[1]) {
    const result = derivePinForArea(args[1]);
    printDerived(args[1], result);
    if (!result.ok) {
      reportPinFailure(args[1], result);
      return 1;
    }
    return 0;
  }

  if (args[0] === "--derive" && args[1]) {
    let pin;
    try {
      pin = JSON.parse(args[1]);
    } catch (error) {
      console.error(`okf_migrate --derive: pin argument is not valid JSON: ${error.message}`);
      return 1;
    }
    const label = pin.path || "<ad-hoc pin>";
    const result = derivePin(pin, label);
    printDerived(label, result);
    if (!result.ok) {
      reportPinFailure(label, result);
      return 1;
    }
    console.log(`PASS okf_migrate --derive ${label}: ${result.counts.total} anchors from blob ${pin.blob_sha} via ${result.via}`);
    return 0;
  }

  if (args[0] === "--verify-pins") {
    let bad = 0;
    for (const [area, pin] of Object.entries(PIN_REGISTRY)) {
      if (pin.scheme === null) {
        console.log(`SKIP-REFUSED ${area}: no anchor scheme declared — this area cannot be gated yet (F9/S5)`);
        continue;
      }
      const result = derivePin(pin, area);
      if (!result.ok) {
        bad += 1;
        reportPinFailure(area, result);
        continue;
      }
      console.log(
        `PASS ${area}: ${result.counts.total} anchors ${JSON.stringify(result.counts)} from blob ${pin.blob_sha} via ${result.via} (scheme ${pin.scheme})`,
      );
    }
    if (bad > 0) {
      console.error(`FAIL okf_migrate --verify-pins: ${bad} pin(s) could not be asserted`);
      return 1;
    }
    console.log("PASS okf_migrate --verify-pins: every declared pin resolves, hashes, extracts, and matches its expected counts");
    return 0;
  }

  if (args[0] === "--check" && args[1]) {
    return runCheck(args[1]);
  }
  if (args[0] === "--check-patterns") {
    return runCheckPatterns();
  }
  console.error(
    "usage: okf_migrate.mjs (--inventory <spec-path> | --inventory-pin <area> | --derive <pin-json> | --verify-pins | --check <area> | --check-patterns)",
  );
  return 1;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  process.exitCode = await main();
}
