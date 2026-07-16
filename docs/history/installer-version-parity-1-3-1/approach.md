# Approach: Installer Version Parity 1.3.1

## Recommended path

First make release identity a shared, strict precondition and repair source-checkout self-onboarding so canonical skills refresh every discoverable project projection (D1, D3). Then run both wrappers through fixture-contained greenfield and brownfield flows, with exact postcondition checks instead of `installed: true` (D2, D5). Finally isolate only completed Codex work, bump the tuple, regenerate inventory, review the immutable commits, and publish 1.3.1 (D4, D6).

## Rejected alternatives

- Check only the two plugin manifests — rejected because the current false-green state already has current manifests and stale project skills.
- Keep self-skip and hide source-repo projections — rejected because Codex/Claude discover those directories today.
- Add more token/ASCII checks — rejected because they cannot prove wrapper ordering, mutation boundaries, or final state.
- Release the full dirty tree — rejected because it includes open, execution-unapproved work.

## Risk map

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| Release identity | HIGH | A mixed tuple can silently install stale behavior | mixed-tuple zero-mutation refusal tests |
| Self-onboard projections | HIGH | current source checkout demonstrably exposes 0.1.43 skills beside 1.3.0 runtime | stale-to-current projection sync + second-run test |
| Installer ordering | HIGH | plugin install/removal and onboarding can partially succeed | wrapper E2E failure/rollback assertions |
| Windows bootstrap | HIGH | sparse checkout omits a file the script immediately requires | real PowerShell/Windows job plus sparse fixture |
| Dirty-tree release isolation | HIGH | unrelated open work shares several files/hunks | file-to-cell census, staged diff audit, immutable review |
| Git/tag/push | HIGH | current managed environment exposes Git metadata read-only | writable Git environment and remote push evidence |

## Files and order

1. Version/onboarding core and tests: `skills/bee-hive/scripts/onboard_bee.mjs`, its test suite, release-tuple checks, and project projections.
2. Entry points and E2E harness: `scripts/install.sh`, `scripts/install.ps1`, `scripts/test_installers_e2e.mjs`, Windows workflow.
3. Release tuple/inventory: runtime version mirrors, both plugin manifests, split-brain fixture, release manifest.
4. Specs/history and selectively owned completed Codex files.

## Relevant learnings

- `docs/history/learnings/20260715-codex-harness-hardening-1b.md` — a run-global version guard cannot live behind a self-skip path.
- `docs/history/learnings/critical-patterns.md` — fail-open fixtures need sentinel denies; hardcoded mirrored file lists rot.

## Questions for validating

- Can the current sandbox execute child Bash processes reliably enough for entrypoint E2E?
- Which Windows runner is available to provide real PowerShell evidence before release?
- Can this environment write Git metadata and reach the release remote, or must publication hand off after a fully prepared tree?
