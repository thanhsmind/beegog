# Architecture Review — codex-runtime-parity (088fcd8..HEAD)

Scope: boundaries, coupling, maintainability. Read-only. Verified against code
in `hooks/adapter.mjs`, `hooks/catalog.mjs`, `hooks/test_hook_contracts.mjs`,
`skills/bee-hive/scripts/onboard_bee.mjs`, `skills/bee-hive/scripts/test_onboard_bee.mjs`,
`.bee/bin/lib/state.mjs`, `.bee/bin/bee_state.mjs`, against CONTEXT.md / plan.md /
approach.md.

**Verdict: the four focus areas are largely on-approach and well-guarded. One
real latent-coupling gap (P2) plus three advisory drift/duplication smells.**

---

## Q1 — hooks/adapter.mjs: one shared implementation, clean source identity

**PASS — strength, no finding.** All seven wrappers (`bee-session-init`,
`bee-prompt-context`, `bee-write-guard`, `bee-state-sync`, `bee-chain-nudge`,
`bee-session-close`, `bee-model-guard`) import `./adapter.mjs` exactly once and
contain zero direct `process.stdin` / `findRepoRoot` / `JSON.parse(stdin)`
logic — verified by grep across `hooks/bee-*.mjs`. There is no per-runtime fork:
Codex vs Claude differences live only in catalog projection output, never in a
forked wrapper. Source identity (`plugin|repo`) is threaded cleanly, not
smuggled: it is parsed from `argv` via `parseSourceIdentity()`
(`hooks/adapter.mjs:63`), returned as `ctx.source` from `readHookContext()`
(`adapter.mjs:223`), and passed explicitly into `logCrash`/`logCoverageGap`
(e.g. `bee-write-guard.mjs:171,189`; `bee-chain-nudge.mjs:107`). No `process.env`
or `globalThis` carries source identity. (The one `process.env.BEE_AGENT_NAME`
at `bee-write-guard.mjs:75` is pre-existing reservation-owner identity, unrelated
to runtime source.)

---

## Q2 — hooks/catalog.mjs: single source of truth + ALLOWED_DIFFERENCES shape

**Mostly PASS. ALLOWED_DIFFERENCES is structured/machine-checkable, not prose.
Two residual smells below (F2, F3).**

The two plugin projections are genuinely rendered from one catalog and guarded
byte-for-byte: `renderProjectionText("claude")` must equal `hooks/claude-hooks.json`
and `renderProjectionText("codex")` must equal `hooks/hooks.json`
(`test_hook_contracts.mjs:517-538`). Any hand-edit to either checked-in
projection is caught the moment the drift test runs. `ALLOWED_DIFFERENCES`
(`catalog.mjs:169`) is keyed on structured fields `{id, event, matcher}`; the
`description` is annotation only and is never used for matching. Both the
contracts drift test (`test_hook_contracts.mjs:546-566`) and the onboard 9b2 test
(`test_onboard_bee.mjs` new block) verify (a) each declared difference is really
present-in-claude / absent-in-codex, and (b) after removing declared differences
the two projections are byte-equal — so an *undeclared* difference fails, and a
*stale* declaration fails. This is machine-checkable, good.

No path lets a plugin projection be hand-edited undetected **while the test
runs.** The only residual: enforcement depends on the test being executed (no
in-repo pre-commit binds it), which is true of every test here — not a
catalog-specific hole.

### F2 (P3, advisory) — ALLOWED_DIFFERENCES key is (event, matcher) only

- **Summary:** A difference can only be expressed as "this event+matcher group is
  Claude-only." It cannot express "same matcher, different `hooks[]` contents,"
  and matcher-less events (SubagentStop/Stop/UserPromptSubmit render `matcher`
  undefined→absent) collapse to a single `(event, null)` key.
- **Today-behavior:** Safe and conservative — a same-matcher/different-hooks
  divergence would always be flagged as drift (cannot be whitelisted), and no
  two allowed differences currently share an `(event, matcher)`.
- **Failure scenario:** A future need to keep, say, a *different Stop hook set*
  per runtime cannot be declared; the author would be pushed to either fork a
  wrapper (violating Q1's shared-impl invariant) or weaken the drift test.
- **Location:** `hooks/catalog.mjs:169-179`; matching at
  `test_hook_contracts.mjs:546-566`.
- **Smallest fix:** None now. When a non-matcher difference first appears, extend
  the key to include a group discriminator (e.g. hooks-signature) rather than
  loosening the test.

---

## Q3 — Cell-3 deviation: adapter.mjs added to HOOK_FILENAMES

**F1 (P2, autofix_class: manual) — the "helper must be vendored" invariant is
unguarded; the shape is ad-hoc and will silently break on the next helper.**

- **Summary:** Repo-fallback vendoring copies files listed in the flat
  `HOOK_FILENAMES` array (`onboard_bee.mjs:45-57`), consumed by `listPluginHooks()`
  (`:896`) which drives copy (`:1172`), hashing (`:1237`), and mirror
  (`:1372`). adapter.mjs was inserted into this list so the vendored wrappers'
  `import "./adapter.mjs"` resolves. That works today, but the invariant
  *"every non-builtin module a vendored wrapper imports must itself be in
  `HOOK_FILENAMES`"* is enforced by nothing.
- **Today-behavior:** Correct — adapter.mjs is in the list and is copied. But the
  test that asserts vendored hooks exist iterates a **hardcoded 7-wrapper list
  that excludes adapter.mjs** (`test_onboard_bee.mjs:400-411`), and **no test
  executes a vendored wrapper** to prove its imports resolve. Grep confirms
  `adapter` appears nowhere in `test_onboard_bee.mjs`.
- **Failure scenario:** A later cell adds a second helper (e.g.
  `hooks/guards.mjs` or reuses `hooks/catalog.mjs` from a wrapper) and forgets to
  add it to `HOOK_FILENAMES`. Plugin installs are fine (siblings present in
  `hooks/`), but every repo-fallback (`--repo-hooks`) host gets wrappers that
  throw `ERR_MODULE_NOT_FOUND` at import — i.e. every bee lifecycle hook crashes
  in that host — and the entire onboard suite stays green. The fail-open adapter
  boundary can't help: the crash is *before* `readHookContext` runs.
- **Location:** `onboard_bee.mjs:45-57` (list), `:896`/`:1172` (copy);
  untested at `test_onboard_bee.mjs:400-411`.
- **Smallest credible fix:** Add one sandbox smoke row to `test_onboard_bee.mjs`
  that spawns each copied `.bee/bin/hooks/bee-*.mjs` with empty stdin and asserts
  no import-time crash (exit not from a module-resolution error). That guards the
  invariant regardless of list hygiene and is strictly better than a glob or a
  second manifest, because it proves the *actual* runtime property (imports
  resolve) rather than restating the file list. Secondary/optional: split
  `HOOK_FILENAMES` into `WRAPPER_FILENAMES` (wired) + `HELPER_FILENAMES` (copied
  only) so the helper-vs-wrapper distinction is explicit rather than relying on
  the `bee-` prefix coincidence that `isBeeHookEntry` (`onboard_bee.mjs:1016`)
  uses to avoid wiring adapter.mjs as a hook.

Note: the fit is *acceptable* (it reuses the existing vendoring list, and the
`bee-` prefix in `isBeeHookEntry` correctly prevents adapter.mjs from being wired
as an executable hook), but it is coupling-by-convention with no test, which is
exactly what will rot.

### F3 (P3, advisory) — renderRepoHookEntries() is a third hand-maintained catalog copy

- **Summary:** `catalog.mjs` is documented as "the single logical hook catalog,"
  but the repo-fallback projection is a separate hardcoded literal
  `renderRepoHookEntries()` (`onboard_bee.mjs:994-1014`) that re-encodes every
  event/matcher/filename by hand. The catalog is the source for the two *plugin*
  projections only; the repo projection is a fourth surface it does not feed.
- **Today-behavior:** Drift is caught — test 9b compares the applied repo settings
  triples against `hooks/claude-hooks.json` (`test_onboard_bee.mjs` 9b block), so
  a catalog change that isn't mirrored into `renderRepoHookEntries` fails a test.
- **Failure scenario:** Adding/removing a wired hook now requires editing three
  places in lockstep (`catalog.mjs`, `renderRepoHookEntries`, and — for
  copy/hash — `HOOK_FILENAMES`); miss one and you get a red test rather than a
  clean single edit. Maintenance cost, not a correctness hole.
- **Location:** `onboard_bee.mjs:994-1014` vs `hooks/catalog.mjs:47-125`.
- **Smallest fix:** Render `renderRepoHookEntries()` from
  `renderProjection("claude")` with command roots rewritten
  (`${CLAUDE_PLUGIN_ROOT}/hooks/` → `"$CLAUDE_PROJECT_DIR"/.bee/bin/hooks/`) and
  `statusMessage` dropped, making `catalog.mjs` the literal single source for all
  three projections. Defer if the command-root rewrite is judged riskier than the
  current test-guarded duplication.

---

## Q4 — startFeature layering (lib/state.mjs vs bee_state.mjs)

**PASS — clean split, composes/reuses existing gatekeepers; one advisory (F4).**

The CLI/business split is clean: `runStartFeature()` (`bee_state.mjs:380-390`)
only translates flags (`requireFlag`, default `phase="exploring"`) and calls
`startFeature()`; all preconditions and the single atomic write live in
`startFeature()` (`state.mjs:451-530`). Phase validation reuses the existing
`isKnownPhase` gatekeeper (`state.mjs:456`) rather than forking a phase list.
Reads happen before the one `writeState` (`:529`), so a refusal makes zero
mutations as claimed. Gate reset is atomic in the same write (`:526`).

It does **not** duplicate `set`/`gate` logic in a harmful way: the existing
`runSet`/`runGate` mutation bodies live in the CLI file (`bee_state.mjs:130-190`),
not in lib, so there is no reusable `setState()`/`applyGate()` business function
for `startFeature` to compose — it correctly follows the same
`readStateStrict → mutate → writeState` shape one layer lower (in lib), which is
if anything better-placed than `runSet`. The self-contained cell/reservation
reads are justified in-comment to avoid a `state.mjs ↔ cells.mjs` import cycle
(cells.mjs imports state.mjs), which is real.

### F4 (P3, advisory) — cell terminal-status vocabulary re-encoded in state.mjs

- **Summary:** `startFeature` hardcodes "nonterminal = open|claimed|blocked"
  (`state.mjs:518-523`) and "claimed" (`:512`) directly, duplicating the status
  vocabulary that lives as scattered string literals in `lib/cells.mjs` (open,
  claimed, capped, dropped, blocked). There is no shared status enum.
- **Today-behavior:** Correct for the current five statuses; covered by the 15
  RED-first rows.
- **Failure scenario:** If `cells.mjs` later adds a status (e.g. `paused`),
  `startFeature`'s precondition silently won't count it as nonterminal, and a new
  feature could start over a paused prior-feature cell — the exact "inherit/step
  over active work" hazard this verb exists to prevent (approach.md §4, risk map
  "Workflow state start/handoff").
- **Location:** `state.mjs:512,518-523`; vocabulary origin `lib/cells.mjs`
  (statuses at `:158,169,212-213,276,296,307`).
- **Smallest fix:** Export a `TERMINAL_CELL_STATUSES` / `NONTERMINAL_CELL_STATUSES`
  constant from a module both can import without a cycle (e.g. a tiny
  `lib/cell-status.mjs`, or from state.mjs consumed by cells.mjs), and derive the
  filter from it. Defer if no new status is planned.

---

## Cross-cutting note (not scored — pre-existing pattern)

`.bee/bin/lib/state.mjs` and `skills/bee-hive/templates/lib/state.mjs` (and the
two `bee_state.mjs`) are byte-identical twins (verified via `diff -q`). I found no
automated test asserting this dogfood-copy ↔ template parity for state.mjs/
bee_state.mjs; it is maintained by discipline ("vendored twins synced" in the
commit msg). Pre-existing to this feature, flagged only for awareness.

---

## Summary

Findings: 4 (P1: 0 · P2: 1 · P3: 3)

- **F1 P2 / manual** — repo-fallback adapter.mjs vendoring is untested; the
  "helper must be in HOOK_FILENAMES" invariant will silently break the next
  helper. Fix: vendored-wrapper import smoke test.
- **F2 P3 / advisory** — ALLOWED_DIFFERENCES key is (event, matcher) only.
- **F3 P3 / advisory** — renderRepoHookEntries() duplicates catalog.mjs (drift
  test-guarded, not catalog-sourced).
- **F4 P3 / advisory** — cell terminal-status vocabulary re-encoded in
  startFeature, no shared enum.

Q1 (shared adapter) and Q4 (startFeature split) are clean and on-approach.
