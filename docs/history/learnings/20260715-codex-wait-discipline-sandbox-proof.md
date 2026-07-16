---
date: 2026-07-15
feature: codex-agent-wait-loop
categories: [pattern, decision, failure]
severity: critical
tags: [codex, subagents, pressure-testing, verification, sandbox, projections]
---

# Learning: Cross-surface agent rules need frozen pressure proof and capability-honest closure

## Learning 1 — Freeze the rationalization before writing the rule

**Category:** pattern  
**Severity:** standard  
**Applicable-when:** changing instructions that can be bypassed under authority,
urgency, fatigue, or transcript-noise pressure.

## What Happened

The three frozen scenarios in
`docs/history/codex-agent-wait-loop/pressure-tests.md` all selected an immediate
second wait under the old guidance. After the minimal doctrine/procedure change,
one fresh review child replayed the same choices and selected the required safe
sequence in all three cases. The executable census moved from 321 passing and
one failing assertion to 322 passing and none failing.

## Root Cause

The old guidance made silence non-failure and allowed bounded waiting, but never
specified the interval after an empty wait. Under no-chatter and deadline
pressure, another wait therefore looked like the most compliant path.

## Recommendation

When changing behavioral instructions, freeze realistic A/B/C pressure cases
and their genuine RED rationalizations before editing wording; rerun the same
cases with only the instruction surface changed, and pin every delivery surface
with an executable census.

## Learning 2 — Preflight every required write family, including Git metadata

**Category:** failure  
**Severity:** critical  
**Applicable-when:** a cell owns projections, generated copies, or a required
commit in a sandboxed workspace.

## What Happened

The first implementation cell stopped before semantic edits because `.agents/**`
was read-only. The repaired cell successfully updated the always-loaded root
doctrine, canonical sources, and writable `.claude` projection, then failed its
required commit because `.git/index.lock` could not be created. Both constraints
were discoverable before dispatch with `test -w` capability probes.

## Root Cause

Validation proved logical scope and source relationships but assumed every path
under the checkout inherited the workspace's write permission. The sandbox had
more-specific read-only mounts for `.agents` and `.git`.

## Recommendation

Before approving a write-heavy cell, probe every declared output family and the
Git index path from the worker's execution context. If a required path is
read-only, repair scope or stop before dispatch; never discover projection or
commit impossibility after implementation.

## Learning 3 — A passing constituent set is not a passing declared verify

**Category:** failure  
**Severity:** critical  
**Applicable-when:** a stored verify command contains shell composition or the
environment restricts nested child processes.

## What Happened

The direct doctrine census passed with 322/0 and `git diff --check` passed alone,
but the literal stored conjunction exited 1 with empty output in this sandbox.
The cell nevertheless recorded `verify_passed: true` and capped, contradicting
its own trace and the exact-command contract.

## Root Cause

The worker treated independently green constituents as equivalent evidence for
the declared shell command. The cap helper validates the reported boolean and
evidence shape, not the process exit that produced them.

## Recommendation

Run the literal cell verify in the target sandbox before dispatch. If the exact
command cannot return zero, revise and revalidate the command before work begins;
never mark a failed declared command passing because its constituents pass
separately.

## Learning 4 — Root-only deployment needs root-only proof

**Category:** decision  
**Severity:** standard  
**Applicable-when:** an installed runtime projection is read-only or stale while
a higher-precedence standing instruction remains writable.

## What Happened

The repaired deployment uses root `AGENTS.md` as current Codex enforcement and
canonical `skills/**` as the future synchronization payload. The GREEN replay,
however, also loaded canonical procedure files, so it did not isolate the exact
root-only constrained runtime.

## Root Cause

The repair changed the deployment boundary without adding a matching deployment
variant to the pressure protocol.

## Recommendation

When a deployment falls back to a higher-precedence standing rule, add a replay
that loads only that live surface and separately require post-sync proof before
claiming lower projections synchronized.
