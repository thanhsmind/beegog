---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
feature: codex-harness-hardening-1d
context_source: docs/history/codex-harness-hardening-1d/CONTEXT.md
decisions: D1-D4 (CONTEXT); ce4eee19, b5341fe7, 21be04f7 (design), da61a5c1 (Gate 1)
---

# Slice 1d — SRC source-tree classifier (formalize + surface)

Ship SRC-01..06 as one pure, shared, tested classifier that names the running launcher's source
identity, consumed by both `bee status` (a report-only `source` field) and onboarding's report
(DIST-04). WRAP not replace — onboarding's `identityOk`/`selfOnboard` DECISION flow is unchanged; the
classifier corroborates and names it. Last locked piece of the feature (backlog P37).

## Mode gate (mechanical)

Flags: **public-contracts** (status gains a `source` field) · **multi-domain** (classifier module +
status + onboard report). = 2 flags. NOT existing-covered-behavior (onboarding's decisions are
unchanged — purely additive) and NOT hard-gate (no source-resolution DECISION changes; SRC-04
fail-closed is already enforced by 1b's preflight, which stays). Cross-platform handled by reusing the
same `path`/`realpathSync` primitives onboard already uses safely. → **standard.** (If a later slice
made the classifier DRIVE onboarding refusals, that would be its own high-risk slice; explicitly out.)

## Discovery (L1 — grounded in the real tree)

Launcher path structure (`onboard_bee.mjs:48-53`): `HIVE_DIR=<pkg>/<skillsdir>/bee-hive`,
`sourceRoot=dirname(HIVE_DIR)`, `PLUGIN_ROOT=dirname(dirname(HIVE_DIR))`. Markers per kind:
- **project_projection** — `basename(PLUGIN_ROOT)` is `.agents` or `.claude` (launcher under a host's
  `<repo>/.agents/skills/bee-hive` or `.claude/skills/bee-hive`).
- **legacy_global** — `realpath(sourceRoot) === realpath(os.homedir()/.claude/skills)` (the global root).
- **source_checkout** — `PLUGIN_ROOT` has `.claude-plugin/plugin.json` AND `.git` (a dev working
  checkout; confirmed: beegog root has `.git` + `.claude-plugin` + `.codex-plugin` + `skills/`).
- **plugin_package** — `PLUGIN_ROOT` has `.claude-plugin/plugin.json` but NO `.git` (a distributed
  manifested snapshot). SRC-03: may source the same repo's runtime+projection, NEVER global/plugin targets.
- **unknown** — no readable manifest / none of the above / ambiguous → fail closed (SRC-04).

The `identityOk` realpath anchor (`:877-884`) and `selfOnboard` (`:~900`) already implement SRC-02/05
implicitly; the classifier makes the SRC-01 taxonomy explicit and adds SRC-03/06 naming.

## Approach

### 1d-1 — the pure classifier module
New `templates/lib/source-identity.mjs` (+ byte-mirror `.bee/bin/lib/source-identity.mjs`):
`classifySource({ hiveDir, homeDir })` → `{ kind, root, markers }`, `kind` ∈ the 5 values. Pure: only
read probes (`existsSync`, `realpathSync`, `readFileSync` of plugin.json) it derives from the launcher
dir — no mutation. Order: project_projection (path shape) → legacy_global (realpath == global root) →
source_checkout (plugin.json + .git) → plugin_package (plugin.json, no .git) → unknown. Unit tests for
ALL 5 kinds incl. negative/unknown (a sentinel that MUST classify unknown, per TEST-01).

### 1d-2 — surface + share (DIST-04)
`bee.mjs buildStatus` (:223) adds a report-only `source: { kind, root }` field via the shared
classifier (+ mirror). `onboard_bee.mjs` calls the same `classifySource` and includes the kind in its
report (shared detector, DIST-04) — its `identityOk`/`selfOnboard` decision flow UNCHANGED. Status test
asserts each kind renders; onboard report carries the kind. deps: 1d-1.

### Rejected
- Classifier DRIVES onboarding source-resolution decisions (replacing `identityOk`) — deferred: that is
  a hard-gate change to validated behavior; 1d is formalize + surface only.

## Risk map

| Component | Risk | Proof (validating) |
|---|---|---|
| classifier detection (5 kinds) | MED | each kind classified correctly on fixture trees; source_checkout vs plugin_package (.git) distinguished; unknown fails closed (negative cases) |
| purity | LOW | classifier performs zero mutation (only read probes); testable without spawning onboard |
| status `source` field | LOW | additive; existing status fields byte-unchanged; each kind renders |
| onboard shared-detector wire | MED | onboard's decision flow unchanged (identityOk refusals identical before/after); report gains the kind |
| mirror | LOW | source-identity.mjs byte-identical templates/lib ↔ .bee/bin/lib; bee.mjs mirror intact |

## Test matrix (standard depth)
- All 5 kinds: source_checkout (.git+plugin.json), project_projection (.agents & .claude parents),
  plugin_package (plugin.json no .git), legacy_global (global root realpath), unknown (no manifest).
- Sentinel: a tree that MUST classify `unknown` (fail-open-can't-read-as-a-real-kind, TEST-01).
- Purity: fixture tree byte-hash unchanged after classifySource.
- Status: `source.kind` present and correct for the running launcher; other fields unchanged.
- Onboard: report includes the kind; identityOk refusal behavior identical before/after (no regression).
- Cross-platform: realpath/basename detection; POSIX asserts, Windows asserts the invocation contract.

## Cells (current slice)
- **codex-harness-hardening-1d-1** — pure `classifySource` module (templates/lib + mirror) + 5-kind unit
  tests. behavior_change (new observable classification surface).
- **codex-harness-hardening-1d-2** — surface `source` in `bee status` + share the detector with onboard
  report (DIST-04); status test. behavior_change. deps: 1d-1.
