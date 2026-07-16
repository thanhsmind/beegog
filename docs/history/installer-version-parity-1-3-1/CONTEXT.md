# Context: Installer Version Parity 1.3.1

## Boundary

Fix the two top-level installers so a successful greenfield or brownfield onboarding cannot leave Codex, Claude, the vendored runtime, or project-local skills on different bee versions. Ship the completed Codex sandbox and hook-state parity work as release 1.3.1 while excluding unfinished wait-loop and worktree-isolation changes.

## Locked decisions

- **D1 — fail closed on one release tuple.** Every authoritative source marker required to perform an install must exist, be readable, and agree before target mutation. Target runtime/onboarding/project projections may be absent on greenfield input, but every applicable target surface must exist and equal the validated source tuple before success. An existing unreadable or unequal target refuses or is upgraded through an explicitly proven path; it is never ignored. Decision `55ff17ef`.
- **D2 — prove the wrappers, not only their helpers.** Both installers must be exercised through greenfield and brownfield entry flows. Success requires the requested version, complete onboarding information, no managed drift, preserved owner content/state, and an immediate `up_to_date` repeat. Decision `09b776b5`.
- **D3 — repair source-repository self-onboarding.** A canonical source checkout may not retain stale discoverable `.agents/skills` or `.claude/skills` projections. Self-skip cannot exclude those projections from update or truth reporting.
- **D4 — release boundary.** Release 1.3.1 includes capped `codex-sandbox-baseline`, capped `codex-hook-state-parity`, this fix, and their truthful specs/history. It excludes every `codex-agent-wait-loop` and `worktree-isolation` source or bookkeeping hunk that is not independently completed. Decision `fc76ce41`.
- **D5 — cross-platform proof.** Linux execution is required locally. Windows PowerShell execution must run on a real Windows/PowerShell environment; ASCII/token checks are not a substitute. If unavailable, release is blocked rather than called proven.
- **D6 — release publication.** After the immutable reviewed scope is green, bump the complete version tuple to `1.3.1`, regenerate the release inventory, self-onboard, commit on `main`, tag `v1.3.1`, and push `main` plus the tag.
- **D7 — exact project cleanup ownership.** Plugin-first cleanup may remove only project fallback skills proven to be members of bee's managed release set. A project-owned directory such as `bee-custom` survives even though its name shares the prefix.
- **D8 — no pre-confirmation runtime mutation.** Wrapper planning and dry-run never install, remove, or alter runtime plugins. Tests exercise plugin transitions through PATH-isolated fake CLIs with call logs and deny sentinels; a fixture state file cannot substitute for this ordering proof.

## Success conditions

- A stale 0.1.43 project projection upgraded from a 1.3.1 source becomes 1.3.1 everywhere and a second run reports no work.
- A deliberately mixed release tuple is rejected before target mutation by both entry points.
- New and existing projects receive all required onboarding records and managed artifacts for the chosen distribution mode.
- Linux and Windows entrypoint tests execute, not merely parse or grep the scripts.
- The release diff contains no open wait-loop/worktree-isolation work.
- Project-owned `bee-*` skills outside the proven managed release set survive plugin-first cleanup.
- Plugin install/removal occurs only after confirmation and a repeatable preflight snapshot.

## Terms

| Term | Meaning |
|---|---|
| release tuple | The version asserted by every authoritative package/runtime marker that must move together. |
| project projection | A project-local copy of bee skills discoverable by an assistant runtime. |
| complete onboarding | Required managed records and artifacts exist, their fingerprints match live files, status reports no drift, and a repeat check is current. |

## Out of scope

- Completing wait-loop or worktree-isolation features.
- Redesigning the plugin manager CLIs.
- Treating an unavailable Windows runner or read-only Git metadata as a passing result.
