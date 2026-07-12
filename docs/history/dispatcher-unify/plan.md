# dispatcher-unify — plan

```yaml
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
```

## Request

Owner (2026-07-12): "gộp tất cả bộ script của bee như bee_cells vào 1 script bee để sau
bảo trì cho dễ" — every bee helper maintained in ONE place, `bee.mjs`.

## Scoping synthesis (locked, decision logged this session)

- **DB1 — full coverage:** the dispatcher's registry + handlers extend to all 9 groups:
  `status, cells, reservations, decisions` (phase 1) + `state, backlog, capture, reviews,
  feedback` (this feature). Closes the DA6 follow-up PBI.
- **DB2 — single implementation:** all 9 `bee_*.mjs` become thin shims that prepend their
  group name and call the exported `main()` of `bee.mjs`. Supersedes DA1's
  "helpers untouched" freeze on explicit owner request. Phase-1's duplicated
  handler/render glue for the 4 legacy groups is thereby collapsed too.
- **DB3 — observable contract frozen:** every helper's argv shape, stdout, stderr text
  (`Use:` lines, `Missing required flag`, FIX messages), and exit codes stay as pinned by
  the existing suites (test_lib 220 checks + test_bee_cli 106 checks + hook suites).
  **The suites are the parity net and are not weakened**; where the dispatcher's generic
  error layer differs from a pinned legacy text, the group's registry entry/handler must
  emit the legacy text.
- **DB4 — vendoring unchanged:** templates are the source; `.bee/bin` byte-identical
  (existing guard); onboarding globs pick up everything automatically.
- **DB5 — prose:** canonical form becomes `node .bee/bin/bee.mjs <group> <verb>` in the
  Helper CLI Quick Reference and bee.mjs usage header; old `bee_*.mjs` invocations keep
  working via shims, so no forced sweep of skills/hooks/hosts.

## Mechanism notes (validated against source this session)

- `bee.mjs` already exports `main(argv)` with an import-safe direct-run guard (bee.mjs:940-946)
  — the shim is `import { main } from './bee.mjs'; process.exitCode = main(['state', ...process.argv.slice(2)]);`.
- `resolveCommand` (bee.mjs:641) maps 2 leading tokens to `group.verb`; `bee_state.mjs worker add`
  needs 3 → extend resolution to longest-prefix match over registry names (e.g. `state.worker.add`).
- Helpers with no verb print a group `Use:` line and exit non-zero (pinned by tests) →
  each group gets a usage fallback when only the group token is given.
- The write-guard hook validates bash `bee_*.mjs`/`bee` calls against COMMAND_REGISTRY —
  adding the 5 groups strengthens the guard; hook contract tests must stay green.
- Phase-1 parity tests spawn both binaries and diff — shims make them same-code; they stay
  as regression guards on the shim path.
- DA5 bijection test derives helper verbs from runtime `Use:` contract lines — it must
  extend to 9 groups and keep passing against the shims.

Plan-checker corrections (validating pass, 2026-07-12):

- `FLAG_ALONE_BOOLEANS` (bee.mjs:629) must gain `dry-run` — under generic parseFlags,
  `worker prune --dry-run --json` would otherwise consume `--json` as the value of
  `--dry-run`. The set's "closed union" framing in its comment is updated too.
- reviews has BOTH the nested `candidate add` (3-token) AND a flat `candidates` verb
  (bee_reviews.mjs:186-207) — du-3 covers both; longest-prefix resolution must handle
  `reviews.candidate.add` alongside `state.worker.*`.
- Group-usage fallback is mandatory, not optional: the shim always supplies the group
  token, so the dispatcher's generic no-command path can never fire for helper calls —
  each group's no-verb/unknown-verb legacy `Use:` line (e.g. bee_state.mjs:424) is
  emitted byte-exact by a per-group fallback handler.
- **Write-guard hook gap (new scope, du-6):** hooks/bee-write-guard.mjs's own
  `resolveCliCommandName` (:155-178) is hardcoded to 2-token shapes; once 3-token
  commands exist it resolves `bee_state.mjs worker add ...` to the bogus name
  `state.worker` and fails open — silent loss of schema validation that no current test
  pins. The hook resolver must reuse/duplicate the longest-prefix rule and
  test_bee_write_guard_hook.mjs must pin a 3-token shape.
- Side effect accepted and documented: through the shims, every helper call now also
  writes `.bee/manifest-hash.json` (gitignored, DA4); no current test asserts its
  absence.

## Cells (one slice)

- **du-1** — mechanism + hardest group: longest-prefix command resolution, group-usage
  fallbacks, registry entries + handlers for all `state.*` verbs (set, gate, worker
  add/update/remove/clear/prune, scribing-run, start-feature), `bee_state.mjs` → shim.
- **du-2** — port `backlog.*` (add/counts/rank/badges) + `capture.*` (add/list/flush/count);
  shims. deps: du-1.
- **du-3** — port `reviews.*` (create/show/list/record/status + nested `candidate add` +
  flat `candidates`) + `feedback.*`; shims. deps: du-1, du-2.
- **du-4** — legacy 4 (`status/cells/reservations/decisions`) helpers → shims; delete their
  duplicated bodies; port the `Array.isArray → addCells` batch branch into
  `handleCellsAdd` (functional, cells-batch-add regression); bijection + parity + hook
  suites green. deps: du-1, du-3.
- **du-6** — write-guard hook longest-prefix resolution + pinned 3-token tests (closes the
  fail-open gap). deps: du-1; parallel-safe with du-2..du-4 (disjoint files).
- **du-5** — prose (quick-reference, bee.mjs usage header, stale command-registry.mjs
  header comment) + close-out full verify. deps: du-2, du-3, du-4, du-6.

du-2/3/4 are serialized (cell-reviewer finding): all three edit `bee.mjs`,
`command-registry.mjs`, and `test_bee_cli.mjs` — one file owner at a time, never
"spawn both and be careful".

## Verify (every cell)

`node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`
(plus the hook suites at du-4/du-5: test_bee_write_guard_hook.mjs)

## Test matrix (edge dimensions at standard depth)

- argv edges: no verb (Use: line), unknown verb (suggestion vs legacy text per DB3),
  nested verbs (worker add), `--flag=value` vs `--flag value`, boolean-alone flags,
  stdin payloads (add --stdin arrays from cells-batch-add stay working through shims).
- process edges: exit codes on every refusal path; stderr vs stdout separation
  (manifest drift only ever on stderr).
- state edges: corrupt state.json (readStateStrict paths), start-feature refusal ladder.
- cross-file edges: templates ↔ .bee/bin byte parity; registry ↔ runtime verb bijection;
  hook schema validation over the extended registry.

## Risks / smaller path

Smaller path considered: dispatcher passthrough to helper bodies moved into lib/cli/*.mjs
(zero error-text risk) — rejected: leaves two dispatch styles and keeps the registry
blind for 5 groups; the registry IS the maintainability surface (one schema, one guard,
one manifest). Cost if shape is wrong: suite pins every contract, so wrongness surfaces
as red tests during execution, not silent drift.
