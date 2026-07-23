# ci-owned-verify — CONTEXT (locked decisions)

User request (2026-07-23, verbatim intent): the full suite keeps growing, so every
full run gets slower; the session baseline and subagent runs multiply that cost.
Never run test-all in the working loop. CI owns test-all and auto-files an issue
when red. During work, only level-1 tests (directly related to the changed
function/file) run, resolved through a stored relatedness registry; the harness
gets the same registry for its own connection lookups.

## Locked decisions

- **D1 — no local full runs; baseline gate retired.** The dev loop never runs
  the full suite locally — including the session-baseline run before the first
  claim (explicitly requested twice). Its replacement: a cheap CI-status check
  (latest run on the base branch via `gh`, plus any open `verify-red` issue);
  red ⇒ surfaced + fix-first cell. "Never build on red" survives; the 60–90 s
  local proof does not. All four prose copies migrate (AGENTS.block.md item 16
  + merged root AGENTS.md, bee-hive SKILL.md, inject.mjs preamble).
- **D2 — CI owns test-all and auto-files issues.** `.github/workflows/ci.yml`
  keeps running the full verify (via `commands.verify`, unchanged string). On
  failure it runs `scripts/ci_verify_issue.mjs`: create a `verify-red` issue
  carrying the failed-suite tail, deduped — an open `verify-red` issue for the
  same workflow gets a comment, never a duplicate. Needs `permissions:
  issues: write` and `GITHUB_TOKEN`; pure decision logic (title, dedupe,
  body) unit-tested, `gh`/network calls injected.
- **D3 — impact registry, derived never hand-authored.**
  `scripts/impact_registry.mjs` derives suite → files closures from static
  relative ESM imports (BFS) PLUS the two evasion patterns measured today:
  `import(pathToFileURL(...))` string args and spawn/exec argv literals (29
  suites spawn `bee.mjs`; they inherit the CLI's import closure). Inverted to
  file → suites, written as committed `scripts/impact-registry.json`
  (`--write`), freshness-checked (`--check`, regen + byte-compare, runs in
  full verify so CI guards drift), queryable (`--query <file...>`) — the
  harness-facing connection registry: cell verify commands are authored from
  its answers.
- **D4 — run_verify gains `--impacted <files>` and `--impacted-from-git`.**
  Changed files map through the registry to exact suites (a changed suite
  selects itself); selection reuses the `--only` machinery downstream. Loud
  `IMPACTED RUN` banner; unmapped changed files are listed, never silent;
  zero impacted suites = loud pass ("full verify delegated to CI"), the
  user's chosen tradeoff. `--impacted-from-git` = dirty tree + commits since
  merge-base with main. Unconditional `SUITES` export and discovery stay
  intact (test_verify_manifest floor/membership untouched).
- **D5 — command rewiring without schema change.** `commands.verify` stays
  the full run (`node scripts/run_verify.mjs` — CI consumes it verbatim via
  verify_all.mjs, and test_verify_manifest.mjs:337 asserts the substring).
  `commands.test` becomes the dev-loop command:
  `node scripts/run_verify.mjs --impacted-from-git`. Worktree merge
  (bee.mjs handleWorktreeMerge, template + vendored twin) prefers
  `commands.test` over `commands.verify` as its semantic-conflict gate —
  impacted over the merge diff; the full pass lands in CI on push. No new
  COMMAND_KEYS entry (avoids the state.mjs/onboard_bee.mjs duplicate-array
  parity trap).
- **D6 — doctrine reconciliation, all surfaces at once.** The "three moments"
  rule (verify-scoping D2, yesterday) and the older four-milestone Verify
  Ladder (routing-and-contracts.md:242, decision e54878b1) are BOTH replaced
  by: dev loop = registry-scoped only; full suite = CI-owned; local full runs
  are never a workflow obligation. Updated together: bee-planning:122,
  bee-executing:67 (its four-site phrasing included), knowledge R4
  (verify-pipeline concept), Verify Ladder section, AGENTS surfaces, preamble
  renderer — a migration is not done until its instruction layer is
  (critical pattern 2026-07-22).

## Constraints (measured)

- test_verify_manifest.mjs:337-370 — commands.verify must contain
  "run_verify.mjs"; SUITES export floor 65 + mandatory membership must survive.
- state.mjs:99 COMMAND_KEYS silently drops unknown commands keys; duplicate
  array in onboard_bee.mjs with byte-parity test — D5 avoids touching it.
- .bee/bin/lib/inject.mjs and bee.mjs are manifest-hashed AND template-twinned
  (skills/bee-hive/templates/lib/…, test_lib_mirror) — every edit lands in both
  twins + manifest regen + ledger parity.
- Skill/AGENTS prose edits re-render 4 mirror roots + manifest.
