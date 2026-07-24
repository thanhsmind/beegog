# cli-ergonomics — plan (frozen at Gate 2)

Decisions: 8ef2bae6 (D1 batch validation, D2 dry-run + whole-array, D3 teaching).
Evidence base: gather digest (validate-args.mjs:61-92, cells.mjs:1283-1305,
command-registry.mjs DB3 comment :1024-1031, bee.mjs requireFlag :239-245,
main() :5484-5644, hook checkCliShape bee-write-guard.mjs:563-592) + orchestrator
spot-checks confirming the anchors and the DB3 constraint.

**Validation catch that shaped this plan:** `required: []` on `backlog.add` and
the `state.*` entries is deliberate (DB3): legacy verbs own their checks and emit
refusals on STDERR (text pinned by test_lib.mjs), while `validate()` emits
structured errors. So D1 lands at BOTH layers without moving any error across
channels: the schema layer learns to collect every problem; the handler layer
gets a batch helper for legacy verbs. Nothing migrates from stderr to stdout.

## Slice 1 (serial: shared files + shared regen targets — the D3(b) criterion)

**ce-1 — batch flag validation (machinery).**
- `lib/validate-args.mjs`: `validate()` collects ALL problems (required loop no
  longer returns at first miss; type loop likewise; NEW enum support when a
  property carries `enum`). Return shape: `error` keeps field/reason/command =
  FIRST problem (test_bee_cli.mjs:325 pin `'required, missing'` untouched),
  plus `problems: [{field, reason}...]` listing every one.
- `bee.mjs` main(): on validate failure, the emitted message lists every
  problem + the entry's first example (`Example: <examples[0]>`).
- `hooks/bee-write-guard.mjs` (source under hooks/): checkCliShape renders all
  `problems` when present (joined), keeping the existing substrings
  (`bee CLI-shape guard`, `field: <first>`) intact for the pinned tests.
- `bee.mjs` NEW helper `requireFlags(flags, spec, example)` (spec entries
  `{name, enum?}`): collects every missing/invalid flag, throws ONE legacy-style
  stderr message + `Example:` line. Convert the audited ladder offenders:
  `backlog.add` (type/severity/layer/title/note + enums), `state.scribing-run`
  (feature/areas/next-action), `state.gate` (name/approved). Other handlers
  adopt opportunistically later — no mass migration in this cell.
- Tests (red-first, scoped): validate() problems[] completeness; one-shot
  backlog add refusal naming all four flags + Example; enum message names
  P1/P2/P3; test_lib.mjs legacy-pin updates for the converted verbs (same
  channel, new combined text).

**ce-2 — cells add whole-array + --dry-run (machinery, deps: ce-1).**
- `lib/cells.mjs` `addCells`: per-cell `validateNewCell` wrapped to AGGREGATE
  failures (id + every problem incl. regen obligations), duplicate-id and cycle
  checks folded into the same report; one combined refusal names every failing
  cell; all-or-nothing write unchanged.
- `bee.mjs` `handleCellsAdd` + registry `cells.add` entry: `--dry-run` boolean
  (worker-prune pattern, `{dry_run: true, cells:[{id, ok, problems}]}`, exit 0
  when clean, nothing persisted). `--dry-run` stays a hard error on verbs that
  don't declare it (bee.mjs:1783-1788 discipline).
- Tests: batch with 2 bad cells → both named in one refusal, nothing written;
  dry-run on a clean batch → exit 0, no files; dry-run on a dirty batch →
  verdicts listed, no files.

**ce-3 — teaching (docs, deps: none, runs last for regen tidiness).**
- `bee-executing/SKILL.md` (~:67) + `references/worker-details.md`: scoped
  red-first — the red run executes ONLY the tests this cell adds/changes; the
  full verify chain runs once, at the end, before cap.
- `bee-swarming/SKILL.md` (:24) + `routing-and-contracts.md` (:275): the
  parallel criterion appended to the serial doctrine — serial stays the
  default; parallel only when every cell's file set INCLUDING regen targets
  (release manifest, onboarding ledger, plugin mirrors) is provably disjoint;
  any shared generated artifact forces serial; in doubt, serial.
- `AGENTS.block.md` item 7: schema-first habit sentence (recommended habit,
  not a mandatory step — the deferred-mandate wording stays).
- Regen: render_plugin → onboard --apply → manifest --write.

## Verify

- ce-1: test_bee_cli.mjs + test_lib.mjs + test_lib_mirror + manifest --check + ledger_parity --check
- ce-2: test_cells.mjs + test_cli_cells.mjs + test_lib_mirror + manifest --check + ledger_parity --check
- ce-3: test_misc.mjs (doc coverage) + manifest --check
