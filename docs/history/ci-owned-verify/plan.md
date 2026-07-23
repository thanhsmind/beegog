# ci-owned-verify — plan (frozen at Gate 2)

Mode: standard. Five cells, executed serially (shared-file axes: cov-4/cov-5
share manifest + template twins; sequencing at dispatch per the 2026-07-21
critical pattern). Every cell verify is scoped (verify-scoping D2 discipline);
no cell runs the full suite — the branch's full proof lands in CI after merge.

## Cells

- **cov-1** — `scripts/impact_registry.mjs` (+ committed
  `scripts/impact-registry.json`, + `scripts/test_impact_registry.mjs`).
  Derivation per CONTEXT D3: static ESM closure BFS + pathToFileURL dynamic
  imports + spawn argv literals; bee.mjs spawners inherit the CLI closure.
  Verbs: `--write`, `--check` (regen+byte-compare), `--query <file...>`
  (newline-separated suite paths out). Deps: none.
- **cov-2** — run_verify `--impacted <f,...>` / `--impacted-from-git`
  (CONTEXT D4): registry-backed exact-suite selection reusing the --only
  pipeline, IMPACTED banner, unmapped-file listing, zero-impacted loud pass;
  registry staleness → in-memory rebuild + warning. Test:
  `scripts/test_run_verify_impacted.mjs`. Deps: cov-1.
- **cov-3** — CI auto-issue (CONTEXT D2): `scripts/ci_verify_issue.mjs`
  (pure decision core: shouldCreate/shouldComment/title/body; `gh` exec
  injected) + ci.yml failure step + `permissions: issues: write` +
  registry `--check` step. Test: `scripts/test_ci_verify_issue.mjs`.
  Deps: none (parallel-safe, but run serially anyway).
- **cov-4** — machinery rewiring (CONTEXT D5): worktree merge prefers
  commands.test; template + vendored bee.mjs twins; `.bee/config.json`
  commands.test → `node scripts/run_verify.mjs --impacted-from-git`;
  worktree-cli test updated. Manifest + ledger regen. Deps: cov-2.
- **cov-5** — doctrine migration (CONTEXT D1+D6): AGENTS.block.md item 16 +
  root AGENTS.md, bee-hive SKILL.md baseline paragraph, inject.mjs preamble
  twins (+ its test assertions), bee-planning/bee-executing/Verify Ladder/
  knowledge R4 rewrites, mirror re-render, manifest regen. Deps: cov-4.

## Validation

Plan-checked by one review-tier pass over CONTEXT.md + this plan + the cell
JSONs before Gate 3 work starts (standard-lane plan-checker; findings fixed
or logged before swarming).

## Out of scope

- windows.yml/canary.yml issue automation (ci.yml only).
- Any COMMAND_KEYS/schema change.
- Retiring `--only` (stays; `--impacted` builds on it).
