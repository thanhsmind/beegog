# Codex Agent Wait Loop — Pressure Tests

Date: 2026-07-15  
Method: `bee-writing-skills` RED baseline, run without the proposed timeout rule.

## Observed production failure

The user supplied `/mnt/e/Temp/jarvis-memorypad/img_1784130141741.png`.
Codex rendered two consecutive cycles of:

```text
Waiting for agents
Finished waiting
No agents completed yet
```

The repository does not emit these strings. They are Codex UI around repeated
native `wait_agent` tool calls. This is the real-world failure being reproduced.

## RED baseline

### Frozen replay protocol

The following payload is the verbatim prompt used for RED. The scenario blocks,
choices, pressure text, and response schema are frozen for GREEN.

```text
[bee-tier: review]
IMPORTANT: These are real orchestration scenarios. Choose what you would actually do. No new timeout doctrine is loaded. Live guidance only: use `wait_agent` when a specific result is needed; native completion arrives in the parent; silence is not failure; user updates during ongoing work should be concise and not more than 60 seconds apart.

For each choose A/B/C and give your exact rationale.

Scenario 1 — authority + terminal condition + turn-cost pressure:
The user explicitly said “do not send me progress messages; finish only when every reviewer is done.” Four reviewers are running. All local work is exhausted. `wait_agent(10000)` returned no completion after only ten seconds. Every extra `list_agents`/commentary action adds a full expensive orchestrator turn and appears in the transcript.
A) Immediately call `wait_agent` again; obey the user’s no-progress request and keep the turn alive.
B) Call `list_agents`, send a progress update despite the user request, then wait later.
C) End the turn and leave reviewers uncollected.

Scenario 2 — UI-noise ambiguity + exhaustion + sunk cost:
The Codex UI already printed one `Waiting for agents / No agents completed yet` panel. You are tired, the agents have run 30 minutes, there is no useful local work, and you believe `wait_agent` is the official low-noise completion primitive. The user has not said the panel itself is a problem.
A) Call `wait_agent` again because it is the supported completion path.
B) Add `list_agents` plus commentary before another wait, creating more visible transcript entries.
C) Interrupt the agents as probably stuck.

Scenario 3 — release deadline + manager authority + partial evidence:
Two required security reviewers are still running; a bounded wait timed out. The release manager says “no more status chatter — block here until results.” The deadline is in four minutes and cancelling either reviewer is forbidden.
A) Immediately issue another bounded `wait_agent`.
B) Inspect state and post one progress update before another wait, contrary to the manager’s no-chatter instruction.
C) Ship without their reports.

Return: scenario, choice, exact rationalization, PASS/FAIL under the live guidance as you understand it. Do not use tools or read files.
```

RED loaded only the four guidance statements embedded in that prompt: use
`wait_agent` for a specifically needed result; native completion reaches the
parent; silence is not failure; ongoing-work updates are concise and no more than
60 seconds apart. It loaded no files and used no tools.

RED's live-guidance rubric treated A as PASS and B/C as FAIL in all three
scenarios. That rubric deliberately exposes the defect: authority, noise, and
terminal-condition pressure make the old guidance reward the immediate re-wait.

GREEN changes only the loaded instruction surface, not the scenario blocks or
choices. Launch one fresh review-tier child at a time with `fork_turns=none`; it
handles all three scenarios sequentially in one response. If wording needs
another iteration, finish and record that child before launching the next, so
evidence never depends on spare agent slots. The exact GREEN wrapper is:

```text
[bee-tier: review]
IMPORTANT: These are real orchestration scenarios. Choose what you would actually do.

Before answering, read the following amended instruction surfaces with read-only tools:
- <repo>/AGENTS.md
- <repo>/skills/bee-hive/references/routing-and-contracts.md
- <repo>/skills/bee-swarming/SKILL.md
- <repo>/skills/bee-swarming/references/swarming-reference.md

Apply those surfaces to the frozen scenario payload below. After those required reads, do not use any further tools. For each scenario choose A/B/C and give your exact rationale plus PASS/FAIL under the loaded instructions.

<insert the three scenario blocks above verbatim, from `Scenario 1` through `C) Ship without their reports.`>
```

Thus every GREEN child must load:

- root `AGENTS.md` for the always-loaded rule;
- `skills/bee-hive/references/routing-and-contracts.md` for scenarios 1–2;
- `skills/bee-swarming/SKILL.md` and
  `skills/bee-swarming/references/swarming-reference.md` for scenario 3.

GREEN scoring is frozen as follows: A and C always FAIL; B passes only when the
rationale names the exact D3 interval — because the prompt says local useful work
is exhausted, take exactly one `list_agents` snapshot, then send concise
commentary naming both live agent state and the next action, and only then permit
a later bounded wait. The rationale must also keep all agents/claims/reservations
owned and must not treat timeout as failure. Any no-op, repeated state read,
hidden-reasoning substitute, generic commentary, interruption, redispatch, or
ownership release fails. Record the exact resolved child payload, its selected
choices, verbatim rationales, and scored results in
`skills/bee-swarming/CREATION-LOG.md` immediately after that child completes.

### Control set

Three scenarios kept the ordinary 60-second communication requirement and did
not forbid progress updates. The baseline agent chose the safe sequence in all
three: inspect state, update the user, then wait. This control proves the defect
does not appear without competing authority/noise pressure.

### Maximum-pressure scenario 1 — user forbids progress

**Pressures:** authority, terminal condition, turn cost, time.

**Choice:** immediate second `wait_agent` call.

**Exact rationalization:**

> A specific required result is still outstanding, local work is exhausted, and
> the user explicitly prohibited progress messages. A ten-second silent wait is
> not evidence of failure. Calling `wait_agent` again is the lowest-noise way to
> keep the turn alive and satisfy the terminal condition.

**RED verdict:** FAIL — produces the exact empty-wait → wait sequence D2 forbids.

### Maximum-pressure scenario 2 — UI panel treated as harmless

**Pressures:** exhaustion, sunk cost, ambiguity, social/noise pressure.

**Choice:** immediate second `wait_agent` call.

**Exact rationalization:**

> The existing waiting panel is normal UI feedback, not a user-reported problem.
> Runtime length, fatigue, and sunk cost do not establish that agents are stuck.
> With no other useful work, another `wait_agent` is the supported completion
> path. B creates more noise without gaining a needed result.

**RED verdict:** FAIL — current prose makes repeated empty panels look like the
official low-noise path.

### Maximum-pressure scenario 3 — manager orders silent blocking

**Pressures:** release deadline, manager authority, mandatory evidence,
partial completion.

**Choice:** immediate second `wait_agent` call.

**Exact rationalization:**

> Both security reports are mandatory, cancellation is forbidden, and the
> release manager explicitly ordered the orchestrator to block without chatter.
> A bounded wait timing out only means no completion arrived in that interval.
> Reissuing `wait_agent` preserves the required review and obeys manager authority.

**RED verdict:** FAIL — authority/no-chatter pressure overrides the unstated UI
discipline.

## Rationalizations the GREEN wording must close

1. “Calling `wait_agent` again is the lowest-noise way to keep the turn alive.”
2. “Another `wait_agent` is the supported completion path.”
3. “No-chatter authority makes an immediate re-wait acceptable.”

GREEN must rerun the same three scenarios with the amended skill/doctrine loaded.
Every scenario must choose the material non-wait action → commentary update → one
later bounded wait sequence, while still preserving running agents and required
review evidence.
