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
//      format-blindness detectable at all — and it is what f2-3 used to
//      MEASURE the blindness instead of forcing a scheme around it: it found
//      doctrine-layer reporting more unparsed blocks (21) than derived anchors
//      (20). f2-4 then widened the classifier to the id forms the other areas
//      actually use (see "the id forms" below). `--inventory docs/specs/
//      onboarding.md` MUST still report a non-zero unparsed count — its 20
//      unnumbered bold-lead behaviour paragraphs carry no id and are reported,
//      never invented. A clean parse there would mean the extractor had
//      started fabricating structure.
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
//   --fidelity <area>        The F11 per-anchor overlap table for one area.
//                            Diagnostic view of a guard --check already runs.
//   --telemetry              The F12 shape ratios for every pinned area, plus
//                            the whole-bundle invariants.
//
// No --strict flag exists here on purpose: the check is already binary.
//
// ─── what f2-2 added (F11/F12, and the f2-1b judge's residual gap) ──────────
//
// f2-1b made the ground truth DERIVED. That closes "was this anchor claimed?"
// but not "was it actually carried across?" — a concept that summarises its
// anchor into one sentence still satisfies every count, which is precisely the
// degradation mode of a long serial re-authoring run. Three additions:
//
//   F11 FIDELITY FLOOR. Every anchor's text in the pinned blob must survive in
//       the body of the concept that claims it, at >= 0.60 normalized token
//       overlap. Below the floor names the anchor, its owner, the ratio, and
//       the missing tokens. The tuning rule is inverted from the usual
//       instinct and is enforced by the suite: both shipped areas clear it
//       UNEDITED — a failure means the NORMALIZATION is wrong, never the
//       migrated content, and never the threshold.
//   F12 DRIFT TELEMETRY. Per area, anchors_per_concept and
//       concepts_per_100_source_lines, compared against the running median of
//       the pinned areas outside a [0.5x, 2x] band. Fewer than three pinned
//       areas is no median at all, so it reports and never fails. Plus the
//       whole-bundle invariants — authority uniqueness, zero not_canonical,
//       index freshness — on EVERY check.
//   MANDATORY unparsed_blocks. A pin omitting expected_counts.unparsed_blocks
//       is PIN_INCOMPLETE. `total` only asserts the counts still add up;
//       unparsed_blocks is what asserts the extractor still SEES the same
//       shape, and opting out of that guard silently was still possible.

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
  "doctrine-layer": {
    kind: "area",
    // The pin is HEAD at the moment f2-3 ran, taken BEFORE the stub replaced
    // the content — the same "the commit before the migrating commit" rule the
    // two shipped pins follow, expressed the only way a cell can express it
    // about its own commit: pin the parent, copy the bytes, hash both.
    commit: "ed65720b726333ce6fafe5a9470e1d6c490e04c7",
    path: "docs/specs/doctrine-layer.md",
    blob_sha: "351bf72adc2c34f9f18d9f3612735a6c92efac02",
    scheme: "ba-nine-section",
    expected_counts: {
      behaviors: 10,
      rules: 17,
      edges: 5,
      pointers: 7,
      total: 39,
      // NOT zero, and deliberately pinned at what it really is. Two block
      // starts in this source carry no id and none is invented for them (D10):
      // a bold-lead continuation line inside B8 (`**for unit execution** …`,
      // L176) and the unnumbered `- **The verify ladder …**` bullet at L305.
      // Both are unparsed for ID purposes and BOTH still travel with the
      // anchor whose block they sit in — B8 and R17 respectively — so the
      // fidelity floor measures them and no content is homeless. Asserting 2
      // here is what makes a future classifier change that swallows or splits
      // them a loud failure instead of a silent re-shaping.
      unparsed_blocks: 2,
    },
    source_copy: "docs/history/okf-migration-f2/sources/doctrine-layer.md",
    note: "the 386-line BA spec as of ed65720 (f2-4, the classifier widening), immediately before f2-3 turned it into a D37 pointer stub — the cleanest conforming area of the nine",
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

  "decision-memory": {
    kind: "area",
    // The pin is HEAD at the moment f2-5 ran, taken BEFORE the stub replaced
    // the content — same rule as doctrine-layer's pin: pin the parent, copy
    // the bytes, hash both.
    commit: "8710d03afa1d0253124fbbb081fde47ad5b3209e",
    path: "docs/specs/decision-memory.md",
    blob_sha: "2e8ec59cfa540827cc568cfefcb5f81bebe2d822",
    scheme: "ba-nine-section",
    expected_counts: {
      behaviors: 0,
      rules: 9,
      edges: 0,
      pointers: 0,
      total: 9,
      // f2-4 widened the id forms and this area's nine rules — written
      // `- **R1 — …**` — were derivable all along; "shapeless" was a verdict
      // about the reader, not the file. Zero unparsed blocks: the cleanest
      // area of the nine (no Behaviors/Edge Cases/Pointers sections exist in
      // the source at all, and every Business Rules bullet is a numbered
      // block start the classifier can already see).
      unparsed_blocks: 0,
    },
    source_copy: "docs/history/okf-migration-f2/sources/decision-memory.md",
    note: "the 39-line BA spec as of 8710d03 (f2-3), immediately before f2-5 turned it into a D37 pointer stub — nine business rules, no behaviors/edges/pointers sections",
  },

  "verify-pipeline": {
    kind: "area",
    // The pin is HEAD at the moment f2-6 ran, taken BEFORE the stub replaced
    // the content — same rule as doctrine-layer's and decision-memory's pins:
    // pin the parent, copy the bytes, hash both.
    commit: "72fd8284fa1e1303d026eb4f94e31fed07a30542",
    path: "docs/specs/verify-pipeline.md",
    blob_sha: "eab70d7e665ec73a5a8dc227bee5c16ada74dbe8",
    scheme: "ba-nine-section",
    expected_counts: {
      behaviors: 0,
      rules: 5,
      edges: 4,
      pointers: 5,
      total: 14,
      // The source's "Behaviors & Operations" section carries 7 bold-lead
      // bullets with no B-id at all — none is invented into an anchor (D10).
      // Every Business Rules / Edge Cases / Pointers bullet IS a classified
      // block start, so the 7 unparsed blocks are entirely those unnumbered
      // behaviors, confirmed by --inventory before any edit.
      unparsed_blocks: 7,
    },
    source_copy: "docs/history/okf-migration-f2/sources/verify-pipeline.md",
    note: "the 132-line BA spec as of 72fd828 (f2-5), immediately before f2-6 turned it into a D37 pointer stub — 5 rules, 4 edge cases, 5 pointers, and 7 unnumbered behavior bullets",
  },

  "performance-log": {
    kind: "area",
    // The pin is HEAD at the moment f2-7 ran, taken BEFORE the stub replaced
    // the content — same rule as doctrine-layer's, decision-memory's, and
    // verify-pipeline's pins: pin the parent, copy the bytes, hash both.
    commit: "46a56a4172eea71958728fac67b6436d7e8cdd11",
    path: "docs/specs/performance-log.md",
    blob_sha: "efdc9f2149cb6ae64f0a4f4a416de539dab82d93",
    scheme: "ba-nine-section",
    expected_counts: {
      behaviors: 0,
      rules: 11,
      edges: 5,
      pointers: 7,
      total: 23,
      // The source's entire "Behaviors & Operations" section — 7 bold-lead
      // paragraphs (Opening/Closing/One-shot/Reading-rendering/Populating the
      // store/Building the matrix/Measurement rules) plus 3 of Measurement
      // rules' own un-ided sub-bullets — carries no B-id at all, so none of
      // it is invented into an anchor (D10). Every Business Rules bullet is a
      // `- **Rn — …**` block start the classifier already sees, and every
      // Edge Cases / Pointers bullet is a top-level `- ` block start, so the
      // 10 unparsed blocks are entirely those Behaviors & Operations blocks,
      // confirmed by --inventory before any edit.
      unparsed_blocks: 10,
    },
    source_copy: "docs/history/okf-migration-f2/sources/performance-log.md",
    note: "the 225-line BA spec as of 46a56a4 (f2-6), immediately before f2-7 turned it into a D37 pointer stub — 11 rules, 5 edge cases, 7 pointers, and 10 unparsed Behaviors & Operations blocks",
  },

  // ─── declared, not yet pinned (the migrating cell authors the pin) ────────
  // Listed — rather than merely absent — so the gate refuses them BY NAME with
  // a reason, instead of the generic "unknown area" shrug.
  "worktree-parallelism": {
    kind: "area",
    scheme: null,
    refusal:
      "worktree-parallelism is GENUINELY shapeless, re-confirmed by f2-4's post-widening sweep: it has no `## Behaviors`, `## Business Rules`, `## Edge Cases Settled` or `## Pointers` sections at all, so there is nothing for any anchor scheme to read — 0 anchors AND 0 unparsed blocks, which is what real shapelessness looks like next to decision-memory's hidden nine. Choosing its per-area scheme is F9/S5 work (okf-migration-f2).",
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

// ─── the id forms (f2-4) ────────────────────────────────────────────────────
// The classifier shipped by okf-5 required a BARE id at the head of the block:
// /^\*\*(B\d+)\s+—/ and /^-\s+(R\d+)\s+—/. Those were written against
// advisor-protocol, and five of the nine remaining areas simply write the same
// anchors in a different hand — the id bold-wrapped, or carrying a citation
// before the em dash, or letter-suffixed:
//
//   - **R1** — …                     doctrine-layer L213, onboarding L337
//   - **R1 — …**                     decision-memory L16, performance-log L140
//   - **R1** (D1) — …                feedback-digest L259
//   - **R7 (not yet implemented — P24)** — …   onboarding L365
//   - R8a — …                        hook-runtime L412
//   **B3a — …**                      doctrine-layer L89, workflow-state L207
//
// Read by the narrow patterns, doctrine-layer derived R0 while carrying R1–R17,
// and decision-memory derived 0 anchors and was filed by the planning sweep as
// "shapeless — needs a bespoke scheme". It is not shapeless: its nine rules were
// invisible. A "no structure here" verdict that is really "this reader cannot
// see the structure" is the same lie the derived gate exists to prevent, one
// level up — so the classifier is widened to the id FORMS, and the sweep
// re-classified (docs/history/okf-migration-f2/reports/inventory-sweep.md).
//
// Two boundaries hold this in place:
//
//   1. IT READS IDS, IT NEVER INVENTS THEM. An unnumbered bold-lead paragraph
//      (`**Detect (every run).**`, onboarding L96) stays UNPARSED and keeps
//      showing in the unparsed report. Assigning it a positional B-id would
//      fabricate structure the source never had (D10) and would collide with
//      the source's own B-ids in the areas that use both.
//   2. THE NO-OP IS THE SAFETY PROPERTY. advisor-protocol must still derive
//      exactly 26 {4,9,6,7} with unparsed_blocks 0, and critical-patterns 47,
//      from their pinned blobs with expected_counts untouched. A widening that
//      moves either is too broad and gets narrowed — never the pin relaxed.
//      Asserted in scripts/test_okf_pins.mjs (sections 24-26).
const BOLD_MARKER_RE = /\*\*/g;
/** Bold markers dropped, for ID MATCHING ONLY — never for anchor text. */
const unbold = (line) => line.replace(BOLD_MARKER_RE, "");
// `(?:\([^)]*\))?` is the optional citation between the id and its em dash;
// `[a-z]?` is the letter suffix (B3a, R8a, R20b). The em dash itself is still
// required, so an ASCII-hyphen bullet is prose, exactly as before.
const BEHAVIOR_ID_RE = /^(B\d+[a-z]?)\s*(?:\([^)]*\))?\s+—/;
const RULE_ID_RE = /^-\s+(R\d+[a-z]?)\s*(?:\([^)]*\))?\s+—/;

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

  // f2-2 (F11): the anchor's own BYTES, not only its id. An anchor's text runs
  // from its block-starting line up to the next block start or the next `##`
  // heading, so wrapped continuation prose and nested bullets travel with the
  // anchor they belong to. Ids alone can only prove an anchor was CLAIMED; the
  // text is what makes "was it actually carried across?" a measurable question.
  const texts = new Map();
  let current = null;
  const openAnchor = (id) => {
    current = [];
    texts.set(id, current);
  };

  for (const line of lines) {
    lineNo += 1;
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      const h = heading[1].toLowerCase();
      if (h.startsWith("edge cases")) section = "edges";
      else if (h.startsWith("pointers")) section = "pointers";
      else section = null;
      anchorSection = baSectionOf(heading[1]);
      current = null;
      continue;
    }

    let classified = false;
    const bold = line.startsWith("**") ? BEHAVIOR_ID_RE.exec(unbold(line)) : null;
    if (bold) {
      behaviors.push(bold[1]);
      openAnchor(bold[1]);
      classified = true;
    } else {
      const rule = /^-\s+/.test(line) ? RULE_ID_RE.exec(unbold(line)) : null;
      if (rule) {
        rules.push(rule[1]);
        openAnchor(rule[1]);
        classified = true;
      } else if (/^-\s+/.test(line)) {
        if (section === "edges") {
          edgeBullets += 1;
          openAnchor(`E${edgeBullets}`);
          classified = true;
        } else if (section === "pointers") {
          pointerBullets += 1;
          openAnchor(`P${pointerBullets}`);
          classified = true;
        }
      }
    }

    if (classified) {
      current.push(line);
      continue;
    }
    if (current && anchorSection) current.push(line);
    if (!anchorSection) continue;
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
    texts: new Map([...texts].map(([id, buf]) => [id, buf.join("\n").trim()])),
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
  const texts = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    lineNo += 1;
    if (headingRe.test(line)) {
      n += 1;
      seenFirst = true;
      current = [line];
      texts.set(`PAT${n}`, current);
      continue;
    }
    if (anyH2Re.test(line)) {
      current = null;
      unparsed.blocks.headings += 1;
      unparsed.blocks.total += 1;
      if (unparsed.samples.length < 12) unparsed.samples.push(`L${lineNo}: ${line.trim().slice(0, 100)}`);
      continue;
    }
    if (current) current.push(line);
    if (!seenFirst) continue; // front matter / document title, before any pattern
    if (/^#/.test(line)) continue;
    if (!line.trim()) continue;
    unparsed.lines.body += 1;
    unparsed.lines.total += 1;
  }
  const all = Array.from({ length: n }, (_, i) => `PAT${i + 1}`);
  return {
    patterns: all,
    all,
    texts: new Map([...texts].map(([id, buf]) => [id, buf.join("\n").trim()])),
    unparsed,
  };
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
  // f2-2: unparsed_blocks is MANDATORY, closing the f2-1b judge's residual
  // gap. `total` alone only asserts that the counts still add up; it is
  // unparsed_blocks that asserts the extractor still SEES the same shape. A
  // pin omitting it opts out of the format-blindness guard silently — exactly
  // the "absence read as a pass" this file exists to prevent — so omission is
  // a refusal, not a default.
  if (typeof pin.expected_counts.unparsed_blocks !== "number") {
    return fail(
      issue(
        "PIN_INCOMPLETE",
        `"${label}" declares no expected_counts.unparsed_blocks — a pin that does not assert how much of its source the extractor could NOT classify cannot detect format-blindness, and silently opting out of that guard is the failure this gate exists to prevent (f2-2). Declare it, even when it is 0`,
      ),
    );
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

// ─── F11: the per-anchor fidelity floor ─────────────────────────────────────
//
// Set-equality answers "was this anchor CLAIMED by exactly one concept?". It
// cannot answer "was the anchor actually CARRIED ACROSS?" — a concept that
// summarises its anchor into a sentence still satisfies every count. That is
// the degradation mode of a long serial re-authoring run: anchor-shaped
// compliance. F11 makes it mechanically detectable without a judge.
//
// For each anchor: normalized token overlap between the anchor's text in the
// PINNED BLOB and the body of the concept that claims it.
//
//   overlap = |anchor_tokens ∩ concept_tokens| / |anchor_tokens|
//
// The denominator is the ANCHOR, never the concept: a concept is free to be
// longer, better organised, or to merge several anchors — it is not free to
// drop the anchor's content.
//
// ─── the tuning rule, which is inverted from the usual instinct ─────────────
//
// advisor-protocol's 26 anchors and critical-patterns' 47 must ALL clear this
// floor with ZERO edits to their concepts. If one fails, the NORMALIZATION is
// wrong — never the migrated content, never the threshold. Both are asserted
// in scripts/test_okf_pins.mjs, which also asserts that the MEDIAN sits well
// clear of the floor: a median barely above 0.60 would itself mean the
// normalization had become too strict and the floor was measuring the metric
// rather than the migration. Measured as shipped:
//
//   advisor-protocol   n=26  min 0.977  median 1.000  max 1.000
//   critical-patterns  n=47  min 0.771  median 0.900  max 0.955
export const FIDELITY_FLOOR = 0.6;

// Deliberately small: articles, prepositions, conjunctions, pronouns and
// auxiliaries only. Every dropped word makes the metric STRICTER (it removes
// a cheap hit from the anchor's denominator), so this list is kept to words
// that carry no domain meaning. Modal/negation words — never, always, must,
// only, refuses — are NOT stopwords: in this repo they are the content.
export const FIDELITY_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "did", "do", "does",
  "for", "from", "had", "has", "have", "he", "her", "here", "hers", "him", "his", "how", "i",
  "in", "into", "is", "it", "its", "me", "my", "of", "on", "onto", "or", "our", "ours", "out",
  "she", "so", "than", "that", "the", "their", "theirs", "them", "then", "there", "these",
  "they", "this", "those", "to", "up", "us", "was", "we", "were", "what", "when", "where",
  "which", "who", "whom", "with", "you", "your", "yours",
]);

/**
 * lowercase → strip markdown emphasis, backticks and all punctuation → split
 * on whitespace → drop one-character tokens and the stopword set → dedupe.
 *
 * Collapsing every non-alphanumeric run to a space is what makes the two
 * sides comparable at all: `--runtime`, "read-only", `docs/specs/x.md` and
 * **bold** all normalize identically whether the source hyphenated, quoted,
 * backticked or bolded them, so a concept is never punished for reformatting
 * what it faithfully kept.
 */
export function normalizeTokens(text) {
  const tokens = new Set();
  for (const raw of String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")) {
    if (raw.length < 2) continue; // single characters are noise, never content
    if (FIDELITY_STOPWORDS.has(raw)) continue;
    tokens.add(raw);
  }
  return tokens;
}

/** Fraction of the ANCHOR's normalized tokens that survive in the concept.
 *  An anchor with no meaningful tokens at all scores 1 — there is nothing to
 *  lose, and a divide-by-zero must never read as a failure. */
export function tokenOverlap(anchorText, conceptText) {
  const anchor = normalizeTokens(anchorText);
  if (anchor.size === 0) return 1;
  const concept = normalizeTokens(conceptText);
  let hit = 0;
  for (const token of anchor) if (concept.has(token)) hit += 1;
  return hit / anchor.size;
}

export function medianOf(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pure: measure every expected anchor against its owning concept's body.
 *
 *   expected  anchor ids (the derived ground truth)
 *   texts     Map anchor -> the anchor's text in the pinned blob
 *   claims    Map anchor -> [owner path, ...] (collectClaims' shape)
 *   bodies    Map owner path -> that concept's body text
 *
 * Anchors with no owner, or with more than one, are NOT reported here — that
 * is coverageIssues' job, and reporting them twice would bury the fidelity
 * signal under duplicates of a failure already named.
 */
export function fidelityReport({ expected, texts, claims, bodies, floor = FIDELITY_FLOOR }) {
  const get = (map, key) => (map instanceof Map ? map.get(key) : map?.[key]);
  const rows = [];
  const issues = [];
  for (const anchor of expected) {
    const ownersRaw = get(claims, anchor);
    const owners = Array.isArray(ownersRaw) ? ownersRaw : ownersRaw ? [ownersRaw] : [];
    if (owners.length !== 1) continue;
    const owner = owners[0];
    const anchorText = get(texts, anchor);
    const body = get(bodies, owner);
    if (typeof anchorText !== "string") {
      issues.push(
        `FIDELITY UNMEASURABLE: ${anchor} has no extracted text from the pinned blob — the extractor produced an id it cannot show the bytes for (F11)`,
      );
      continue;
    }
    if (typeof body !== "string") {
      issues.push(`FIDELITY UNMEASURABLE: ${anchor}'s owner "${owner}" could not be read (F11)`);
      continue;
    }
    const anchorTokens = normalizeTokens(anchorText);
    const conceptTokens = normalizeTokens(body);
    const missing = [...anchorTokens].filter((t) => !conceptTokens.has(t));
    const ratio = anchorTokens.size === 0 ? 1 : (anchorTokens.size - missing.length) / anchorTokens.size;
    rows.push({ anchor, owner, ratio, anchor_tokens: anchorTokens.size, missing_tokens: missing.length, missing });
    if (ratio < floor) {
      issues.push(
        `FIDELITY BELOW FLOOR: ${anchor} (owner ${owner}) retains ${ratio.toFixed(3)} normalized token overlap with its text in the pinned blob — the floor is ${floor.toFixed(2)} (F11). ` +
          `${missing.length} of ${anchorTokens.size} anchor tokens are absent from the owning concept: ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? ", …" : ""}. ` +
          `The anchor was summarised away, not migrated — restore the content; never lower the floor`,
      );
    }
  }
  const ratios = rows.map((r) => r.ratio);
  return {
    issues,
    rows,
    stats: {
      n: rows.length,
      min: ratios.length ? Math.min(...ratios) : null,
      median: medianOf(ratios),
      max: ratios.length ? Math.max(...ratios) : null,
      floor,
    },
  };
}

/** Where an area's concepts live and how it cites its source. One place, so
 *  --check, --check-patterns, the fidelity floor and the telemetry can never
 *  disagree about what a given area's wiring is. */
/** The claim-suffix form a nine-section area's anchors can take, kept in ONE
 *  place so the extractor, the stub-row parser and the claim matcher can never
 *  drift apart again (f2-3). `[a-z]?` is f2-4's letter suffix: B3a, B7a, R8a. */
export const AREA_ANCHOR_PATTERN = "[A-Z]\\d+[a-z]?";

export function wiringFor(area) {
  const pin = PIN_REGISTRY[area];
  if (pin?.kind === "patterns") {
    return { dir: PATTERNS_CONCEPT_DIR, source: PATTERNS_SOURCE, anchorPattern: "[A-Z]+\\d+" };
  }
  return { dir: `docs/knowledge/areas/${area}`, source: `docs/specs/${area}.md`, anchorPattern: AREA_ANCHOR_PATTERN };
}

function conceptFilesIn(dir) {
  const abs = path.join(REPO_ROOT, ...dir.split("/"));
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((n) => n.endsWith(".md") && n !== "index.md" && n !== "log.md")
    .sort();
}

async function readConceptBodies(dir, owners) {
  const knowledge = await import(
    pathToFileURL(path.join(REPO_ROOT, ".bee", "bin", "lib", "knowledge.mjs")).href
  );
  const bodies = new Map();
  for (const owner of new Set(owners)) {
    const abs = path.join(REPO_ROOT, ...owner.split("/"));
    if (!fs.existsSync(abs)) continue;
    const raw = fs.readFileSync(abs, "utf8");
    const parsed = knowledge.parseFrontmatter(raw);
    // The BODY only — frontmatter would smuggle the anchor id itself and the
    // source citation into the token pool, letting a stub score above the
    // floor on its own bookkeeping.
    bodies.set(owner, parsed.ok && parsed.present ? parsed.body : raw);
  }
  return bodies;
}

/** The F11 floor for one registered area, end to end: derive the pin, collect
 *  the claims, read the owning bodies, measure. */
export async function areaFidelity(area) {
  const derived = derivePinForArea(area);
  if (!derived.ok) {
    return { ok: false, area, rows: [], stats: null, issues: derived.issues.map((i) => `${i.code}: ${i.message}`) };
  }
  const { dir, source, anchorPattern } = wiringFor(area);
  const { claims, issues: claimIssues } = await collectClaims({ dir, source, anchorPattern });
  const owners = [...claims.values()].flat();
  const bodies = await readConceptBodies(dir, owners);
  const report = fidelityReport({
    expected: derived.anchors.all,
    texts: derived.anchors.texts,
    claims,
    bodies,
  });
  return { ok: true, area, rows: report.rows, stats: report.stats, issues: [...claimIssues, ...report.issues] };
}

// ─── F12: drift telemetry ───────────────────────────────────────────────────
//
// Drift should land as a chain red at cell 4, not be discovered at cell 10.
// Two shape ratios per area, both cheap and both directional:
//
//   anchors_per_concept            too high = a dumping-ground concept
//                                  swallowing a section; too low = concepts
//                                  shredded past usefulness
//   concepts_per_100_source_lines  the same drift measured against the source
//                                  rather than against the anchor count
//
// Compared against the running MEDIAN of already-pinned areas, outside a
// [0.5x, 2x] band. With fewer than three pinned areas there is no median worth
// the name, so telemetry REPORTS and never fails — a two-sample "median" is a
// coin flip, and a gate that fails on a coin flip teaches everyone to ignore
// it.
//
// f2-3: THE MEDIAN IS TAKEN OVER COMPARABLE SHAPES ONLY. F12 says "the running
// median of already-migrated AREAS", and the moment a third pin made a median
// exist at all, the reason for that wording became measurable: critical-patterns
// is a `flat-pattern-list` migration where one anchor IS one concept by
// construction (okf-6), so its anchors_per_concept is pinned at 1.00 forever and
// can never sit inside a band drawn around nine-section AREAS (5.57, 6.5). Left
// pooled, the guard reported drift in already-shipped, already-reviewed work
// that no cell had touched — and would have gone on reporting it whatever any
// future migration did. Rows are still reported for every pinned source; only
// the comparison population is restricted, to pins of the same `kind`.

export const TELEMETRY_MIN_SAMPLES = 3;
export const TELEMETRY_METRICS = ["anchors_per_concept", "concepts_per_100_source_lines"];

/** One telemetry row per gateable pinned area (an unscheme'd pin has no
 *  derived anchors, so it contributes no shape). */
export function collectTelemetry() {
  const rows = [];
  for (const [area, pin] of Object.entries(PIN_REGISTRY)) {
    if (!pin.scheme) continue;
    const derived = derivePin(pin, area);
    if (!derived.ok) continue;
    const resolved = resolvePinnedSource(pin);
    const sourceLines = resolved.ok ? resolved.text.split("\n").length : 0;
    const concepts = conceptFilesIn(wiringFor(area).dir).length;
    if (!concepts || !sourceLines) continue;
    rows.push({
      area,
      // "area" | "patterns" — the comparability key (f2-3). Shape ratios are
      // only meaningful against migrations of the same shape.
      kind: pin.kind || "area",
      anchors: derived.counts.total,
      concepts,
      source_lines: sourceLines,
      anchors_per_concept: derived.counts.total / concepts,
      concepts_per_100_source_lines: (concepts * 100) / sourceLines,
    });
  }
  return rows;
}

/** Pure: is `current` an outlier against the running median of `samples`? */
export function telemetryIssues({ current, samples, minSamples = TELEMETRY_MIN_SAMPLES }) {
  if (!current || !Array.isArray(samples) || samples.length < minSamples) return [];
  const issues = [];
  for (const metric of TELEMETRY_METRICS) {
    const values = samples.map((s) => s[metric]).filter((v) => typeof v === "number" && v > 0);
    if (values.length < minSamples) continue;
    const median = medianOf(values);
    if (!median) continue;
    const value = current[metric];
    if (typeof value !== "number" || value <= 0) continue;
    const ratio = value / median;
    if (ratio > 2 || ratio < 0.5) {
      issues.push(
        `TELEMETRY OUTLIER (F12): ${current.area}'s ${metric} is ${value.toFixed(2)}, ${ratio.toFixed(2)}x the running median ${median.toFixed(2)} across ${values.length} pinned areas — outside the [0.5x, 2x] band. Either this area's decomposition drifted from every area before it, or the areas before it did`,
      );
    }
  }
  return issues;
}

// ─── F12: whole-bundle invariants, run on EVERY check ───────────────────────
//
// Three properties that must hold for the bundle as a whole, not per area:
// authority uniqueness (D31), zero not_canonical concepts, and fresh
// generated indexes (D21). The bundle's own checker already computes all
// three — but two of them are PROFILE WARNINGS there (D13 keeps `knowledge
// check` in the chain non-strict on purpose), so a drifting bundle would stay
// green forever. The coverage gate graduates exactly those two codes to
// gate-failing for itself, without touching the chain's own `knowledge check`
// entry or D13's warning/error split.

const BUNDLE_FATAL_WARNINGS = new Set(["duplicate_authoritative_for", "duplicate_id", "not_canonical"]);

/** Pure: given a parsed `knowledge check --json` payload and the result of
 *  `knowledge index --check`, is the bundle healthy? */
export function bundleInvariantIssues({ check, index }) {
  const issues = [];
  if (!check || typeof check !== "object") {
    issues.push(`BUNDLE UNHEALTHY: \`bee knowledge check --json\` produced no readable report — the bundle's health is unknown, which is never a pass (F12)`);
  } else {
    for (const error of check.okf?.errors || []) {
      issues.push(`BUNDLE UNHEALTHY: OKF error ${error.code} in ${error.file} — ${error.message}`);
    }
    for (const warning of check.profile?.warnings || []) {
      if (!BUNDLE_FATAL_WARNINGS.has(warning.code)) continue;
      issues.push(
        `BUNDLE UNHEALTHY: ${warning.code} in ${warning.file} — ${warning.message}. This is a profile warning to \`knowledge check\` (D13) but a hard failure to the coverage gate: a migration cannot be verified against a bundle whose authority or canonicality has drifted (F12)`,
      );
    }
  }
  if (index && index.ok === false) {
    issues.push(
      `BUNDLE UNHEALTHY: the generated indexes are stale (D21) — \`bee knowledge index --check\` reports: ${String(index.output || "").trim().split("\n").slice(0, 4).join(" / ")}`,
    );
  }
  return issues;
}

function beeCli(args) {
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, ".bee", "bin", "bee.mjs"), ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
}

/** Run the whole-bundle invariants against the live bundle. */
export function runBundleInvariants() {
  const checkRun = beeCli(["knowledge", "check", "--json"]);
  let check = null;
  try {
    check = JSON.parse(checkRun.out);
  } catch {
    check = null;
  }
  const indexRun = beeCli(["knowledge", "index", "--check"]);
  const index = { ok: indexRun.code === 0, output: `${indexRun.out}${indexRun.err}` };
  return { issues: bundleInvariantIssues({ check, index }), check, index };
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
    // `[a-z]?` (f2-3): f2-4 widened the EXTRACTOR to the letter-suffixed id
    // form (B3a, B7a, R8a) but not the two readers that have to agree with it
    // — this row parser and the bee.sources claim matcher below. Left narrow,
    // a derived `B3a` could never be matched by any stub row or any concept
    // claim, so the gate would report it LOST no matter how faithfully it had
    // been migrated: an unsatisfiable red, which is just the format-blindness
    // defect wearing the opposite sign. Strict no-op on both shipped pins
    // (advisor-protocol carries no suffixed id; `PAT1`..`PAT47` are unchanged).
    const row = /^\|\s*`?([A-Z]+\d+[a-z]?)`?\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
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

/**
 * The three f2-2 guards, run identically for every area (F11 + F12). Returns
 * { issues, fidelity, telemetry, telemetryNote } — the issues join the
 * coverage issues, and the reports are printed on green too, because a floor
 * whose margin nobody can see is a floor nobody can tune.
 */
async function runGuards(area, claims, bodies, derived) {
  const issues = [];

  const fidelity = fidelityReport({
    expected: derived.anchors.all,
    texts: derived.anchors.texts,
    claims,
    bodies,
  });
  issues.push(...fidelity.issues);

  const telemetry = collectTelemetry();
  const current = telemetry.find((r) => r.area === area) || null;
  // Same-shape comparison only (f2-3) — see the F12 header note.
  const comparable = current ? telemetry.filter((r) => r.kind === current.kind) : [];
  const telemetryNote =
    comparable.length < TELEMETRY_MIN_SAMPLES
      ? `${comparable.length} pinned "${current ? current.kind : "?"}"-shaped source(s) of ${telemetry.length} pinned in total — fewer than ${TELEMETRY_MIN_SAMPLES} comparable samples, so there is no running median yet and telemetry REPORTS ONLY (never fails)`
      : `running median across ${comparable.length} pinned "${current.kind}"-shaped sources; outlier band [0.5x, 2x]`;
  issues.push(...telemetryIssues({ current, samples: comparable }));

  issues.push(...runBundleInvariants().issues);

  return { issues, fidelity, telemetry, current, telemetryNote };
}

function printGuards(guards) {
  const s = guards.fidelity.stats;
  if (s.n > 0) {
    console.log(
      `     fidelity floor ${s.floor.toFixed(2)} (F11): ${s.n} anchors measured against their owning concept — min ${s.min.toFixed(3)}, median ${s.median.toFixed(3)}, max ${s.max.toFixed(3)} normalized token overlap with the pinned blob`,
    );
  }
  if (guards.current) {
    console.log(
      `     telemetry (F12): anchors_per_concept ${guards.current.anchors_per_concept.toFixed(2)}, concepts_per_100_source_lines ${guards.current.concepts_per_100_source_lines.toFixed(2)} (${guards.current.anchors} anchors, ${guards.current.concepts} concepts, ${guards.current.source_lines} source lines) — ${guards.telemetryNote}`,
    );
  }
  console.log(
    `     bundle invariants (F12): authority uniqueness, zero not_canonical, and index freshness all hold across docs/knowledge/`,
  );
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
  // wiringFor is the single source of the dir/source/anchor-pattern triple —
  // re-stating it here is exactly how the claim matcher fell a widening behind
  // the extractor (f2-3).
  const { claims, issues: claimIssues } = await collectClaims(wiringFor(area));
  issues.push(...claimIssues);

  const cov = coverageIssues({
    expected,
    stubMap,
    claims,
    stubLabel: stubRel,
    registryLabel: `the anchors derived from ${area}'s pinned source (${derived.commit.slice(0, 8)}:${PIN_REGISTRY[area].path}, blob ${derived.blob_sha.slice(0, 12)}, via ${derived.via})`,
  });
  issues.push(...cov.issues);

  const bodies = await readConceptBodies(`docs/knowledge/areas/${area}`, [...claims.values()].flat());
  const guards = await runGuards(area, claims, bodies, derived);
  issues.push(...guards.issues);

  if (issues.length > 0) {
    console.error(`FAIL okf_migrate --check ${area}: ${expected.length} anchors, ${cov.owned} owned, ${cov.duplicated} duplicated, ${cov.lost} lost`);
    for (const i of issues) console.error(`  - ${i}`);
    return 1;
  }
  console.log(`PASS okf_migrate --check ${area}: ${expected.length} anchors, ${cov.owned} owned, 0 duplicated, 0 lost — every source anchor lands in exactly one concept and the stub map agrees (D35/D37)`);
  console.log(`     ground truth DERIVED from pinned blob ${derived.blob_sha} (${derived.commit.slice(0, 8)}:${PIN_REGISTRY[area].path}, via ${derived.via}, scheme ${PIN_REGISTRY[area].scheme}) — counts asserted ${JSON.stringify(derived.counts)}`);
  printGuards(guards);
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

  const bodies = await readConceptBodies(PATTERNS_CONCEPT_DIR, [...claims.values()].flat());
  const guards = await runGuards("critical-patterns", claims, bodies, derived);
  issues.push(...guards.issues);

  if (issues.length > 0) {
    console.error(`FAIL okf_migrate --check-patterns: ${expected.length} anchors, ${cov.owned} owned, ${cov.duplicated} duplicated, ${cov.lost} lost`);
    for (const i of issues) console.error(`  - ${i}`);
    return 1;
  }
  console.log(`PASS okf_migrate --check-patterns: ${expected.length} anchors, ${cov.owned} owned, 0 duplicated, 0 lost — every critical-patterns.md heading lands in exactly one bee.pattern concept and the stub map agrees (D35/D37)`);
  console.log(`     ground truth DERIVED from pinned blob ${derived.blob_sha} (${derived.commit.slice(0, 8)}:${PATTERNS_SOURCE}, via ${derived.via}, scheme flat-pattern-list) — counts asserted ${JSON.stringify(derived.counts)}`);
  printGuards(guards);
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

  if (args[0] === "--fidelity" && args[1]) {
    const result = await areaFidelity(args[1]);
    console.log(
      JSON.stringify(
        {
          area: args[1],
          ok: result.ok && result.issues.length === 0,
          floor: FIDELITY_FLOOR,
          stats: result.stats,
          rows: result.rows.map((r) => ({
            anchor: r.anchor,
            owner: r.owner,
            ratio: Number(r.ratio.toFixed(4)),
            anchor_tokens: r.anchor_tokens,
            missing_tokens: r.missing_tokens,
          })),
          issues: result.issues,
        },
        null,
        2,
      ),
    );
    if (!result.ok || result.issues.length > 0) {
      for (const i of result.issues) console.error(`  - ${i}`);
      console.error(`FAIL okf_migrate --fidelity ${args[1]}: ${result.issues.length} anchor(s) below the ${FIDELITY_FLOOR} floor (F11)`);
      return 1;
    }
    return 0;
  }

  if (args[0] === "--telemetry") {
    const rows = collectTelemetry();
    const bundle = runBundleInvariants();
    console.log(
      JSON.stringify(
        {
          pinned_areas: rows.length,
          min_samples_for_a_median: TELEMETRY_MIN_SAMPLES,
          // Per shape, not overall (f2-3): a median is only drawn across pins
          // of the same `kind`, so this reports which shapes have enough
          // comparable samples to gate on rather than one global boolean.
          median_available_by_kind: Object.fromEntries(
            [...new Set(rows.map((r) => r.kind))].map((kind) => [
              kind,
              rows.filter((r) => r.kind === kind).length >= TELEMETRY_MIN_SAMPLES,
            ]),
          ),
          rows,
          bundle_issues: bundle.issues,
        },
        null,
        2,
      ),
    );
    return bundle.issues.length > 0 ? 1 : 0;
  }

  if (args[0] === "--check" && args[1]) {
    return runCheck(args[1]);
  }
  if (args[0] === "--check-patterns") {
    return runCheckPatterns();
  }
  console.error(
    "usage: okf_migrate.mjs (--inventory <spec-path> | --inventory-pin <area> | --derive <pin-json> | --verify-pins | --fidelity <area> | --telemetry | --check <area> | --check-patterns)",
  );
  return 1;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  process.exitCode = await main();
}
