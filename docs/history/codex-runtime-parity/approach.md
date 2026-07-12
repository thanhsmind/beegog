# Approach: Codex Runtime Parity

## Recommended Path

Build one shared bee runtime with two explicit lifecycle projections. Codex is
distributed plugin-first through the existing root plugin/marketplace; the
source repository keeps a dogfood fallback. For the current incident, repair
that checked-in fallback in place because no bee plugin is installed; the
remaining Distribution slice later moves host-repository fallback generation
into onboarding. Hook scripts and helper business logic stay shared; only
catalog target transport, payload adapters, and event output encoding differ
(per D1, D2, and decision `5e6582af`).

In parallel, repair the Codex collaboration and external-executor contracts:
new agents start with `fork_turns: "none"`, continuations use `followup_task`,
CLI workers use workspace-write plus normal approvals, and every rescue resumes
the exact captured session UUID (per D3 and D4). Custom Codex profiles remain
deferred to P25.

## Runtime Design

### 1. Plugin-first distribution and one active source

- Keep the shared repository root as plugin source and reuse
  `.claude-plugin/marketplace.json`; do not create a second Codex marketplace or
  copy of the plugin.
- Make `hooks/hooks.json` the Codex default projection so the Codex manifest can
  omit a redundant `hooks` field. Move the Claude projection to an explicit
  `hooks/claude-hooks.json` path in the Claude manifest. Both checked-in files
  are rendered from one logical catalog and are drift-checked. The two
  projections, the Claude manifest switch, and the Codex default-path proof
  land as one atomic safety-foundation change; no intermediate commit may
  repurpose the default path while Claude still points at it.
- Bring `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, and
  `BEE_VERSION` under one strict-semver equality guard. Add the publisher fields
  required by the installed plugin validator.
- For the current source-repository incident, keep and repair the committed
  `.codex/hooks.json`: render it through
  `renderProjection(runtime, { target: "repo" })`, resolve from the session cwd
  to the git root, execute the current `hooks/` wrappers, and pass source
  identity `repo`. This bounded repair does not edit onboarding, a plugin,
  global configuration, or persisted trust state.
- In the remaining Distribution slice, onboarding adopts the repo-target
  renderer, preserves foreign entries, backs up changed config, and refuses
  when plugin status is enabled or unknowable. That later slice removes the
  checked-in dogfood fallback only after plugin UAT, not during this incident.
- Source-selector arbitration and plugin-side source identity also remain in
  the Distribution slice. The incident keeps the existing plugin-target Codex
  and Claude projections byte-identical; only repo-target commands carry
  `repo`. The later selector prevents double effects while plugin and fallback
  coexist transiently, and migration removes the inactive fallback after UAT
  so `/hooks` ends with one configured source.
- Ordinary onboarding never installs/disables a global plugin. The top-level
  installers own that visible global step: inspect, print the plan, ask, install
  and verify the plugin, then separately offer protected cleanup of legacy
  `~/.codex/skills/bee-*`. No silent deletion or direct remove-and-copy remains.
- Migration checkpoints install, trust, and version-check the plugin while the
  repo source remains selected and its configuration remains available for
  rollback. The selector then switches atomically to `plugin`; fresh-thread
  lifecycle UAT runs through that now-active source. Failure switches back to
  `repo` and restores backed-up config. Only a PASS removes fallback entries;
  legacy skills are offered for cleanup after that checkpoint, with their
  protected backup retained until release UAT passes.

### 2. Shared hook logic, exact host adapters

- Introduce one small runtime adapter used by every wrapper: normalize arbitrary
  stdin before property access, keep root discovery inside the fail-open
  boundary, encode runtime/event output, and log crashes or known coverage gaps
  without changing the allow/deny result.
- Keep session bootstrap and prompt reminders as shared plain developer context.
  Keep model-tier guard in the Claude projection because Codex does not expose
  collaboration spawn through `PreToolUse`.
- Adapt Codex write guarding to canonical `apply_patch` input and supported
  Bash/MCP paths. Parse patch targets for Add/Update/Delete/Move and run the
  existing gate/direct-edit/reservation decisions on every target. Once an
  `apply_patch` event is intercepted, a target set that cannot be proved denies
  with a corrective message whenever gate/direct-edit/reservation policy could
  apply. Malformed outer payloads and truly unsupported host paths retain D2's
  visible fail-open behavior.
- Encode Codex PreCompact, SubagentStop, and Stop advisories as parseable JSON
  `systemMessage`. Do not use `decision: "block"`, so close/nudge behavior
  remains advisory and cannot accidentally continue a child or loop a turn.
- Fix registered-worker nickname matching and make all seven wrapper processes
  pass the same malformed-input/fail-open fixture table.
- Do not claim native-read privacy or full unified-shell enforcement. AGENTS and
  helper checks stay authoritative for paths Codex hooks cannot intercept.

### 3. Current collaboration and executor contract

- New native Codex workers/reviewers use
  `spawn_agent({task_name, message, fork_turns: "none"})`; the full inline role
  contract remains the role source because `task_name` is not a profile.
- Continue the same idle agent with `followup_task`. Use `send_message` only for
  delivery to a running agent; tend with completion notifications,
  `wait_agent`, and `list_agents`; interrupt only for abort/deadlock.
- Replace active external commands with
  `codex --ask-for-approval on-request exec --sandbox workspace-write ...`.
  Remove `--yolo`, `--full-auto`, positional sandbox words, and any equivalent
  blanket bypass from active examples/config.
- Launch external sessions with a machine-readable stream only to capture the
  stable session UUID, while keeping the final worker result in the existing
  result-file contract. Rescue uses `codex exec resume <SESSION_ID> -` and does
  not re-pass launch-only sandbox/config flags.
- Add explicit read-only reviewer preambles that forbid onboarding/apply and
  index-wide git operations. Do not modify historical decisions silently;
  annotate unsafe historical copy-paste examples as superseded.

### 4. Repair workflow state and skill guidance RED-first

- Add one guarded atomic state operation for starting a feature. It fails closed
  unless the prior phase is `idle` or terminal, no HANDOFF exists, no claimed
  cells or registered workers remain, active reservations are empty, and the
  prior feature has no nonterminal cell (`open`, `claimed`, or `blocked`). An
  intentionally abandoned cell must first be resolved by a separate recorded
  drop/closure operation. Feature start never auto-clears workers or cells.
  Once those preconditions hold, it sets feature/mode/valid phase, resets all
  four gates, and updates summary/next action in one write, so a new feature
  cannot inherit approvals.
- Skills use only the closed phase vocabulary: exploring stays `exploring`
  until Gate 1; planning advances to `validating` after Gate 2 prep; an approved
  tiny/small lane advances to `swarming`. Remove invented completion phases.
- Before editing any `SKILL.md` or its normative reference, run and checkpoint
  the five dispatch/state pressure scenarios without the proposed guidance;
  preserve exact choices and rationalizations. Rerun the identical scenarios
  after the minimal edits and amend each touched `CREATION-LOG.md`.
- Update every active clean-context promise in exploring, validating, reviewing,
  and swarming. Do not absorb the separate fanout-delegation feature or create
  custom Codex agent profiles.

### 5. Truthful docs, dogfood, and release

- Replace active statements that Codex has no hooks. Explain plugin versus
  fallback, trust/new-thread behavior, additive sources, supported and
  unsupported paths, safe executor flags, and the helper/AGENTS final belt.
- Replace the AGENTS project-description placeholder with a concise bee
  description and update the managed block without deleting manual guardrails.
- Validate plugin-only and fallback-only installs in isolation, then request
  separate human approval before touching the user's real global plugin/legacy
  skills or trusting a hook hash.
- After Gate 4, follow the standing tagged-release flow with all three versions
  guarded. Release/push and downstream host onboarding remain external actions
  after explicit acceptance, not part of Gate 2 approval.

## Rejected Alternatives

- **One union catalog** — runtime-inert matchers and broad PostToolUse triggers
  make drift and accidental behavior hard to see.
- **Codex-specific wrapper fork** — duplicates seven fail-open shells and
  recreates the current four-release drift.
- **Project hooks as the primary Codex path** — contradicts D1 and duplicates
  whenever the plugin is enabled.
- **A repo `.codex/config.toml` catch-all** — would mix personal permission
  policy with plugin lifecycle configuration and create another additive hook
  source.
- **Custom `.codex/agents` profiles now** — no callable selector proves they are
  active; D4 defers them to P25.
- **`resume --last`** — unsafe in parallel waves because newest is not the same
  as assigned.

## Risk Map

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| Hook payload/output adapter | HIGH | A malformed or wrong-shaped wrapper can silently allow a forbidden write or break a turn | Every-wrapper process table plus event-specific JSON parse tests |
| `apply_patch` target extraction | HIGH | Missing one target bypasses gate/reservation checks | Add/Update/Delete/Move, multi-target, escape and malformed rows; temporary-break proof |
| Hook-source migration | HIGH | Codex runs duplicate sources concurrently; cleanup can destroy user config | Source-selector arbitration, fallback→plugin transition, backups, foreign-entry preservation, zero-mutation refusal |
| Legacy global skill cleanup | HIGH | Mirror/delete defects previously survived large pre-code suites | Reuse hardened identity/downgrade fences and isolated destructive review |
| Workflow state start/handoff | HIGH | Inherited gates authorize the wrong feature; cleanup can orphan work | Terminal/no-HANDOFF/no-worker/no-claim/no-reservation preconditions plus every valid transition |
| External executor sandbox/resume | HIGH | Blanket authority or wrong-session rescue can mutate the wrong scope | CLI parse, two-session UUID live fire, workspace/outside boundary UAT |
| Skill/reference edits | MEDIUM | Prose can still choose obsolete calls under pressure | Recorded RED/identical GREEN scenarios and creation-log amendments |
| Claude regression | MEDIUM | Shared scripts/catalog generation can weaken the established runtime | Claude projection parity and full existing suites |
| Windows/subdirectory paths | MEDIUM | Git-root quoting and shell syntax differ | PowerShell/static path rows and available Windows/case-insensitive proof |
| Real plugin trust/new-thread load | HIGH | Installed components do not run until trusted/reloaded | Human `/hooks` trust plus fresh-thread UAT |
| Active repo fallback | HIGH | The only active Codex bee source currently launches through a Claude-only path variable | RED old-command proof, deterministic repo-target render, actual-command process harness, then human re-trust |

## Likely Files And Order

1. **RED evidence and state contract:**
   `docs/history/codex-runtime-parity/reports/`, `skills/bee-hive/templates/bee_state.mjs`,
   `skills/bee-hive/templates/lib/state.mjs`, and their vendored/test copies.
2. **Hook foundation:** `hooks/*.mjs`, the logical catalog and two projections,
   the atomic Claude manifest hook-routing switch, hook process tests,
   `templates/lib/guards.mjs`, onboarding renderer/tests, and self-contained
   fallback hook assets.
3. **Distribution:** both manifests' shared version/publisher metadata (not hook
   routing), shared marketplace validation, `scripts/install.sh`,
   `scripts/install.ps1`, onboarding migration, and release parity tests.
4. **Dispatch and skills:** active Codex config samples, model/config docs,
   swarming/exploring/validating/reviewing skills and references, and their
   creation logs.
5. **Truth layer:** AGENTS template/current block, README, INSTALL, runtime and
   contract docs, onboarding spec, review/UAT reports, and release metadata.

The exact write list is bounded after Gate 2 when current-slice cells are
created. User-owned `docs/history/fanout-delegation/` and its P23 row stay out of
scope.

## Relevant Learnings

- `20260711-model-tier-guard.md` — malformed top-level inputs, embedded control
  tokens, and string-presence tests must be adversarial rows from the start.
- `20260711-skill-sync.md` — destructive/mirror code needs isolated review of
  the actual diff even after large green suites.
- `20260710-external-result-contract.md` — reviewer prompts must forbid
  onboarding; resume inherits launch flags; final results remain file-checkable.
- `critical-patterns.md` — every non-exposure boundary is tested at every
  output, and a finding is a defect-class census rather than a one-line patch.

## Questions For Validating

- Does current Codex accept the chosen default Codex catalog plus explicit
  Claude catalog arrangement through both manifests and the shared marketplace?
- What stable JSON event carries the external session UUID in CLI 0.144.1, and
  can it be captured without making JSONL the final-result contract?
- Does a child `PreToolUse` payload expose a reliable identity that can be
  correlated to a bee reservation? If not, which reservation paths remain
  helper-enforced and how are they surfaced?
- Can the real installer prove plugin enabled/current without depending on
  human-formatted output? Unknown status must refuse fallback mutation.
- Which Windows/case-insensitive proofs are available in this environment, and
  which must remain explicit Gate 3 limitations?

These are pre-execution feasibility questions. Catalog loading, Codex JSON event
acceptance, intercepted-patch denial, child identity capture, and exact-session
resume must all return YES in `bee-validating` before Gate 3 is presented. A NO
revises or splits the approach; it is never deferred into execution.

For the bounded repo-fallback incident, the official Codex hook contract closes
the cwd/feature questions: hooks are enabled by default, command processes use
the session cwd, and git-root resolution is the recommended repo-local
transport. Fresh validation therefore proves the generated command and its
failure behavior mechanically; changed-definition review remains a Gate-4
human checkpoint rather than a hidden implementation step (decision
`d91a8398`).
