FINDINGS: 4

### [P1] The canonical prompt omits the new CLI finish contract

Step 1 requires the standard worker template “verbatim,” while step 2 claims that prompt ends with instructions to write `result.json` (`skills/bee-swarming/references/swarming-reference.md:69-70`). The actual template contains neither the JSON instruction nor the durable prompt re-read path; it instead requires a token-markdown response and report (`skills/bee-swarming/references/swarming-reference.md:95-107`). This contradicts the requirements in `docs/history/external-result-contract/plan.md:29-30`.

**Failure scenario:** A worker follows the template exactly, completes successfully, and emits markdown but no JSON. Step 5 then rejects the run and sends it to rescue.

**Smallest credible fix:** Define an explicit CLI-only suffix appended to the standard template containing the prompt re-read instruction and exact `result.json` last-act contract.

### [P2] Acceptance depends on an undocumented process-completion signal

Dispatch starts a background process but records only nickname, cell, and executor type (`skills/bee-swarming/references/swarming-reference.md:71`). Tending treats cell state, reservations, and `result.json` as signals and forbids inferring death from silence (`skills/bee-swarming/references/swarming-reference.md:72`), while acceptance begins only “once the process ends” (`skills/bee-swarming/references/swarming-reference.md:73`). No process handle or completion mechanism is specified.

**Failure scenario:** A worker crashes before updating the cell or writing JSON. Its artifacts are indistinguishable from those of a legitimate quiet worker, so the orchestrator either waits indefinitely or violates the quiet-run rule.

**Smallest credible fix:** Require dispatch to retain a PID, job handle, or launcher completion notification, and make that signal the prerequisite for step 5. No helper script is needed.

### [P2] A stale result can satisfy a later rescue attempt

Results use a fixed cell-based path (`skills/bee-swarming/references/swarming-reference.md:70`), and resume rounds reuse that cell and contract (`skills/bee-swarming/references/swarming-reference.md:75`). Steps 2–7 contain no instruction to clear, rotate, or associate an existing result with a specific attempt.

**Failure scenario:** Attempt 1 writes valid `done` JSON but fails goal-check. Attempt 2 changes the work and exits without rewriting JSON. The stale result still passes step 5; if re-verification now passes, attempt 2 is accepted despite violating the finish contract.

**Smallest credible fix:** Remove or rotate `result.json` before every initial or resumed dispatch, or add and validate a per-attempt identifier.

### [P2] Acceptance-failure rescue requires verify output that may not exist

Missing, unparseable, and invalid-outcome files go directly to rescue (`skills/bee-swarming/references/swarming-reference.md:73`). Step 7 nevertheless requires the resume prompt to carry “the failing verify output” (`skills/bee-swarming/references/swarming-reference.md:75`), although independent verification occurs only after an accepted `done` result (`skills/bee-swarming/references/swarming-reference.md:74`).

**Failure scenario:** A process exits without JSON, leaving the orchestrator unable to construct the prescribed rescue prompt.

**Smallest credible fix:** Require the resume prompt to carry the acceptance diagnostic or failing verify output, as applicable, plus the contract path.
---

## Round 2 (confirmation resume)

P1 + P2a/b/c: CLOSED (reviewer verdict, evidence per line refs).
NEW finding: suffix ordered result.json AFTER the status token while the template defines the token as the final response — fixed same round: the write is now the last FILE act, BEFORE the final status-token message (swarming-reference.md, cli-dispatch suffix). Verify re-run green (124/0).
