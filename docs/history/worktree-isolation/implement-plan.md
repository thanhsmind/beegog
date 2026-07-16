---
artifact_contract: bee-implement-plan/v1
feature: worktree-isolation
lane: high-risk
status: Revision pending delta re-review and executable baseline
updated: 2026-07-15
sources:
  - CONTEXT.md
  - approach.md
  - plan.md
  - .bee/cells/worktree-isolation-1.json
  - .bee/cells/worktree-isolation-2.json
  - .bee/cells/worktree-isolation-3.json
  - .bee/cells/worktree-isolation-4.json
  - .bee/state.json
decisions: [D1, D2, D3, D4, 42a01cfd, 5aa8946d, 5de1fd36, 649d91b3, 5f05b038, 23d67e0b, 58c56bb6, 33b6ac73, 70e2dbeb, 8cc1bde1-b631-4fe9-a110-931d76d40a69, b24a2efc-f102-417d-87c5-c871733aec2a]
---

# Implementation Plan: Worktree Isolation

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the validating report (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.
> The planning documents and prepared cell files contain the accepted review
> repairs. Delta re-review and an executable fresh baseline remain pending.

## 1. Goal

Allow qualifying Claude Code swarm waves to dispatch workers into independent Git
worktrees without creating a second coordination store, bypassing reservation
enforcement, or counting work before it is integrated and verified in the main
checkout.

**Success looks like**

- Worktree dispatch is opt-in for Claude Code waves with at least two workers;
  solo and single-worker work stays in the shared checkout. (D1; `42a01cfd`)
- Every worker uses the main checkout's `.bee/`; linked-shaped invalid metadata
  produces typed `WORKTREE_LINK_INVALID` for library/CLI store access while the
  hook adapter stays non-throwing. Ordinary repository forms retain ordinary
  behavior. (D2)
- The orchestrator captures pre-dispatch attestation, rechecks identity, ancestry,
  and reserved-path subset, integrates transactionally, and records exact
  committed-main full-verify provenance before completion counts. (D3)
- Reservations keep one logical namespace after canonical work-root containment;
  escape and ambiguous requests deny every write tool before mutation. (D4)
- Automatic cleanup is limited to clean, reachable, full-green work; failures
  preserve, and destructive drop requires approval plus recovery evidence.

## 2. Current State

Concurrent workers currently share one checkout and Git index, which creates
`index.lock` contention and commit-order coupling. A native-worktree probe found
that worker commits are visible from the main checkout and that hooks receive the
physical worktree through `payload.cwd`. It also reproduced the blocking defect:
root discovery treats the worktree's checked-out `.bee/` as a separate empty
store, so the worker reaches the intake guard as idle. The existing swarming
documentation mentions worktree isolation but does not yet define the trusted
root split, integration sequence, failure disposition, or cleanup contract.

## 3. Scope

**In scope**

- Add typed linked-worktree resolution to the library and non-throwing hook
  adapter while preserving `workRoot`/`storeRoot`, loud CLI invalid-link failure,
  and ordinary directory/submodule/separate-git-dir controls. (D2)
- Make the write guard read coordination data from `storeRoot`, normalize target
  paths relative to `workRoot`, and fail closed for ambiguous write-capable
  requests. (D4)
- Canonically contain every target before logical normalization. (D4)
- Derive hook parity from runtime production inventory with explicit source-only
  exclusions; exact filenames follow the implementation gather.
- Define opt-in eligibility, independent attestation, transactional merge/check/
  commit/full-verify/revert, failure preservation, and gated cleanup/drop. (D1, D3)
- Run a real linked-worktree acceptance after the enabling resolver, guard, and
  protocol changes are present.

**Out of scope**

- Codex or manually managed `git worktree` lifecycle for external CLI executors.
- Scheduler annotations or recommendations for worktree use.
- Changes to reservation ownership, TTL, overlap, or meaning.
- Any authority input other than the independently captured control-plane
  attestation and reservation scope. Git metadata and derived worktree identity
  remain consistency checks, not security authority.

## 4. Proposed Approach

Implement typed linked-worktree resolution in both root-discovery locations.
Library/CLI coordination access raises `WORKTREE_LINK_INVALID` rather than using
local `.bee/`; the adapter transports `linked-invalid` without throwing. Existing
hook consumers keep the physical root; the write guard alone uses the store root
and canonically contains targets before logical normalization. Serialize wt-1 →
wt-2 → wt-3 in shared checkout, then run the attested, transactional wt-4 native
acceptance with exact full-main verify provenance and conservative disposition.

**Why this approach** — It keeps one coordination store and one reservation
namespace while limiting the change to the two existing root-resolution paths
and the swarming integration contract.

**Alternatives considered**

- Environment-based root override — rejected because CLI and hook resolution can
  diverge.
- A copied repository marker as proof of the main checkout — rejected because it
  does not establish a linked-worktree relationship.
- Worker-supplied integration identity — rejected; identity is derived from the
  native worktree id.
- Git metadata as a security boundary against a same-UID worker — rejected;
  metadata is consistency evidence and attestation is independently captured.
- Lexical-only path checks and automatic non-green cleanup — rejected because
  they permit escapes or destroy recoverable state.
- Running the enabling guard and protocol cells inside worktrees — rejected
  because the pre-fix guard cannot safely enable its own environment.
- Importing the state library into the hook adapter — rejected to preserve the
  adapter's import-light fail-open boundary; parity is enforced by fixtures.
- Bee-managed worktree lifecycle and scheduler hints — deferred beyond this
  feature.

## 5. Technical Design

Root resolution keeps two identities and one explicit resolution state. Starting
from the command or hook working directory, the resolver identifies the physical
`workRoot`, classifies it as `ordinary`, `linked-valid`, or `linked-invalid`, and
returns `{storeRoot, workRoot, worktreeResolution}`. For a linked candidate it
parses the worktree-side `gitdir`, requires the canonical target to be
`<main>/.git/worktrees/<id>`, and verifies that the main-side metadata points back
to the same canonical worktree. Only that bidirectional Git relationship promotes
`<main>` to `storeRoot`. A linked-shaped but malformed, forged, missing, or
ambiguous relationship is `linked-invalid`: library and CLI coordination access
raises `WORKTREE_LINK_INVALID` and never falls back to a worktree-local `.bee/`.
An ordinary checkout, submodule, or valid separate-git-dir repository remains an
ordinary control and keeps `workRoot === storeRoot`.

```text
payload.cwd
  -> physical workRoot
  -> classify ordinary | linked-valid | linked-invalid
  -> validate canonical Git links in both directions
  -> linked-valid: main-checkout storeRoot
  -> linked-invalid: fail coordination access loudly
  -> read shared state/reservations
  -> canonically contain the target inside workRoot
  -> authorize its logical path against shared reservations
```

The hook adapter preserves `ctx.root = workRoot` for every existing consumer,
adds `ctx.storeRoot` as an opt-in value used only by the write guard, and carries
the same typed resolution without throwing across the import-light fail-open
boundary. The write guard reads state, lanes, claims, and reservations from
`storeRoot`. Before reservation normalization it canonically contains every
write target inside `workRoot`: existing targets use their real path, new targets
use the nearest existing ancestor, and absolute-outside, traversal, symlink,
Windows-separator, and case-alias escapes are denied. On `linked-invalid`, every
write-capable tool is denied before mutation with a typed verdict; read-only tools
and ordinary shared-checkout behavior keep their current contract.

Runtime hook parity is derived rather than hand-enumerated. The expected shipped
set starts from command targets in both launcher manifests and closes over safe
same-directory relative imports. Tests compare that derived runtime inventory
with direct files under `.bee/bin/hooks/`, rejecting missing, extra, and byte-
different files while deliberately excluding source-only catalogs, configs, and
test files.

Execution stays in the shared checkout and is serialized `wt-1 → wt-2 → wt-3`, so
no two write-heavy steps compete for the same Git index. Before dispatching the
one validation-only acceptance worker, the orchestrator records a control-plane
attestation: canonical common directory, worktree path and id, initial symbolic
HEAD ref, base commit, and reserved paths. The same-UID worker is cooperative but
is not a security principal; worker-reported identity and mutable Git metadata are
consistency evidence only. Integration rechecks the attestation, base ancestry,
the symbolic branch, reported commit, and that the final diff is a subset of the
attested reservations. Detached HEAD, backlink mismatch, ancestry mismatch,
unexpected paths, or commit mismatch halts integration and preserves evidence.

Integration is transactional. Main records its pre-integration SHA, runs
`git merge --no-ff --no-commit`, executes targeted precommit checks, and aborts the
merge on conflict or red. It commits only after those checks pass, then runs the
exact repository-wide verification command from the committed main checkout and
records working directory, HEAD, ancestry, command, and output. An unexpected
postcommit failure is repaired non-destructively with a revert commit before any
later work. Automatic cleanup is non-force and allowed only when the worktree is
clean, verification is green, and its commit is reachable from main. Destructive
drop requires explicit operator authorization plus captured recovery coordinates.
Deterministic temporary-repository fault injection covers conflict, identity,
ancestry, path-subset, precommit-red, postcommit-red, blocked, handoff, and
abandoned dispositions.

**Security / Permissions** — The control-plane attestation and reservation scope
are the integration authorization inputs. Git backlinks and worker reports are
rechecked consistency signals, not an independent security boundary against a
same-UID process that can edit both ends. Tracked onboarding files, environment
variables, worker-reported ids/branches, and post-dispatch metadata alone grant no
authority. Existing reservation ownership, overlap, TTL, and holder-denial rules
remain the authorization boundary for file writes; canonical containment prevents
an apparently relative target from escaping that boundary.

## 6. Affected Files

The prepared cells are authoritative for this list.

| Action | File / Component | Purpose |
|--------|------------------|---------|
| Modify | `skills/bee-hive/templates/lib/state.mjs` | Add validated linked-worktree root resolution and `resolveRoots`. |
| Modify | `.bee/bin/lib/state.mjs` | Keep the runtime library mirror byte-identical. |
| Modify | `skills/bee-hive/templates/tests/test_lib.mjs` | Add root-resolution fixtures, focused dispatch/identity assertions, then detailed protocol assertions in acceptance. |
| Modify | `hooks/adapter.mjs` | Add the paired resolver and expose `ctx.storeRoot` without changing `ctx.root`. |
| Modify | `hooks/bee-write-guard.mjs` | Read coordination state from the store root, normalize against the work root, and deny ambiguity. |
| Modify | `.bee/bin/hooks/adapter.mjs` | Keep the runtime adapter mirror byte-identical. |
| Modify | `.bee/bin/hooks/bee-write-guard.mjs` | Keep the runtime write-guard mirror byte-identical. |
| Modify | `hooks/test_write_guard.mjs` | Cover worktree reservations, ambiguity denials, and ordinary-host regressions. |
| Modify | `hooks/test_hook_contracts.mjs` | Pin adapter/library root behavior and all write-capable tool paths. |
| Modify | `scripts/test_lib_mirror.mjs` | Derive the runtime hook inventory from both launchers plus safe relative imports, then enforce missing/extra/byte parity. |
| Modify | `docs/history/codex-harness-hardening/release-manifest.json` | Refresh tracked hashes after library and hook changes. |
| Modify | `skills/bee-swarming/SKILL.md` | Define qualifying dispatch, control-plane attestation, and integration consistency checks. |
| Modify | `skills/bee-executing/references/worker-details.md` | Define worktree result fields and identity-mismatch handling. |
| Modify | `skills/bee-swarming/references/swarming-reference.md` | Install the detailed integration and disposition protocol during live acceptance. |

## 7. Implementation Steps

- [ ] Add validated linked-worktree root resolution and RED-first path/backlink
  fixtures in both library mirrors (`worktree-isolation-1`; shared checkout; no
  dependencies).
- [ ] Add the adapter root split, guarded logical-path handling, typed ambiguity
  denials, hook parity checks, and manifest refresh (`worktree-isolation-2`;
  shared checkout; depends on `worktree-isolation-1`).
- [ ] Add qualifying dispatch, control-plane attestation, and identity/ancestry/
  reserved-path-subset checks to the swarming and worker contracts
  (`worktree-isolation-3`; shared checkout;
  depends on `worktree-isolation-2`, preserving serialized shared-checkout work).
- [ ] Perform the live linked-worktree acceptance, install the detailed
  attestation and transactional integration/disposition reference, run the exact
  full verification command on committed main, exercise deterministic failure
  dispositions, and apply only the proven-safe cleanup or preservation outcome
  (`worktree-isolation-4`; native worktree; depends on `worktree-isolation-2` and
  `worktree-isolation-3`).

## 8. Validation Plan

Validation is still in progress. The following checks will be run; no result is
claimed by this document yet.

**Automated**

- `worktree-isolation-1` — `node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs` will check root fixtures and library mirror parity.
- `worktree-isolation-2` — `node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check` will check guard behavior, contracts, hook parity, and the manifest.
- `worktree-isolation-3` — `node skills/bee-hive/templates/tests/test_lib.mjs` will run focused assertions for dispatch eligibility, the validation exception, attestation capture, and identity/ancestry/reserved-path-subset mismatch halts.
- `worktree-isolation-4` — the exact configured repository verification command
  will run from committed main after integration:
  `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/test_portable_paths.mjs && node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_verify_manifest.mjs && node scripts/test_release_tuple.mjs && node scripts/test_lib_mirror.mjs && node skills/bee-hive/scripts/test_split_brain_regression.mjs && node scripts/release_manifest.mjs --selftest && node scripts/release_manifest.mjs --check && node scripts/test_gate_bypass_doctrine.mjs`. Evidence records cwd, committed HEAD, ancestry, command, exit status, and output.

**Manual**

- [ ] Create the post-enablement native linked worktree, capture the control-plane
  attestation before dispatch, reserve both declared files, commit the acceptance
  edits once, recheck ancestry/identity/diff scope, then integrate transactionally.
- [ ] Confirm conflict or targeted-red aborts the uncommitted merge; unexpected
  postcommit-red creates a revert commit before later work.
- [ ] Confirm green completion permits only non-force cleanup when the worktree is
  clean and reachable; confirm incomplete, mismatched, conflicting, abandoned, or
  red outcomes preserve recovery coordinates and require explicit authorization
  before destructive drop.
- [ ] Run deterministic fault rows for identity, ancestry, reservation subset,
  conflict, blocked/handoff/abandoned, precommit red, and postcommit red.

**Evidence** — [Current validation report](reports/validation-current.md). The
planning documents and cells are synchronized, but execution stays held pending
delta re-review and a fresh full baseline in a child-process-capable environment.

## 9. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Library root resolver silently creates a second coordination store | High | Type linked-invalid separately, make library/CLI access raise `WORKTREE_LINK_INVALID`, and cover ordinary/submodule/separate-git-dir controls. |
| Hook adapter resolver diverges from the library copy | High | Use shared fixtures plus existing hook-contract checks. |
| Root/store split changes unrelated hook behavior or forks guard reads | High | Preserve `ctx.root` as the physical root and limit `ctx.storeRoot` consumption to the write guard. |
| A write-capable tool bypasses the ambiguity gate | High | Add negative pre-mutation rows for every write-capable tool class. |
| A canonical or platform-specific path escapes a logical reservation | High | Realpath existing targets, resolve the nearest existing ancestor for new targets, and deny absolute-outside, traversal, symlink, separator, and case-alias escapes. |
| Shipped hook mirrors drift or source-only files are mistaken for runtime files | High | Derive the runtime set from both launchers plus transitive imports; test missing, extra, and byte-different files. |
| Same-UID worker rewrites Git metadata to impersonate another worktree | High | Treat metadata as consistency evidence only; capture pre-dispatch attestation and recheck ancestry, branch, commit, and reserved-path subset. |
| Integration commits red work or destroys the only recovery copy | High | Use no-commit merge plus prechecks, full postcommit verification with provenance, revert-on-red, conservative cleanup, and authorized destructive drop only. |
| Happy-path fixtures hide failure-disposition bugs | High | Run deterministic temporary-repository fault injection for every preservation, abort, revert, and cleanup outcome. |

## 10. Rollback Plan

Rollback is commit-based and runs in reverse dependency order. First stop new
native worktree dispatch. If integration is still uncommitted, abort the merge; if
it was committed and the exact full verification is red, create a revert commit
before any later work. Then revert the protocol/acceptance commit, the hook/guard
commit and manifest update as one unit, and finally the resolver commit with both
`state.mjs` copies and fixtures. Keep the derived hook runtime set byte-aligned and
run the exact repository verification command after the reverts.

Do not delete a worktree that contains an unmerged, blocked, handoff, conflicting,
dirty, unreachable, or otherwise red result during rollback. Preserve its path,
attestation, derived branch, base, and commit until the work is explicitly
integrated or an operator authorizes destructive drop after recovery coordinates
are captured. This feature changes no persistent data model or external service,
so rollback requires no migration.

## 11. Open Questions

There are no unresolved product decisions. Validation must still establish:

- whether both resolver copies accept valid absolute, relative, whitespace, and
  Windows-backslash metadata, reject forged one-way relationships, and fail
  library/CLI access loudly on every linked-invalid form;
- whether existing hook consumers retain their current root meaning while only
  the write guard uses the coordination-store root;
- whether ambiguity denies every write-capable tool before mutation;
- whether canonical containment rejects traversal, symlink, outside-absolute,
  Windows-separator, and case-alias escapes for existing and new targets;
- whether launcher/import-derived mirror checking catches drift, missing files,
  and extra runtime files without including source-only files; and
- whether live acceptance records pre-dispatch attestation, rechecks identity,
  ancestry, and reserved-path subset, integrates transactionally, proves the exact
  full-main verification with provenance, and exercises every cleanup,
  preservation, abort, and revert disposition.
