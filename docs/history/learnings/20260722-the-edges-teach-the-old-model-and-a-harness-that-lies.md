---
date: 2026-07-22
feature: okf-integration-close-f4
categories: [failure, pattern, decision]
severity: critical
tags: [silent-rot, migration, harness-hermeticity, false-red, instructions-as-surface]
---

# Learning: a migration finishes at its edges, and a harness that lies costs more than a bug

The switchover flipped the system of record. This feature closed the seven places that were still
teaching the retired one, and tripped over a harness defect on the way.

## Learning 1: A migration is not done when the mechanism is done — the instructions are a surface too

**Category:** failure
**Severity:** critical
**Tags:** [silent-rot, migration, instructions]
**Applicable-when:** any migration that changes where truth lives — a doc tree, a config format, a
data store, an API version.

### What Happened

`okf-switchover-f3` shipped a correct, guarded, mechanically-fenced switchover. Every suite was
green and stayed green. An audit run afterwards found seven surfaces still routing to the old
model, two of them confirmed by simply *reading this session's own startup output*: the
critical-patterns digest was printing four lines of YAML delimiters and six of a pointer stub's
forwarding address — not one lesson — and the project map was counting the read-only compatibility
surface as "specced areas" while instructing every session to read the spec before the code.

The sharpest one: the two reference files the routing skill explicitly defers to for "the full
routing table" and "the full pipeline" contained **zero** mentions of the new tree, against four and
one for the old. An agent that followed the *complete* instructions was taught the exact order the
migration had replaced, by files sitting two directories from the skill that taught the opposite.

### Root Cause

The migration's own guards protect *content* — where new truth may be written, whether concepts
parse, whether coverage is complete. Nothing checks whether the **instructions** still describe the
world. Prose has no test, so prose rots silently, and the rot lands in exactly the place that
teaches every future session. Worse, the two most-damaged surfaces were *generated output* (the
session preamble) and *deferred-to references* — surfaces that a reviewer reading the main skill
file would never open.

### Recommendation

**When a migration changes where truth lives, treat the instruction layer and the generated
orientation output as first-class migration targets, and audit them by MEASUREMENT before declaring
done: grep every skill, reference, and injected preamble for the old path and the new one, and treat
any file that mentions the old and not the new as unmigrated.** Give special weight to (a) files a
skill *defers to* rather than files a skill *is*, and (b) anything rendered into a session preamble
— read the actual emitted output, do not reason about the code that emits it. A count of 0 for the
new path in a file that governs routing is a finding, not a stylistic gap.

## Learning 2: A harness that leaks its own identity manufactures a false red — and false reds cost more than bugs

**Category:** failure
**Severity:** critical
**Tags:** [hermeticity, false-red, rule-collision]
**Applicable-when:** any test suite whose behavior depends on identity, environment, or ambient
context — and any project whose own conventions set environment variables.

### What Happened

Two of this project's rules collide. One mandates prefixing write-heavy shell commands with the
acting agent's name in an environment variable during swarms. Another mandates running the
configured verify command. Obeying both leaks the agent name into every suite the verify runner
spawns, where it becomes the *acting agent identity* inside the write guard — inverting the
assertion "the acting session's own hold must never block its own write."

Reproduced deterministically, same suite, same command, one variable apart: **31 passed / 0 failed**
without it, **28 passed / 3 failed** with it.

The cost was not the fix (one line, beside two identical lines that already existed). The cost was
the misdiagnosis. Two execution workers reported it as flake. The orchestrator saw the failures,
noted the workers had run concurrently, re-ran serially *without the prefix*, saw green, concluded
"swarm noise", and **told the user so**. That conclusion was wrong, confidently stated, and only
overturned because a third worker happened to reproduce it in isolation.

### Root Cause

The runner already scrubbed two identity variables for exactly this hermeticity reason. It was one
variable short — the same defect class as the fix that introduced it. And the failing assertions
were in the *coordination guards*, which is the worst possible place for a false red: a
cross-session-hold failure reads exactly like a real concurrency defect, so the plausible
explanation ("two agents ran at once") was available and wrong.

### Recommendation

**When a suite red has a plausible environmental explanation, reproduce it by toggling ONE variable
before you accept that explanation — a green re-run under different conditions is not evidence about
the original conditions.** The specific trap: re-running "the same thing" from a different shell
silently changes the environment, and a green from a changed environment tells you nothing about the
red.

**And: audit your own conventions against your own harness.** Any project rule that sets an
environment variable is an input to every test that project runs. Enumerate the identity/ambient
variables your conventions set, and scrub *all* of them at the runner — the acceptance test is that
the chain passes **with the convention applied and without it, identically**, not that it passes in
whatever environment you happened to use.

## Learning 3: A newest-first cut is honest where a first-N cut only looks arbitrary-free

**Category:** decision
**Severity:** standard
**Tags:** [defaults, ordering, digests]
**Applicable-when:** truncating any ordered list for a summary or digest.

### What Happened

Replacing the dead digest with "the first N rows of the bundle's critical-patterns section" would
have passed review and looked principled. Those rows sit in **date order** and there are ~50, so the
result would have shown the ten oldest lessons forever and never a recent one — trading the stub's
arbitrary cut for a different arbitrary cut that was harder to notice, because it produced
real-looking content.

### Root Cause

"Take the first N" inherits whatever order the source happens to have, and that order is usually
incidental rather than chosen. The failure is invisible precisely because the output looks correct.

### Recommendation

**Before truncating a list for a digest, state what the source's order actually is and whether that
order serves the reader; if it does not, choose the cut deliberately and say so in the output.** Here
the digest states the total, lists the most recent, and names the full index — and explicitly does
not rank, because ranking needs a query to rank against and a session preamble has none. Naming the
cut in the output is what stops the next reader from mistaking an incidental order for a chosen one.
