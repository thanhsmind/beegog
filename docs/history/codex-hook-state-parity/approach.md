# Approach: Codex Hook And State Parity

## Recommended path

Land three mechanical boundaries in order.

First, make generic routing mutation prove its authority at the strict CLI door:
`state set` requires `--owner` equal to the selected record's pre-mutation phase,
all canonical callers migrate, and independent review loses its generic state caller
(D4–D7).

Second, extend the shared hook catalog with one bounded Codex native-subagent handler
projected onto both `SubagentStart` and `SubagentStop`. Keep every unsupported
blocking path explicit and tested; audit is evidence, never authority (D1–D3, D8).

Third, make the plugin package the runtime distribution unit. The installed package
loads canonical `skills/**` plus catalog-derived `hooks/hooks.json`; checked-in
`.agents/**` and `.codex/hooks.json` remain fallback/development projections and are
not directly rewritten by plugin reinstall (D9). The installer exposes mutually
exclusive plugin-first and repo-copy modes. Plugin-first verifies the installed
package is enabled and byte-matches the release inventory before atomically removing
owned duplicate skills and catalog-recognized bee hook entries. Repo-copy proves the
plugin inactive before vendoring project copies. User-root cleanup additionally
requires an exact installer ownership ledger (D10–D14).

## Rejected alternatives

- Copy Claude's `PreToolUse` model guard into Codex — native collaboration is not
  intercepted there, so it would advertise a denial that cannot occur.
- Persist an owner field — it adds a migration and a value that can drift from phase.
- Give review a synthetic `reviewing` owner — it recreates cross-phase state authority.
- Make plugin reinstall overwrite source-checkout `.agents`/`.codex` — those are
  fallback projections, not the package Codex loads.
- Delete every basename matching `bee-*` after a successful command — command success
  does not prove the package loadable, and a name does not prove global ownership.
- Leave project hooks while enabling plugin hooks — Codex loads both sources and would
  execute bee events twice.
- Remove the repo-copy route — it is the explicit fallback for hosts without usable
  plugin support.

## Risk map

| Component | Risk | Reason | Proof needed |
|-----------|------|--------|--------------|
| State authority | HIGH | A missed caller breaks the pipeline; a permissive mismatch preserves the original corruption. | Missing/wrong owner refuses with byte-identical state; matching owner works for default and lane; complete caller census. |
| Review boundary | HIGH | Review records must remain writable without owning active routing. | Review has no generic state caller; review-record writes preserve active state bytes. |
| Codex event adapter | HIGH | A runtime gap can become either silence or a false security claim. | Both native events map to one bounded handler; capability differences are structural assertions. |
| Installed package integrity | HIGH | Install command success alone may leave a stale or incomplete package. | Enabled status plus per-file inventory/hash comparison before any cleanup. |
| Two-way source arbitration | HIGH | Plugin and project sources can both load skills/hooks. | Plugin-first ends with zero bee project sources; fallback begins only after plugin inactive proof. |
| Destructive cleanup | HIGH | Broad deletion can remove user or foreign content. | Exact roots, plain-dir fence, catalog bee-hook matcher, symlink/alias refusal, zero-mutation preflight, user-root ownership ledger. |
| Shell/PowerShell parity | HIGH | Divergent installers recreate split-brain across operating systems. | One shared cleanup/inventory helper where possible; executable/structural parity tests for both launchers. |
| Release/reinstall | HIGH | Canonical tests can pass while the installed package stays stale. | Release inventory covers skills/hooks/manifests; one cachebuster; reinstall; fresh-thread UAT. |
| Full baseline | HIGH | Nested child processes currently return `EPERM`. | Exact configured verify exits zero in a child-process-capable environment; narrow green is never relabeled full proof. |

## Files and order

1. State authority: canonical CLI/templates, registry/guards, live workflow callers,
   vendored runtime mirrors, CLI/library tests, and state/review contracts.
2. Hook policy: catalog, new Codex start/stop handler, runtime hook mirror, plugin
   hook projections, onboarding renderer, and hook/onboarding tests.
3. Distribution arbitration: plugin manifest/package validation, release inventory,
   shared installer cleanup/ownership helper, both installers, installer tests, and
   install/runtime documentation.
4. Knowledge and recovery: current specs, corrected review/state artifacts, exact
   full baseline, installed-package check, and fresh-thread acceptance record.

Pre-existing hunks in tests, routing doctrine, AGENTS projections, swarming references,
and README are preserved. Generated root projections are tested only as explicit
fallbacks; they are not implementation targets of plugin-first delivery.

## Relevant learnings

- `docs/history/learnings/20260714-chain-integrity.md` — guard the mutation door and
  update real callers, not the diagram.
- `docs/history/learnings/20260711-cli-mutations.md` — mutations use strict reads,
  typed refusals, and atomic zero-write failure.
- `docs/history/learnings/20260712-skill-metadata-projection.md` — one canonical
  contract, minimal projections, and real-consumer proof.
- `docs/history/learnings/20260711-dispatch-log.md` — audit the traffic choke point
  without elevating logging into authority.
- `docs/history/learnings/20260715-codex-harness-hardening-1b.md` — run-global safety
  must precede skippable branches and cover every mutation vector.
- `docs/history/learnings/20260715-codex-wait-discipline-sandbox-proof.md` — exact
  live output matters; canonical success cannot substitute for runtime proof.

## Questions for validating

- Can the installer derive enabled-package location/status and compare its complete
  skills/hooks inventory without trusting project fallbacks?
- Can one shared helper give Bash and PowerShell identical cleanup, ledger, dry-run,
  symlink, and zero-mutation semantics?
- Does the new required CLI owner option cover every non-history caller and example?
- Does one handler receive stable bounded data on both Codex subagent events?
- Can the unchanged full verify run green with nested child processes before claim?

