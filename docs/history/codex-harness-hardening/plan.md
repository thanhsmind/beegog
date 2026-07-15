---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
feature: codex-harness-hardening
slice: 1b — The copy_lib downgrade fix (behavior change; flips the Slice 0 freeze green)
context_source: docs/history/codex-harness-hardening/SPEC.md
decisions: ed0b2920 (§15 locked), 49f032fe (verify self-guard), fe6593c0 (downgrade fix targets .bee/bin/lib copy path), 6427d703 (Slice 1a foundations laid: mirror guard + release-tuple guard now standing)
supersedes_slice: 1a (shipped in v1.0.0 — release manifest + release-tuple + lib-mirror guards; commits 81aa3a5, 1e21d26)
---

# Slice 1b — Downgrade preflight + shared source classifier + honest drift

The single behavior-changing fix of the codex-harness-hardening feature. Slice 1a laid the additive
foundations (release manifest, release-tuple guard, standing `templates/lib` ↔ `.bee/bin/lib` mirror
guard). 1b closes the actual defect the whole feature exists for: a **stale launcher silently
downgrades the runtime lib**, and status reads `drift:false` over the wreckage.

## Mode gate (mechanical)

Flags counted:
1. **audit/security** — silent-downgrade prevention is an integrity safety mechanism (HARD-GATE).
2. **existing-covered-behavior** — rewrites `onboard_bee.mjs` source resolution + the copy_lib apply path.
3. **public-contracts** — `bee status` drift shape + onboarding plan result shape (`blocked_downgrade`).
4. **cross-platform** — version compare + POSIX-mode-aware manifest reuse on Windows.
5. **multi-domain** — shared classifier module + onboarding preflight + `bee.mjs` status + mirror.

**5 flags including a hard-gate (audit/security) flag → high-risk.** Gate bypass level `full`/`total`
lifts even this floor (decision 0010 / user authorization dcf01d7b); at `normal` it would still stop.
Smaller modes rejected: this changes a safety mechanism across ≥3 modules and rewrites source
resolution — nowhere near tiny/small/standard. Full persona-panel validation required in bee-validating.

## Discovery (L1 — carried from Slice 1a plan, re-verified 2026-07-15)

Holes located exactly by the Slice 1a recon and re-confirmed against current code (anchors refreshed
in bee-validating before any write):

- **E-03 downgrade hole:** `computePlan()` step 3 pushes `copy_lib` items by **pure byte-diff** against
  the running launcher's own `templates/lib/`, **with no version gate**; apply `writeFileAtomic`s them
  unconditionally. `self_skip` gates only `computeSkillSyncTarget`, **not** `computePlan`. So a stale
  0.1.43 launcher silently downgrades `.bee/bin/lib/*.mjs`.
- **False-green (E-02) — mechanism confirmed by recon:** `bee.mjs:297` drift =
  `Boolean(onboardingRaw && onboardingRaw.bee_version !== BEE_VERSION)`. `BEE_VERSION` in `bee.mjs`
  is imported from `./lib/state.mjs` — i.e. the *runtime* `.bee/bin/lib` copy. After a copy_lib
  downgrade, onboard also rewrites `onboarding.json.bee_version` to the source (0.1.43) version, so
  **ledger == runtime-lib == 0.1.43 and drift reads `false`** — both sides move together. An honest
  drift check therefore cannot compare ledger vs runtime lib; it needs an authoritative reference —
  the Slice 1a **release manifest** (stored sha256+mode of the release-identity set) checked against
  the live `.bee/bin/lib` bytes (DIST-04, PROJ-08).
- **Version primitives already exist — in `onboard_bee.mjs` itself (recon correction):**
  `readVersionStrict` (`onboard_bee.mjs:310`), `compareVersions` (`:349`), and
  `computeSkillSyncTarget` (`:625`, emitting `blocked_downgrade` at `:734/:757` on the *skill-sync*
  path). They are **local to onboard_bee.mjs, not in `bee.mjs`** (plan.md prior notes misattributed
  them). The preflight reuses these in-file on the copy_lib path — no new comparator.
- **Slice 1a foundations now standing:** the `templates/lib` ↔ `.bee/bin/lib` byte-identity mirror guard
  and the release-tuple guard are in `commands.verify`. A shared module added to `templates/lib` is
  therefore mirror-protected the moment it lands.

## Approach

Chosen path — three deliverables, ordered so each de-risks the next:

### 1b-1 — Shared source classifier (pure module in `templates/lib/` + mirror)
A pure classifier returning one of `source_checkout` / `project_projection` / `plugin_package` /
`legacy_global` / `unknown` (SRC-01..06, DIST-04, D-04). No I/O guesswork by "nearest path"
(SRC-01); canonical marker wins for source (SRC-02); unknown fails closed *before* mutation (SRC-04);
self-skip only on realpath identity (SRC-05); legacy global is reported/migrated, never an implicit
source (SRC-06). Imported by BOTH `bee.mjs` status and `onboard_bee.mjs`. Mirror guard (1a) enforces
byte-identity to `.bee/bin/lib/` automatically.

### 1b-2 — Zero-mutation downgrade/unknown preflight on the copy_lib path
Gate `computePlan` step 3 with a version check reusing `compareVersions` (VER-01..06 + decision
fe6593c0): if the source numeric release is lower than the managed target `.bee/bin/lib` release, the
**entire apply stops before any write** (VER-02). Unknown/unreadable tree is never treated as fresh and
never force-passable (VER-03); genuine absence is a fresh install, not unknown (VER-04). `--force-downgrade`
is loud + traced and only for trusted source identity (VER-05) — deferred as opt-in unless trivially free.

### 1b-3 — Status drift via an authoritative reference
Rewrite `bee.mjs:297` drift so it no longer compares ledger-vs-runtime-lib (both move together under a
downgrade). Instead check the live `.bee/bin/lib` against the stored **Slice 1a release manifest**
(sha256+mode) — any hash/mode/file-set mismatch is drift, even at the same `bee_release` (PROJ-08); a
copy_lib content downgrade then reads `drift:true` (DIST-04). Status shape stays a stable public
contract — `drift` remains a boolean; an optional detail field may name the mismatch.

**Exit criterion (single, provable):** the frozen regression fixture `test_split_brain_regression.mjs`
(source projection 0.1.43 + runtime 0.1.44 + ledger `drift:false`, VER-06) flips from **exit 3 (frozen
red)** to **exit 0**: status reads red and apply is zero-mutation. On flip it JOINS `commands.verify`
(the 11th suite). Status and plan can no longer contradict about identity/drift.

### Rejected alternatives
- **Patch drift only, leave the copy_lib apply ungated** — rejected: status would tell the truth while
  the updater keeps silently downgrading. The apply path is the actual defect (VER-02).
- **New bespoke version comparator** — rejected: `compareVersions`/`readVersionStrict` exist and are
  already trusted by `computeSkillSyncTarget`; anti-reinvention (SRC/VER reuse the same primitives).
- **Hand-listed classifier file set / hardcoded lib inventory** — rejected: crit-pattern 20260714
  (hardcoded fixture lists rot silently under fail-open). Derive from `readdirSync`/import graph (TEST-03).

## Risk map

| Component | Risk | Proof needed (bee-validating) |
|---|---|---|
| Shared source classifier | HIGH | classifies each of the 5 identities correctly on real trees; unknown fails closed; self-skip only on realpath identity (negative cases proven) |
| Downgrade preflight (copy_lib) | HIGH | 0.1.43-source-over-0.1.44-target apply is zero-mutation (byte-identical target after); fresh-absence still installs; unknown never force-passes |
| Drift via shared detector | MED-HIGH | a copy_lib content downgrade reads `drift:true`; same-version byte drift still red (PROJ-08); status shape stays a stable public contract |
| Regression fixture flip | MED | `test_split_brain_regression.mjs` goes 3→0, runs in a fresh process (TEST-08), joins verify; full 11-suite chain green |
| Mirror/import wiring | MED | classifier byte-identical across templates/lib ↔ .bee/bin/lib; both importers resolve it (mirror guard green) |

## Test matrix (edge dimensions, high-risk depth)

- **Version boundaries:** source < target (refuse), source == target byte-identical (skip), source ==
  target with content drift (red, PROJ-08), source > target (upgrade proceeds), absent target (fresh).
- **Unknown/corrupt:** unreadable tree, unparseable version file, partial tree → fail closed, never force.
- **Identity:** each of source_checkout / project_projection / plugin_package / legacy_global / unknown.
- **Zero-mutation proof:** target dir byte-hash unchanged after a refused apply (TEST-02 side-effect assert).
- **Cross-platform:** POSIX mode asserted on POSIX; Windows asserts invocation/version contract (TEST-10).
- **Fresh process:** regression fixture runs in a new node process after projection (TEST-08).
- **Sentinel:** at least one case that MUST refuse, so a fail-open path can't read as universal green (TEST-01).

## Open questions for bee-validating

1. Does `--force-downgrade` (VER-05) ship in 1b or defer to a later slice? Default: implement the refuse
   path (VER-02/03) fully; ship `--force-downgrade` only if it falls out cheaply, else file to backlog.
2. Classifier home filename in `templates/lib/` and whether drift-detection helpers live in the same
   module or a sibling — confirm against the existing import pattern in bee-validating.
3. Exact anchors (computePlan step 3, the apply site, self_skip, drift) — refresh against current code
   before writing, per crit-pattern 20260714 corollary (validate against the callers, not the diagram).

## Cells (current slice = 1b)

Gate 2 approved (audit decision a728276e, total autopilot). Anchors refreshed by recon 2026-07-15.
**One** behavior-changing cell with one provable exit. Validating feasibility check surfaced that no
authoritative version reference ships into a host's `.bee/bin/` beyond `lib/state.mjs` itself (the
release manifest is repo-only; `.bee/manifest-hash.json` tracks the command registry, not lib bytes) —
so honest-drift (E-02) has an unresolved authoritative-reference design and is deferred to 1c. Closing
the preflight is the primary fix: a refused downgrade leaves `.bee/bin/lib` intact, so drift correctly
stays false because no downgrade happened. Drift-honesty is defense-in-depth for *other* downgrade
paths (decision 513f8ad4 amended).

- **codex-harness-hardening-1b-1 — downgrade preflight on the copy_lib path + flip the frozen
  regression green** (binding exit, VER-06). Gate `computePlan` step 3 (`onboard_bee.mjs:1645-1651`)
  and the apply site (`:1977-1981`) with a version compare reusing in-file
  `readVersionStrict`/`compareVersions`: read source `templates/lib` release vs target `.bee/bin/lib`
  release; if source < target, emit `blocked_downgrade` (the shape already produced at `:734/:757`)
  and push NO copy_lib items (VER-02). Unknown/unreadable target → fail closed, never fresh
  (VER-03/04); genuine absence stays a fresh install (VER-04). Apply is zero-mutation on refuse. This
  flips `test_split_brain_regression.mjs` from exit 3 → exit 0 (blocked_downgrade for plan AND apply,
  zero-mutation hashTree); once green, append it to `commands.verify` in `.bee/config.json` (11th
  suite — its header prohibition against joining while red is then satisfied). onboard_bee lives only
  under `skills/` (no `.bee/bin` runtime copy), so no mirror step for the source edit itself.

Note: the full SRC-01..06 shared source classifier (source_checkout/project_projection/plugin_package/
legacy_global/unknown) is **NOT bundled into 1b** — the downgrade refuse is a version compare, and
honest drift uses the release manifest; neither needs the tree-identity classifier to pass VER-06.
The classifier (SRC-01..06 / DIST-04 identity half) is carried to a follow-up slice **1c** so 1b stays
one provable behavior change (bee-validating confirms this split honors every locked SRC/DIST rule 1b
actually touches). Recorded as a backlog row.
