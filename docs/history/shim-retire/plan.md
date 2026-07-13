---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# shim-retire — `bee.mjs <group> <verb>` becomes the only shipped CLI

## Scoping synthesis (surface-scope-earlier; owner directive 2026-07-14)

Owner: "Mình đã gộp script vào 1 script bee nhưng sao vẫn dùng script rời rạc, nên
chuyển qua và bỏ đi script thừa." The dispatcher-unify feature (decision 7c52b6a3)
made `bee.mjs` the single implementation but deliberately kept the 9 `bee_*.mjs`
shims as a compatibility net and left the shim names canonical in AGENTS.md steps
1–6 / skills prose. Result: agents keep invoking shims because the docs tell them
to. This feature retires the shims for real.

Locked decisions (logged as one decisions entry, feature shim-retire):

- **D1** `node .bee/bin/bee.mjs <group> <verb>` is the sole canonical *and* sole
  shipped CLI. The 9 shims (`bee_status|cells|reservations|decisions|state|backlog|capture|reviews|feedback.mjs`)
  are deleted from `skills/bee-hive/templates/` and (via onboarding sync) from
  host `.bee/bin/`. Supersedes the compat-net clause of 7c52b6a3 — owner-directed.
- **D2** Onboarding gains an explicit retirement pass: a `RETIRED_HELPERS`
  constant (the 9 names); plan item `remove_helper` whenever one still exists in
  the host's `.bee/bin/`; applied on `--apply`. Precedent: the stale-advisor-key
  notice. Today `buildPlan` only *copies* missing/drifted helpers
  (onboard_bee.mjs:1435-1441) — nothing ever deletes a vendored file the
  templates dropped, so without D2 every host keeps dead shims forever.
- **D3** `bee-write-guard.mjs` keeps `LEGACY_HELPER_RE` (line 130) as a
  transition guard — hosts mid-upgrade still have old vendored bins whose
  sessions may invoke shim names; the guard must still resolve those shapes.
  Removal is future grooming debt, filed in backlog.
- **D4** Sweep scope = living surfaces only: `AGENTS.md`,
  `skills/bee-hive/templates/AGENTS.block.md`, all `skills/**/SKILL.md` +
  `references/`, `templates/tests/*`, hook comments/tests, `scripts/install.sh`,
  `scripts/install.ps1`, `README.md`, `INSTALL.md`, `docs/specs/*`,
  `docs/0*-*.md`. Historical records untouched: `docs/history/**`,
  `docs/decisions/**`, `.bee/*.jsonl`, `.bee/cells/**`.
- **D5** The command-registry `helper:` metadata field is removed together with
  its manifest-strip code and the `entry.helper` test assertion
  (test_bee_cli.mjs:155). The D5 shim↔dispatcher parity tests are deleted with
  the shims; the DA5 registry↔runtime verb-bijection guard is KEPT and
  re-pointed at `bee.mjs <group>` runtime output (it guards real drift).

## Mode gate

Flags counted: **public contracts** (the CLI surface is installed into host
repos), **existing covered behavior** (tests pin the shim CLI entrypoints and
parity), **cross-platform** (install.ps1) → 3 flags → **standard**. No hard-gate
flag. Smaller modes are dishonest: the sweep spans installer, onboarding
behavior change, test rewrites, and the AGENTS block shipped to every host.

## Discovery (L1 — verified inline)

- No hook wiring (`hooks/hooks.json`, `claude-hooks.json`, `.codex/hooks.json`),
  session-init hook, or statusline script spawns a shim — deletion cannot break
  session bootstrap.
- `bee.mjs` covers all 9 groups; `--stdin`/`--evidence-stdin` piping already
  preferred (command-registry.mjs:197) — no behavior gap opens when shims go.
- Onboarding `listTemplateHelpers()` is name-agnostic (readdir), so copies stop
  automatically; only *removal* is missing (D2).
- Genuine code dependencies on shim filenames: install.sh:254 / install.ps1:197
  (verification step), write-guard `LEGACY_HELPER_RE`, and the test suites that
  spawn shim files (test_bee_cli.mjs:43-51, test_lib.mjs:333/425/1674/3312/3332,
  test_bee_write_guard_hook.mjs).

## Approach

Ship the runtime change first (delete shims + rewrite the pinned tests in the
same cell — they are one observable contract), then onboarding removal +
installer, then the prose sweep (AGENTS block → skills → living docs), and close
by self-onboarding this repo so `.bee/bin`, `AGENTS.md`, and the global skill
set all reflect the new surface. Risk map:

| Component | Risk | Proof |
|---|---|---|
| deleting shims + test rewrite | MEDIUM | full test_lib + test_bee_cli green after |
| onboarding remove_helper | MEDIUM | test_onboard_bee green incl. new removal case |
| write-guard transition | LOW | existing hook tests keep legacy-shape cases |
| prose sweep | LOW | grep-zero verify per surface |

## Slice (single slice, 6 cells)

sr-1 runtime retirement → sr-2 onboarding+installer → sr-3 hooks →
sr-4 AGENTS/README → sr-5 skills prose → sr-6 living docs + self-onboard + final
verify. sr-4..sr-6 depend only on sr-1 (canonical form fixed); sr-2/sr-3 after
sr-1.

## Test matrix (edge dimensions, lane-scaled)

- **removal idempotence:** re-running onboarding after shims are gone plans no
  `remove_helper` items.
- **fresh onboard:** a brand-new host gets no shims and a working `bee.mjs`.
- **stale host:** a host with old shims gets them deleted on `--apply`.
- **legacy invocation:** write-guard still resolves `bee_cells.mjs cap ...`
  command shapes (transition), and `bee.mjs cells cap ...` shapes.
- **cross-platform:** install.ps1 verification path swapped and still ASCII-only
  (D5 of installer-hardening).
- **manifest:** `bee.mjs --help --json` manifest carries no `helper` field and
  hash test updated.
