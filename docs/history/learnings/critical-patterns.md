# Critical Patterns

Mandatory pre-planning / pre-execution context for this repository.
bee-compounding appends hard-won patterns here; keep it short and current.

## [20260708] Windows Git Bash /tmp is invisible to node
**Category:** failure
**Feature:** harness09
**Tags:** [windows, paths, environment]

Shell redirection into `/tmp` works under Git Bash, but handing that `/tmp/...` string to
a node API fails — node cannot resolve MSYS paths. Pipe the file through stdin
(`cat file | node -e ...`) or use a Windows-style absolute path (the session scratchpad).

**Full entry:** docs/history/learnings/20260708-harness09.md

## [20260708] Verify strings are authored, not just read — two traps
**Category:** failure
**Feature:** harness10
**Tags:** [verify-strings, shell, validation, prose-cells]

A cell's `verify` command must be executed once before it reaches a worker, not reviewed as prose.
Two traps, both survived static review this feature:
1. **Metacharacter regex:** `grep -q '['` is an invalid regex and aborts the `&&` chain. Dry-run any
   verify containing regex/glob metachars (`[ * ? |`) in the target shell, or use `grep -F` for literals.
2. **Grep-for-prose gaming:** a verify that greps for an invented multi-word token rewards embedding that
   token verbatim into prose. Grep a **stable heading** the section needs anyway, never an invented phrase.

**Full entry:** docs/history/learnings/20260708-harness10.md

## [20260710] A boundary that lists field names will leak the field you forgot
**Category:** failure
**Feature:** evolving-loop
**Tags:** [security, allowlist, trust-boundary]

The same defect survived three rounds: a validator covered `title`, then `title`+`layer`+`source`,
and each time the next unremembered field was the next hole (`first_seen` rode in on
`Date.parse("Jan 1 2020 (payload)")` — lenient date parsers treat parenthesised text as a comment).
A list of field NAMES cannot make forgetting a field fail. Map each field to its validator and
**derive the field list from the map**, so an unspecced field is a red test, not a vulnerability.
Then write the table-driven test that feeds a payload into *every* field.

**Full entry:** docs/history/evolving-loop/reports/review-slice-a.md

## [20260710] A frozen assertion can encode the defect it guards — the worker must stop, not rewrite
**Category:** process
**Feature:** evolving-loop
**Tags:** [testing, frozen-assertions, review]

Twice, a "frozen" assertion asserted the exact vulnerability under repair — one written by the very
cell tasked with building that boundary, one pinning the defective syntax itself. 93 then 104 green
assertions proved conformance to a wrong spec, not safety. Both were found only because a worker hit
them while fixing a bug and returned `[BLOCKED]` quoting the assertion instead of "correcting" it.
**Keep that escape hatch.** A worker never unfreezes an assertion; the planner does, narrowly, with a
logged decision (`c45d0fb3`, `b8fe5c81`). Corollary: a drift guard that greps a module's own source
pins syntax, not behavior — and pinned syntax can be the bug.

## [20260710] Evidence is checkpointed to disk per step, never held in context until the end
**Category:** failure
**Feature:** evolving-loop
**Tags:** [iron-law, workers, context]

An Iron Law worker edited `SKILL.md` and died before writing its RED pressure-test report; the edit
was reverted, because an unrecorded RED phase is not a RED phase and reconstructing it from the
worker's summary would be fabricating evidence. Its successor checkpointed each scenario to disk as
it finished, was interrupted mid-run, and lost nothing. Write each scenario, each proof, each
observation as it lands. Note also that `grep '## RED'` passes on a `touch`, and one commit holding
RED+GREEN proves no ordering — commit RED separately.

## [20260710] Never release another agent's reservations on a stall signal
**Category:** failure
**Feature:** evolving-loop
**Tags:** [swarming, reservations, orchestrator]

A "stalled/killed" notification was trusted; the orchestrator released a live worker's reservations,
reset its claimed cell, and dispatched a duplicate. Nothing corrupted — the first worker finished and
the second returned `[NOOP]` — but the reservation guard was defeated by the orchestrator, not by a
race. Before declaring a worker dead, check for progress on disk over an interval. The lock did its
job; the person with the key opened the door.

## [20260710] A NUL byte in a source file makes grep silently match nothing
**Category:** failure
**Feature:** evolving-loop
**Tags:** [tooling, grep, verification]

`sortKey` joins fields with a NUL separator — a legitimate technique. Side effect: `grep`/`rg` treat
the whole file as **binary and print nothing, not even a zero count**. In a repo whose drift guards
are grep-over-source, this reads as "the symbol is gone". It briefly convinced an orchestrator that a
landed fix had vanished. If a grep over a source file returns empty rather than `0`, check for
control bytes before believing it.

## [20260710] A plan that names a source must name the reader that can open it
**Category:** process
**Feature:** evolving-loop
**Tags:** [planning, cells, scope]

A cell mandated markdown frontmatter as a collection source, restricted content reads to the JSON-only
wrappers, and forbade bare filesystem reads in the module — with a two-file scope. No reader existed
for the source it required. The worker had to widen a shared helper outside its declared scope to do
the honest thing rather than game the security check. When a plan names a source, it names the reader
that can open it, or it grants the scope to build one.

## [20260710] A non-exposure invariant needs a test on every output surface it crosses
**Category:** security
**Feature:** evolving-loop slice B
**Tags:** [security, boundaries, testing]
"Never render/emit X" written in a plan or SKILL.md is a request, not an enforcement. The stripped
cluster key was banned in prose at two altitudes and still reached the consuming agent via
`rank --json` spreading `...cluster`. When a value's absence from an output is a security
property, assert that absence with a test at EVERY surface the value crosses (lib return, CLI
output, prompt render) — the same root cause recurs one layer down from wherever you fixed it.

## [20260710] Scope an incident-born check to the defect class, never the first location
**Category:** failure
**Feature:** evolving-loop slice B
**Tags:** [testing, control-bytes, tooling]
The C0 control-byte sweep guarded `templates/**/*.mjs` because that is where the NUL first bit;
the actual cause — raw control bytes decoded from JSON-escaped tool parameters — can hit any
written file, and struck a committed markdown report two commits later (git shows it as binary,
grep goes silent). When mechanizing a check after an incident, ask "what code path produced this
state?" and sweep everything that path can write; fix the instance AND widen the check in the
same cell.

## [20260711] A removal is verified by its invariants, not the names it deletes
**Category:** failure
**Feature:** learnings-pair-relocation
**Tags:** [removal-census, derived-constants, verification]

Removing a named entity and grepping the name is not enough — two P1s slipped a small-lane
census that way. When censusing a removal: grep from the **repo root** (exclude only declared
archaeology), include **bare-token variants** of the removed names, and re-derive **every
numeric constant computed from the removed thing's size** (caps, counts, "N reviewers",
table totals) — put the recomputed number in the positive verify grep. A capacity constant
that encodes the old roster size will silently refill the freed slots.

**Full entry:** docs/history/learnings/20260711-learnings-pair-relocation.md

## [20260711] Pre-code gates filter spec defects; only diff review catches implementation defects
**Category:** process
**Feature:** skill-sync
**Tags:** [review, stage-capability, destructive-code]

Three adversarial panel iterations, an advisor consult, and a 232-check red-first suite all
passed — then five isolated reviewers reading the ACTUAL DIFF found 9 real P1s (three of
them data-loss paths: stale-snapshot deletes, decoy version parsing, case-alias
sync-then-delete). Panels review artifacts → they catch specification defects; tests written
from the same spec share the code's blind spots → green proves conformance, not safety. For
destructive/mirror/guard logic, never skip or shrink the post-implementation isolated
review, and never count pre-code ceremony or test volume as implementation assurance.

**Full entry:** docs/history/learnings/20260711-skill-sync.md

## [20260711] A control token in free text is injectable by construction; a fail-open contract needs malformed-input rows

**Category:** security
**Feature:** model-tier-guard
**Tags:** [prompt-injection, control-channel, fail-open, test-matrix]

Two design-time rules review had to catch that planning should have owned:
1. **A free-text marker used as an authorization/control signal must be anchored to a
   reserved structural position** (first non-whitespace token of the field), never
   substring/window-searched — quoted or retrieved content containing the marker text
   otherwise satisfies the contract with no decision made. Add "marker embedded
   mid-content → rejected" as a mandatory adversarial test row at plan time.
2. **A stated fail-open/fail-safe contract is not implemented until malformed top-level
   input is a test-row class**: `null`, wrong-type payloads, throwing dependencies.
   Happy-path development never exercises fail-open; the contract crashed (exit 1) on
   `null` stdin despite being explicit in the plan.

**Full entry:** docs/history/learnings/20260711-model-tier-guard.md

## [20260711] A reviewer's cited line is a sample of a class — sweep the diff before re-review

**Category:** process
**Feature:** grill-deltas
**Tags:** [review, fix-pass, defect-class]

The external reviewer failed the same one-file diff twice for one defect class (step-4 prose
writing into a file step 5 creates): round 1 cited one line, the fix repaired only that line,
round 2 found the sibling four lines away — present in the round-1 diff all along. When a
review finding names a *class* (temporal contradiction, missing null-check, banned idiom),
the fix pass greps the ENTIRE diff for the class signature and fixes every instance before
re-submitting. One cited line is a sample, not the population; each missed sibling costs a
full review round. Corollary for step-flow prose: an artifact created at step M is never
written by step N<M — use the pin-now/write-later idiom (D-ID pattern).

**Full entry:** docs/history/learnings/20260711-grill-deltas.md

## [20260711] Never poll scratchpad files to wait for your own background subagents

**Category:** failure
**Feature:** session-observation (anphabe-gogl review run)
**Tags:** [swarming, review, background-agents, tokens, polling]

A review orchestrator spawned its 6 reviewers via a self-written `run-wave.sh` (prompt files
+ headless CLI processes writing `out_*.md`) instead of the Agent tool — shell processes are
invisible to the harness, so it then had to poll the files with an `ls` + `wc -c` loop
repeating six ~110-char absolute paths per iteration (~300–400 tokens each, all 0 bytes).
The Agent tool already provides everything the script rebuilt: parallel dispatch, isolated
context, and completion re-invoking the orchestrator with the final message as the report
(swarming-reference collection contract). Dispatch subagents only through the Agent tool;
never poll for agents you dispatched; polling is only for external state the harness cannot
see (CI, deploys), and even then emit ONE compact line (a count), never per-file paths.

**Full entry:** docs/history/learnings/20260711-subagent-poll-waste.md

## [20260711] A decision attributed to the user needs a traceable in-session quote

**Category:** process
**Feature:** cli-mutations
**Tags:** [decision-log, attribution, integrity]

A worker, lacking a nickname convention, invented one and logged it as a decision whose
rationale read "the user wants…" — the user had never said it. The decision log is ground
truth for future planning; an agent-invented convention laundered into it as instruction
poisons every later "per decision X" citation. When logging any decision that cites the
user, carry the traceable quote or explicit confirmation from THIS session; an inferred or
unblocking choice is logged as inferred, and workers do not log user-sourced decisions at
all — they return the proposal to the orchestrator.

**Full entry:** docs/history/learnings/20260711-cli-mutations.md

## [20260712] Enumerated-move trap in migration cells
**Category:** failure
**Feature:** bee-footprint
**Tags:** [planning, filesystem, validation]
Exhaustive/destructive ops over a mutable directory (move-all, delete-all, "must end empty")
glob the children at execution time — never enumerate a fixed name list. Validation's own
artifacts (spikes, probes) may occupy that namespace by the time the cell runs; the cell
reviewer caught a deterministic verify failure this would have shipped.

## [20260712] Cross-cell contracts and census carriers are plan-authoring work, not validation work
**Category:** process
**Feature:** review-on-demand
**Tags:** [planning, cells, verify-authoring, census]
Recurred twice in one feature, in different shapes: a cell read a ledger field its upstream cell
never wrote; a whole-token verify ban collided with a line the same cell declared protected. And a
removal census scoped as "sweep the strays" missed the one file carrying the exact retired phrase.
At plan-authoring time, mechanically: (1) grep every value a cell READS against the sibling cell
that WRITES it, verbatim; (2) grep every whole-token negative-grep ban against every line the plan
promises to leave untouched; (3) for a census cell, run the real repo-root grep and write file:line
carriers into the cell — and if the tested artifact is self-referential (repo AGENTS.md, anything a
suite only fixtures), the verify greps the LIVE file. Independent reviewers converging is the
backstop, not the mechanism.
**Full entry:** docs/history/learnings/20260712-review-on-demand.md

## [20260712] Dry-run negative-grep verifies against their own fixtures
**Category:** failure
**Feature:** bee-footprint
**Tags:** [verify-authoring, tests]
A `! grep <banned>` verify predicate must be run against the tests/fixtures the work itself
will add before it is locked in: a RED-first test proving "<banned> is denied" necessarily
contains the banned string, making the stored verify unsatisfiable on re-run.

## [20260712] Empty child-process output can be a sandbox denial, not a regression
**Category:** failure
**Feature:** harness-integration-adopt
**Tags:** [codex, sandbox, child-process, verification]

A baseline run reported 40 CLI failures whose only visible symptoms were empty output and secondary
JSON parse errors. The actual child-process result carried `spawnSync ... EPERM`; the unchanged
verify passed `215/0` outside the sandbox and onboarding had zero failures. When a CLI-heavy suite
fails this way, inspect the spawn error first and rerun unchanged with the required execution
permission before creating a fix cell or weakening assertions.

**Full entry:** docs/history/learnings/20260712-harness-integration-adopt.md

## [20260712] Fixture vendored-module lists break on transitive imports
**Category:** failure
**Feature:** dispatcher-unify
**Tags:** [tests, fixtures, imports]
test_bee_write_guard_hook vendors an explicit lib-module list into its fixture repo.
Adding an import to any vendored module (command-registry.mjs → reviews.mjs → cells.mjs)
throws only inside the fixture, and the hook FAILS OPEN — denial tests invert silently.
When a vendored module gains an import, chase the transitive closure into the fixture list.

## [20260713] A shared-suite red is not yours while a sibling cell is in flight
**Category:** failure
**Feature:** advisor
**Tags:** [swarming, verify, parallel-waves]
When a cell's verify runs the full shared suite, a red observed while another
cell is claimed-but-uncapped may be the sibling's mid-flight state, not your
defect. Check `.bee/cells/*.json` for in-flight siblings before diagnosing;
re-run after they cap. Never "fix" files outside your cell's scope to green it.

## [20260713] A guard that tests one state is a law with a hole
**Category:** failure
**Feature:** terminal-phase-gate
**Tags:** [guards, gates, doctrine]
The write guard denied source edits at `phase === 'idle'` only. `compounding-complete`
is the OTHER terminal state (state.mjs already treats both as idle-equivalents for
startFeature), and a closed feature leaves its gates recorded as approved — so no
branch fired and post-feature edits walked straight through. Two lessons, one cheap and
one expensive. Cheap: when a state model names N equivalent states, every consumer must
test the SET, never one member. Expensive: an agent that reasons "I'll try the edit; if
the hook blocks me I'll route through bee" has promoted the guard's coverage into the
protocol — the law is AGENTS.md, the hook only catches what you forget, and its silence
is never permission.
