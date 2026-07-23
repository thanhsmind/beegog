# Advisor consult — compaction-hardening, pre-Gate-3 (revision 3)

Advisor: fable (`models.claude.advisor`). Read-only. Evidence bundle: CONTEXT.md, plan.md,
`reports/validation-slice1.md`, cells cz-1..cz-8. No session history supplied.

**Verdict: converging, execution-worthy after two cheap repairs — one record-of-truth gap
(D23-D26 absent from CONTEXT.md) and one genuinely missed contract hole (the capsule drops
`handoffOutcome`, silently losing the adoption-refused line on compact).**

## 1. Converging or accreting?

Converging. Every load-bearing measured claim in the cells resolves against the tree: the
unconditional registry-coverage gate (`test_bee_cli.mjs:2558-2563`); the `state` Use-list
(`bee.mjs:4830`), dispatch map (`:4990-4996`), `FLAG_ALONE_BOOLEANS` containing `json`
(`:5067`); `buildFixture` writing `phase:"swarming"` + `execution:true`
(`test_hook_contracts.mjs:240-259`), which confirms D23's claim that the PreCompact
additivity row goes red by design; `release_manifest.mjs:129-140` hashing `skills/**`, the
rendered plugin trees, and `hooks/**` — exactly D24's widened trigger; `onboard_bee.mjs:3326`
rewriting `updated_at` unconditionally; `.bee/logs/` gitignored. Revision 3 encodes
measurement, not assertion — the failure mode of revisions 1-2 is structurally addressed.

Brittleness notes: cz-2 embeds a natural-language judgement (telling a true "six toggles"
from a false "six scripts") inside a mechanical gate — the four-way derivation is right, the
prose-disambiguation half will be the maintenance cost. And the record of truth lagged the
cells: D23-D26 existed only in `.bee/decisions.jsonl`, and `plan.md` on disk was still
revision 2, while cells cited "Per D24/D25/D26" and pointed a cold worker at a CONTEXT.md
that did not contain them.

## 2. The regen obligation

Right shape. The ordering claim is load-bearing and correct: the manifest hashes the rendered
plugin trees themselves (`release_manifest.mjs:132`), so render → onboard → `--write` inside
each cell is the only sequence that does not freeze stale trees, and deferring to cz-8 would
recreate PAT37's mid-chain red baseline. Render and onboard write disjoint outputs; no
cross-command hazard. Two costs: the tracked projection copies each regen rewrites are
undeclared in cz-3..cz-7's `files` (harmless under D21 strict-serial, but one-commit-per-cell
diffs carry paths outside each cell's declared scope), and five `onboard --apply` runs mean
`updated_at` churn in every commit, acknowledged only in cz-8.

## 3. Riskiest cell

**cz-5.** Widest blast radius (13 files) and its hardest constraint is invisible until run:
the additivity row at `test_hook_contracts.mjs:2740-2780` compares a with-anchor capsule body
against a no-anchor control body, so **any** anchor-correlated byte reds a suite cz-5 is
forbidden to edit — the STATE MISMATCH line is the obvious trap, but the survival-count line
and blank-line ownership in the HANDOFF arm are the same trap. It is caught in-cell: cz-5's
own verify carries `hooks/test_hook_contracts.mjs`. Second bet: golden byte-identity breaking
on the `WRONG_SOURCE` adoption-line arm (`inject.mjs:384-386`).

## 4. What all rounds missed

**The capsule's call signature drops `handoffOutcome`, and no verify anywhere would notice.**
Measured chain: `bee-session-init.mjs:113-121` sets `{ok:false, code:"WRONG_SOURCE"}` on every
compact start where a planned-next handoff exists, and passes it to `buildSessionPreamble` at
`:144`; `inject.mjs:384-386` renders the `- Adoption not applied:` line off it. cz-5 locked
`buildCompactCapsule(root,{sessionId})` with no such parameter, and cz-6 said "emit the capsule
instead of `buildSessionPreamble`". D26 protected the extracted renderer's signature, not the
call site. Every existing row exercising compact + planned-next (`:2427-2455`, `:2864-2872`)
regexes only the WAIT heading, never the reason line — so a capsule without the parameter
passes cz-5's suite, cz-6's suite, hook contracts, and cz-8's full verify, while a compacted
session silently loses the explanation of why adoption was refused. Same defect class the two
prior rounds caught elsewhere — a guard's scope asserted rather than measured to the call site
— found a third time. D6 item 4's "HANDOFF block verbatim" is only verbatim with that line.

## Conflicts with locked decisions

None asserted as conflicts. Two supports-with-caveat: the §4 finding extends D26 to the capsule
call site (it under-implements D6 item 4 / D26, it does not contradict them); and D24/D25/D26
being absent from CONTEXT.md conflicted with that document's own amendment rule.

## Orchestrator disposition

Both repairs applied before Gate 3. D23-D27 appended to CONTEXT.md with explicit supersession
notes (D24 supersedes D20's trigger; D27 extends D26 from the renderer to the call site), and
cz-5/cz-6 updated so `buildCompactCapsule(root,{sessionId,handoffOutcome})` carries the
parameter with an asserting row in each cell. The cz-2 prose-disambiguation brittleness and the
undeclared-projection-paths churn are accepted as recorded costs, not repaired — both are
visible, neither is silent.

Advice is data, not approval: nothing here approved a gate or overrode a locked decision.

---

# Confirming consult (delta only)

Run after both repairs landed, because applying the advisor's own findings had invalidated
the ref's staleness anchors. Re-stamping without a fresh look would have been the rubber-stamp
the AO13 rule exists to prevent.

**Repair 1 (record of truth): CONFIRMED.** D23-D27 present in CONTEXT.md (`:54-58`), each with
rationale; D24's supersession of D20 reads unambiguously; plan.md is revision 3 with the "What
revision 2 got wrong" table and matches the eight cells on disk with the strictly-serial chain.
Residue: plan.md's Test Matrix and Risks tables still cite `chx-*` names — cosmetic, referents
map 1:1.

**Repair 2 (capsule dropping `handoffOutcome`): CONFIRMED.** cz-5 mandates the signature at the
builder with an asserting truth and an explicit prohibition; cz-6 mandates it at the call site
with a through-the-hook assertion and red-failure evidence required at cap. The only remaining
bypass is the residual inherent to any self-authored suite — a worker omitting both the parameter
and the mandated rows — which is the goal-check layer's job, not a hole in the repair.

**New risk opened by the repairs — one, and it was real.** The "no capsule byte varies with
anchor presence" must-have had **no named mechanism**, unlike the golden. It could not have been
caught in cz-5: `hooks/test_hook_contracts.mjs:2740-2780` drives the *hook*
(`runWrapper("bee-session-init.mjs", …)`, `:2745-2753`), which cz-6 wires — so during cz-5 that
row compares full preambles and never touches the builder. cz-5 could have capped green with an
anchor-correlated capsule, and the red would first appear at cz-6, whose `files` exclude
`compaction.mjs` and which therefore could not legally fix it. This matters concretely because
D12's sweep reports an "an anchor exists" check, so the naive STATE MISMATCH rendering varies
with anchor presence by construction.

**Disposition:** accepted and applied. cz-5's action gained STEP 4b naming the mechanism — a
paired render of the capsule against fixtures identical except for anchor presence, asserted
byte-equal, including one pair where `compactCheck` fails — and the must-have was rewritten to
require that row rather than state the aim. The plan.md `chx-*` naming residue is accepted as
cosmetic and left.

Advice only; accept/reject stayed with the orchestrator, and nothing here approved a gate.
