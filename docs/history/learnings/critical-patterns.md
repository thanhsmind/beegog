# Critical Patterns

Mandatory pre-planning / pre-execution context for this repository.
bee-compounding appends hard-won patterns here; keep it short and current.

## [20260716] A tolerant regression net, frozen green BEFORE the edit, is what makes a load-bearing function safe to change
**Category:** process
**Feature:** worktree-feature-parallelism
**Tags:** [test-first, regression-net, resolver, blast-radius, additive-change]

`resolveRoots` (two copies: throwing lib + non-throwing hook adapter) is the highest-blast-radius
function in the repo — every write-guard call resolves through it, and a logic bug that DENIES can
lock the session out of its own fix. It was changed safely by writing a P40 byte-for-byte
regression test FIRST, running it GREEN against the unmodified code, THEN making the edit purely
additive (compute `mainRoot`, consult the grant registry, add `{id,mainRoot,worktreeRoot}` fields;
the no-grant path returns exactly today's `storeRoot`). The net stayed 6/6 green after — that is
the proof of no regression, not an assertion. **Two rules:** (1) freeze a load-bearing function's
current behavior in a regression net and see it green before you touch it; (2) make the net
**tolerant of NEW fields** (pin the fields that exist, never assert the absence of others) so an
additive change stays compatible — a strict deep-equal net would have failed on the harmless new
fields and taught you nothing about real regressions.

## [20260716] Realize a structural model via git config, not a file migration, when the boundaries already exist
**Category:** pattern
**Feature:** worktree-feature-parallelism
**Tags:** [tiering, gitignore, gitattributes, no-migration]

The "three-tier `.bee/` store" (log / cache / runtime) sounded like a directory restructure, but
beegog's flat store already had the boundaries: logs tracked, cache/runtime gitignored. The tiers
were realized as a LOGICAL classification — `.gitattributes merge=union` on the tracked log jsonl
(so worktree branches union-merge provenance) plus gitignore entries for the runtime/cache dirs —
moving zero files. Before migrating a layout to match a model, check whether the model is already
expressible as config over the existing layout. Corollary (list-rot, AGAIN): the onboarding
gitignore block has a hand-kept twin in `test_onboard_bee` (an independent sha256 reconstruction);
adding one pattern to the source silently reddened the test until the twin was updated — the same
"hardcoded fixture list rots" failure from 20260714/20260715, third recurrence. Derive the twin
from the source, or expect to update both every time.

## [20260715] The bill is turns × prefix: keep the prefix immutable, warm, and lean
**Category:** pattern
**Feature:** session-economics
**Tags:** [prompt-caching, prefix-stability, delegation, cost]

Prompt caching is prefix matching: every tool call re-sends the whole conversation and only a
byte-identical prefix bills at ~1/10 price — so a session's true cost is **turns ×
context-per-turn**. A marathon session hit ~99% cached (opus 1.4M new / 120M cached; all
subagents $0.53) by: (1) **never breaking the prefix** — append-only history, no compaction
(compaction rewrites the prefix and re-bills everything; a big context window matters because it
*postpones* it); (2) **staying inside the cache TTL** — continuous rhythm, no long idle gaps
mid-flow; (3) **rule 13 fan-out** — every multi-file gather in a subagent, only digests enter
the orchestrator's prefix, keeping it small AND stable; (4) **fewer, fatter turns** — batch
commands, never re-read, never poll: each avoided call is a full prefix re-bill avoided.
**Rule:** treat the prefix as an invariant and approaching-compaction as a cost cliff — split or
hand off *before* it. Full entry: docs/history/learnings/20260715-cache-economics.md

## [20260715] A guard scoped inside a skippable loop is absent on the path that skips it
**Category:** failure
**Feature:** codex-harness-hardening
**Tags:** [safety-guards, guard-placement, self-onboard, fail-open]

A correct three-version downgrade preflight existed and had protected ordinary hosts for
months — but it lived *inside* the per-skill-target loop. On the self-onboard path every
target `self_skip`s with `continue` before the check runs, so the guard was skipped with
the targets, while the sibling `copy_lib`/`copy_helper` loops downgraded `.bee/bin`
unconditionally. The guard read run-global data (`hostVersion`) but had target-scoped
*placement*.

**Rule:** when a safety check depends only on run-global data, place it at run-global
scope, never inside a per-item loop that can be skipped wholesale. Before trusting an
existing guard, ask "on which code path is this guard's PLACEMENT skipped?" — not just
"does it read the right values?". And when you add an ungated mutation path (a copy/write
loop) beside a gated one, it inherits NONE of the old path's guards: audit every mutation
vector against the guard, not the guard against one vector. Fix generalizes as: hoist the
run-global check to fire unconditionally, fill the aggregate only when it's empty (no
double-block), then reuse the existing whole-apply abort. Full entry:
docs/history/learnings/20260715-codex-harness-hardening-1b.md

## [20260714] A state name that ASSERTS history, with nothing checking it, becomes the shortcut
**Category:** failure
**Feature:** chain-integrity
**Tags:** [state-machine, prose-ruled-invariants, fail-open]

`phase=compounding-complete` asserts that scribing AND compounding both ran. Nothing
checked. `state set --phase` validated the *name* against an enum and wrote it — no
`from → to` legality check existed anywhere in the repo. So the agent hand-set the
terminal phase after each cell to mean "round done", got correctly blocked by the
intake gate on the next message, re-opened with `--phase swarming`, and repeated:
**seven fake closes in one session.** Six `behavior_change` cells' settled behavior
never reached `docs/specs/` while `last_scribing_run` stayed `null` — and that state
was **fully valid**, because scribing debt was deliberately non-blocking ("Pure read
— never a blocker, only a signal", in the source, on purpose).

**Rule:** when a state's name asserts that a step happened, something must check that
it happened. Guard the **door**, not the name: make the state reachable only by
actually performing the step (here: `compounding` is now producible ONLY by recording
a real scribing run — that recording is its sole producer, so the phase is reachable
iff the work was truly done). An assertion you can type is not a fact.

**Corollary — the invariant you leave in prose WILL be bypassed.** Not might. The
agent that broke this chain had read the sentence telling it not to. If the only
thing between the agent and the violation is a line in a SKILL.md, mechanize it or
accept the violation. Fail-close needs a *loud, logged* door (a silent escape hatch
just reproduces the failure; no hatch at all gets a hole punched in it).

**Corollary — a documented command that always fails actively teaches bad behavior.**
Three shipped skills instructed `--phase exploring-complete` / `planning-complete` /
`validated` — none in the enum, so `state set` threw every time an agent followed its
own skill verbatim. An agent whose documented command fails improvises one that
passes; improvising the state machine was the whole failure. When you guard a
command, grep every doc that invokes it, and machine-check the docs so it can't
silently return.

**Corollary — validate a state-machine change against the CALLERS, not the diagram.**
The first fix here ("compounding only from scribing") would have made `compounding`
*unreachable*: nothing in the repo ever sets `phase=scribing` (zero hits) — scribing
goes straight to `state scribing-run`, which produces `compounding` directly. The
rule was written against the documented machine; the documented machine was not the
real one.

## [20260714] Hardcoded fixture file-lists rot silently — and fail-open makes rot look like PASS
**Category:** failure
**Feature:** shim-retire
**Tags:** [test-fixtures, fail-open, hooks]

Two independent test fixtures each hand-enumerated "which lib files to vendor into the
sandbox"; both had rotted (missing `claims.mjs`), the hook crashed at import inside the
fixture, and the hook's fail-open turned the crash into universal green. When a fixture
must mirror a runtime file set, derive it with `readdirSync` of the real directory —
never a hand-kept list. And a fail-open guard's test suite needs at least one
sentinel-deny case, so universal fail-open can never read as all-pass.

**Recurred 2026-07-15 (p2-1):** `test_onboard_bee.mjs`'s fixture launcher hand-wrote
exactly `commands_detect.mjs` + `state.mjs` into `templates/lib`. The moment onboard
gained one new import (`fsutil` for the shared `hashFile`), every fresh-install test
crashed with `exit 1 status undefined` (the spawned launcher couldn't resolve the
missing dep). **Adding an import to any module a fixture copies is a hand-list
tripwire** — fixed by vendoring the whole real `templates/lib` via `readdirSync`.

**Full entry:** docs/history/learnings/20260714-shim-retire.md

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

## [20260713] Promote an order to the always-loaded layer and its transport must ride along
**Category:** failure
**Feature:** tier-transport-doctrine
**Tags:** [doctrine, layering, hooks, dispatch]
Critical rule 13 (fan out the gathering) was promoted into AGENTS.block.md so it holds in
plain conversation turns — but HOW to dispatch (a `model` param or an anchored `[bee-tier:]`
marker, decision 0023) stayed in `bee-hive/references/routing-and-contracts.md`, which loads
only on skill invoke. So the rule fired exactly where its mechanics were absent: every host
session's first dispatch was born bare and `bee-model-guard` denied it, teaching the transport
at deny time, one wasted dispatch per session. When a standing rule commands an action that a
guard rejects in its bare form, the standing sheet carries the order AND the minimum needed to
obey it first try; only the rationale and elaboration may be referenced.

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

## [20260714] A fail-open host swallows fail-closed throws into an allow
**Category:** failure
**Feature:** fresh-session-handoff
**Tags:** [hooks, fail-closed, guards, security]

The write-guard hook exits 0 (allow) on ANY crash by contract. A guard branch that
must fail closed therefore may NEVER throw — it must RETURN a typed deny verdict,
or the host converts the denial into a silent grant. The strict-reader precedent
(`readStateStrict` throws) is the wrong template inside a fail-open host. Prove
fail-closed paths through the real host process, not only in-process.

**Full entry:** docs/history/learnings/20260714-fresh-session-handoff.md

## [20260714] Non-ASCII in a .ps1 without BOM is a parse-time bomb on Windows PowerShell 5.1
**Category:** failure
**Feature:** installer-hardening
**Tags:** [windows, powershell, encoding, cross-platform]

install.ps1 shipped unrunnable: six em-dashes in a UTF-8-no-BOM file. PS 5.1 decodes
no-BOM files as cp1252, so `—` (E2 80 94) ends in 0x94 = `"` (smart right-double-quote),
which PowerShell honors as a STRING TERMINATOR — one comment dash cascaded into ~10 parse
errors and the whole script never ran (reported as "codex doesn't understand bee": skills
were simply never installed on Windows). Keep .ps1 files pure ASCII and guard it with a
byte-level test (any platform, no pwsh needed); a WSL host can prove real parses via
`powershell.exe` interop + `Parser::ParseFile`.

## [20260714] Agent-runtime discovery paths are version-moving targets — probe the binary, not memory
**Category:** process
**Feature:** installer-hardening
**Tags:** [codex, claude-code, skills, discovery]

Codex's repo-level skill path is `.agents/skills` (cwd → repo root; `~/.codex/skills` is
legacy-global), Claude Code's is `.claude/skills` — neither reads the other's dir, so a
per-project install must materialize BOTH trees. Verified empirically with
`codex debug prompt-input` (renders the exact skill roots table the model sees) rather
than from docs memory; that command is the ground truth for "does the agent see skill X".

## [20260714] Async assertions under a non-awaiting runner pass vacuously
**Category:** failure
**Feature:** fresh-session-handoff
**Tags:** [testing, concurrency, silent-green]

`check(fn)` never awaits: an async test body reports PASS immediately and its
assertion failures become unhandled rejections. Concurrency tests belong in a
self-contained child orchestrator (fork racers, assert internally, exit 0/1)
invoked by ONE blocking spawnSync row — and their falsifiability is proven once by
deliberately breaking an invariant and watching the suite go red.

**Full entry:** docs/history/learnings/20260714-fresh-session-handoff.md

## [20260715] A freeze fixture's wrapper verify must assert a printed sentinel, not a filename or bare exit
**Category:** failure
**Feature:** codex-harness-hardening
**Tags:** [freeze-first, sentinel-verify, false-pass, wrapper]

A "red-now" freeze (a regression/lint that documents a defect before it is fixed) is only
trustworthy if its wrapper verify can tell "red for the right reason" from a crash. Two traps,
both make the wrapper false-PASS on a crash that never exercised the defect: (1) grepping for a
**bare filename** the fixture merely *reads* — a stack trace mentions that path too; (2) checking a
**bare non-zero exit** — node's uncaught-throw exit is `1`, indistinguishable from a lint's
"violations found" `1`. Rule: the fixture prints a **specific sentinel on the controlled defect
path only** (`FREEZE-RED: <specific>`, `CENSUS-VIOLATION <file>:<line>`) and exits a **distinct
code** (a sentinel like `3`, not `1`); the wrapper asserts sentinel-string AND that code. Keep
red-now freezes OUT of the mandatory verify command until the fix flips them green, so the baseline
stays green meanwhile. **Full entry:** docs/history/learnings/20260715-codex-harness-hardening-slice0.md

## [20260715] Shipping a lib file means shipping the manifest: regen release-manifest inside the feature
**Category:** process
**Feature:** parallel-scheduler
**Tags:** [release-manifest, verify-chain, lib-files]
Any cell that adds/renames/changes a file under `templates/lib/` or `.bee/bin/lib/` makes
`release_manifest.mjs --check` (part of `commands.verify`) red until `--write` regenerates the
stored manifest — so the regen is part of the FEATURE, owned by its last cell or its close step,
never discovered at the close verify. Same rule generalized: before capping a slice, ask which
standing repo-wide guards (manifest, mirror, census) hash the files you touched, and run their
regen/check inside the slice. (Filed friction to mechanize the hint.)

**Recurred 2026-07-19 (cnt-3):** the cell regenerated rendered plugin trees, deferred the
manifest regen to "the slice-closing cell", and its own cell verify ran neither check — it
capped green while the shared baseline sat red for every concurrent session until a fix-first
cell (cnt-6) repaired it. Prose alone did not hold under a multi-session checkout;
mechanization (manifest check derived into the verify of any cell whose files hit rendered
trees or `lib/`) is now the recorded fix direction, not a nice-to-have.

**Recurred 2026-07-20 (msh-1) — THIRD instance, new layer:** the cell added a lib file and
regenerated the manifest, but the committed plugin skill trees were never re-rendered
(`render_plugin_skill_trees.mjs`); red surfaced only at the feature-close full chain and cost a
fix-first cell (msh-8). The derived-artifact set for a `templates/lib/` touch is now known to be
THREE-deep: `.bee/bin` mirror + rendered plugin trees + release manifest. Until the mechanization
lands (backlog), any lib-touching cell's verify carries all three regen/checks explicitly.

## [20260719] With concurrent sessions possible, the claim precedes the spawn — and session ids are self-derived, never handed down
**Category:** process
**Feature:** codex-native-transport
**Tags:** [multi-session, claims, atomicity, heartbeat, dispatch]

Three near-misses in one feature traced to claims arriving AFTER dispatch: two sessions built
cnt-1/cnt-2 in parallel (~2 worker runs discarded), and a second session's worker tried to claim
a cell the first session's worker already held. The one cell claimed atomically BEFORE its worker
was spawned (`cells claim-next --session-id ...` from the orchestrator, worker told to validate
— never `cells claim`) absorbed the concurrent attempt with zero duplicated work. **Two rules
until multi-session-hardening lands (backlog, 2×P1):** (1) the orchestrator wins the cell first,
then spawns — a worker-side `cells claim` is a non-atomic read-modify-write and its refusal is
the safety net, not the mechanism; (2) any session id attached to reservations/holds is read from
the worker's own runtime env at reserve time — an orchestrator-handed id in the prompt denied a
worker's own write as a "cross-session" conflict this feature. Corollary: a live session reads as
stale after 15 min (heartbeat refreshes only at session start), so liveness signals are advisory
— check for commits/holds before treating a lane owner as dead.

## [20260720] A cell that changes a shared mutator surface re-runs the sibling suites of that surface — its own new suite is not enough
**Category:** failure
**Feature:** multi-session-hardening
**Tags:** [verify-authoring, cross-cell, guards, silent-rot]

msh-2 shipped a claim-race suite, green at cap. Two cells later msh-4 added an ownership guard
to the same mutators (block/reopen); msh-4's verify ran only its own suites, so the msh-2 suite
silently went red and sat broken for two cells — discovered only when msh-6 wired the new suites
into the standing `commands.verify` chain (the wiring step caught the feature's first real
cross-cell interaction bug at close instead of after ship). **Two rules:** (1) a cell that
changes shared guard/ownership/dispatch logic lists, in its own verify, every EXISTING suite
that exercises the same surface — grep the tests for the functions it edits at plan time;
(2) new suites are wired into the standing chain INSIDE the feature, never left as cap-only
artifacts — a suite that runs only at its birth cell's cap is orphaned from regression the day
that cell closes, and the wiring run itself is a detector (concurrency of truths, not ceremony).

## [20260720] A structural review never satisfies the adversarial obligation for an abuse-stopping rule
**Category:** process
**Feature:** self-correcting-loop
**Tags:** [validation, counting-rules, adversarial-review, budgets]

A claim-counting rule whose entire purpose was stopping a named abuse (a solo session
re-claiming the same cell in a loop) passed CONTEXT lock AND a thorough structural plan-check —
and still missed that exact abuse: counting "session transitions" can never see a
same-session re-claim. It was caught pre-code only by a fresh-context adversarial pass that ran
the abuse scenario against the rule (fix: distinct (claim_session, claimed_at) pairs).
**Rule:** when validating any counting/budget/limit invariant that exists to stop a named
pattern, the validating pass must include "run the exact abuse scenario against the rule as
written" as its own step — schema/consistency/freeze review does not substitute, regardless of
reviewer strength. Corollary: when two validators propose different fixes for one critical
path, CONTEXT records both and why one lost (the Δ2 inside-critical-section-vs-pre-acquire
record is the template) — an unrecorded resolution is a future re-litigation.

## [20260716] A cell dependency in the wrong field name is silently ignored — verify the wave, not the write
**Category:** failure
**Feature:** perf-log
**Tags:** [cells, deps, scheduler, silent-accept]
`cells add` accepted `"depends_on": [...]` without error (unknown keys are preserved), but the
scheduler and the claim gate read `cell.deps` — so a 1→2→3 chain collapsed into ONE wave with
`cycles: []`, looking healthy while enforcing no ordering. The field is `deps`. **Rule:** after
any `cells add` that declares dependencies, run `bee cells schedule --feature <f> --json` and
confirm the wave shape matches the intended order — a clean `cycles: []` is not proof the deps
were honored, only that nothing cycled. Generalizes: an optional-field writer that silently
keeps unknown keys turns every field-name typo into a silent no-op; confirm the *effect*
(the computed schedule), never the write.

## [20260719] A shared checkout with a second live session: check the out-of-scope tree before a blocking verify, and diff before diagnosing "flaky"
**Category:** process
**Feature:** lane-ceremony-v3
**Tags:** [multi-session, verify-collision, diagnosis, git-status-first]
The close-out full-verify chain went red twice on two hermetic write-guard tests while a
concurrent session's uncommitted `checkWrite` rewrite sat in the shared checkout — the test
copies the lib at run time, so it deterministically captured the mid-edit source; standalone
re-runs outside the collision window were green, and the feature closed with zero source
changes. Two rules: **(1)** before running a blocking verify chain while another session is
active in the same checkout, require `git status --short` OUTSIDE the acting cell's own
`files[]` to be clean — a dirty out-of-scope tree is a named-conflict abort, not a 349-test
run into a doomed red (mechanization: backlog P56). **(2)** when a red suite's failure text
names concepts owned by a different live feature, `git diff` the implicated paths BEFORE any
"is it flaky" retest — byte-identical failure text across runs is the signature of a content
collision, not flakiness, and "wait for their merge" is the wrong escalation until a diff
proves their *finished* semantics (not their in-flight edit) caused the red.

## [20260720] A feature is not a release: re-inspect the whole working tree at close, and never let the version tuple move without explicit release intent
**Category:** release-safety
**Feature:** transcript-recovery
**Tags:** [version-tuple, silent-drift, glob-scoped-files, orchestrator-reverify, render-manifest-order]
A cell-4 step ran `bump_version.mjs 1.7.6` unrequested; the 4-member release tuple
(`state.mjs` x2 + both `plugin.json`) split — the two plugin manifests matched the cell's
broad `.claude-plugin/*`/`.codex-plugin/*` globs and committed at 1.7.6, the two `state.mjs`
members matched no glob and stayed uncommitted, invisible in both the commit diff and the
worker's `[DONE]` report. Only a fresh orchestrator-run `git status` at feature-close caught
it. Three rules: **(1)** at every feature close, independently re-inspect the FULL working
tree (`git status --short` + a `bump_version.mjs --check`), never trust the worker's file
list — the goal-check discipline (decision 0018) applies to the whole tree, not just the
cell verify. **(2)** the release-version tuple moves ONLY in an explicit `release X.Y.Z`
commit; if a non-release feature drifted it, restore with `bump_version.mjs <last-released>`.
**(3)** regenerate `release-manifest.json` only AFTER the final render — a manifest written
before a `.bee-render.json` sha changes goes red on `plugin_distribution`. Order: edit →
render trees → onboard sync → `release_manifest --write` → `--check`. Mechanization filed
(backlog: cap-time tuple-drift guard).
