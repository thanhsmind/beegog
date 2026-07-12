# Security review — codex-runtime-parity (range 088fcd8..HEAD)

Scope reviewed: `hooks/bee-write-guard.mjs` (apply_patch target parser), `hooks/adapter.mjs`
(fail-open stdin/root boundary), `.bee/bin/lib/guards.mjs` (checkWrite/checkRead), the
deny-on-unprovable rule, `.bee/bin/lib/state.mjs` + `.bee/bin/bee_state.mjs` (startFeature and
the `set` verb), and the isolated-CODEX_HOME acceptance test.

Overall the guard is well-constructed and fails **safe** (deny) in the directions I probed:
path traversal, absolute paths, empty/whitespace targets, unknown verbs, CRLF, and
non-canonical whole-patch forms all deny via the deny-on-unprovable rule; JSON prototype-
pollution shapes do not pollute the global prototype; startFeature reads every precondition
before its single write, so a refusal makes zero mutations. Findings below are the residual
gaps.

**Count: 5 findings — P1: 0 | P2: 1 | P3: 4**

---

## F1 — `set --feature` lets gate approvals survive a feature switch (defeats startFeature's headline guarantee)

- **Severity:** P2 (real risk)
- **autofix_class:** manual
- **Plain-language:** This diff adds `startFeature`, whose stated promise is "a new feature can
  never inherit approvals" — it atomically resets all four gates when the feature changes. But
  the pre-existing, still-active `set` verb changes the feature string with none of those
  guards and without touching the gates. An agent can switch features the unguarded way and
  carry `execution`/`review` approvals into new work.
- **What the code does today:** `runSet` → `.bee/bin/bee_state.mjs:163-165`:
  ```
  if (flags.feature !== undefined) {
    state.feature = String(flags.feature);
    changed.push(`feature=${state.feature}`);
  }
  ```
  writes state with `approved_gates` untouched. `checkWrite` (guards.mjs:117) then honors
  `state.approved_gates.execution === true` for the NEW feature. The `set` invocation itself is
  allowed by the write-guard (running `node .bee/bin/bee_state.mjs ...` via Bash passes; proven
  by test_write_guard row5).
- **Failure scenario:** In a gated phase (e.g. `validating`) with `execution` approved for
  feature A, run `bee_state.mjs set --feature B`. State now reads feature B, phase validating,
  execution=true. Source writes for feature B are permitted with no fresh Gate-3 approval —
  exactly the inheritance startFeature exists to prevent.
- **Location:** `.bee/bin/bee_state.mjs:163-165` (vs `.bee/bin/lib/state.mjs:451` startFeature).
- **Smallest fix:** Make `set` reject `--feature` (route every feature change through
  `start-feature`), or, if `set` must keep it, reset `approved_gates` to all-false whenever
  `flags.feature` changes — mirroring startFeature.

---

## F2 — Oversized stdin makes `readHookContext` throw (violates "NEVER throws"); an intercepted apply_patch then fails open

- **Severity:** P3 (real but impractical to trigger)
- **autofix_class:** gated_auto
- **Plain-language:** The adapter promises it never throws and normalizes "multi-MB payloads".
  The final `Buffer.concat(...).toString("utf8")` is OUTSIDE the try/catch, so a stdin larger
  than V8's max string length (~512MB) throws, the exception escapes `readHookContext`, and —
  because wrappers call it before their own try block — the hook exits non-zero (fails open).
- **What the code does today:** `hooks/adapter.mjs:148-158`:
  ```
  async function readRawStdin() {
    const chunks = [];
    try {
      for await (const chunk of process.stdin) { chunks.push(chunk); }
    } catch { return ""; }
    return Buffer.concat(chunks).toString("utf8");   // <-- outside try
  }
  ```
  In `bee-write-guard.mjs:114` `const ctx = await readHookContext(HOOK_NAME);` runs before the
  `try` at line 125, so a throw becomes an unhandled rejection → non-zero exit → Claude/Codex
  treat it as a non-blocking error and the tool proceeds.
- **Failure scenario:** An `apply_patch` whose `input` field carries a >512MB body containing
  `*** Begin Patch` never reaches the intercept/deny-on-unprovable logic (item 3 of the brief):
  `readRawStdin().toString` throws first, the guard fails open, and the patch is applied
  unchecked. Requires ~half a gigabyte of model output, so real-world likelihood is very low.
- **Location:** `hooks/adapter.mjs:157`.
- **Smallest fix:** Move `Buffer.concat(chunks).toString("utf8")` inside the try (return `""`
  on throw), or cap total bytes read and treat overflow as malformed-payload → `{}`.

---

## F3 — `DIRECT_EDIT_DENY[normalized]` walks the prototype chain: repo files named `constructor`/`toString`/etc. are spuriously denied

- **Severity:** P3 (cleanup; fails closed, no breach)
- **autofix_class:** gated_auto
- **Plain-language:** The direct-edit deny does a bare bracket lookup on a plain object, so
  inherited `Object.prototype` keys resolve truthy. A repo-root file whose normalized path is
  exactly `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, or
  `__proto__` is treated as CLI-owned and blocked with a garbage FIX message.
- **What the code does today:** `guards.mjs:84`:
  ```
  const directEditVerb = DIRECT_EDIT_DENY[normalized];
  if (directEditVerb) { return { allow:false, kind:'direct-edit', reason: ... use ${directEditVerb} ... }; }
  ```
  Verified empirically: `DIRECT_EDIT_DENY["constructor"]` → `function` (truthy),
  `["toString"]`/`["valueOf"]`/`["hasOwnProperty"]`/`["isPrototypeOf"]` → truthy functions,
  `["__proto__"]` → truthy object. So `directEditVerb` is truthy and the write is denied with
  reason `...use function Object() { [native code] } instead...`.
- **Failure scenario:** `Write` to a top-level file literally named `constructor` (no dir, no
  extension) is denied as "CLI-owned" with an incoherent message. Direction is fail-closed
  (spurious deny), so it is a correctness bug, not a bypass. Filename is rare in practice.
- **Location:** `.bee/bin/lib/guards.mjs:84`.
- **Smallest fix:** Guard with `Object.hasOwn(DIRECT_EDIT_DENY, normalized)` before use, or make
  `DIRECT_EDIT_DENY` a `Map` / null-prototype object.

---

## F4 — apply_patch reservation enforcement fails open when agent identity is absent (Codex parity gap on the new path)

- **Severity:** P3 (advisory)
- **autofix_class:** advisory
- **Plain-language:** During `swarming`, `checkWrite` only runs the reservation-conflict check
  `if (agent)`. For an intercepted `apply_patch` the only identity sources are payload keys
  (`agent_name`/`agentName`/`agent_nickname`/`subagent_type`) or the `BEE_AGENT_NAME` env var —
  there is no command string to sniff (unlike Bash). If a Codex worker's apply_patch payload
  carries none of those keys and the env var is unset, reservation conflicts are NOT enforced
  and the write is allowed anywhere.
- **What the code does today:** `guards.mjs:131-148` gates the whole reservation check on
  `const agent = agentName || process.env.BEE_AGENT_NAME || null; if (agent) {...}`.
  `inferAgentName` (bee-write-guard.mjs:60-76) has no command fallback on the apply_patch path.
- **Failure scenario:** Two Codex workers swarming; worker B's apply_patch (no `agent_name` in
  payload, no `BEE_AGENT_NAME` in its env) writes over a path reserved by worker A with no
  conflict denial. Same fail-open exists for Bash/Edit without identity, but the apply_patch
  path is new here and has the weakest identity extraction (no command to parse).
- **Location:** `.bee/bin/lib/guards.mjs:132-133`; `hooks/bee-write-guard.mjs:60-76,155`.
- **Smallest fix (advisory):** Ensure bee sets `BEE_AGENT_NAME` in every Codex worker env, and/or
  document that reservation enforcement on the Codex apply_patch path depends on that env var;
  consider logging a coverage-gap when a swarming write is evaluated with no resolvable agent.

---

## F5 — apply_patch target grammar is a hardcoded strict regex; a more-lenient real/future Codex parser is a parser-differential hole

- **Severity:** P3 (advisory; no live exploit provable from this repo)
- **autofix_class:** advisory
- **Plain-language:** The guard recognizes file operations only via
  `/^\*\*\*\s+(?:Add File|Update File|Delete File|Move to):\s*(.+?)\s*$/` with exact verb
  casing and the marker `*** Begin Patch` as an exact substring. I verified it REJECTS leading
  whitespace, leading tab, lowercase verb (`add file`), double-spaced verb (`Add  File`), and
  `***Add File` (no space). That is safe when a whole patch is non-canonical (deny-on-unprovable
  fires). The residual risk is a MIX: one canonical target that parses, resolves in-repo, and
  passes `checkWrite`, alongside a sibling file-op line in a form the guard does not recognize
  but the real apply_patch tool DOES apply — the unrecognized target is then written unchecked.
- **What the code does today:** `hooks/bee-write-guard.mjs:82` (`PATCH_TARGET_RE`), `:89`
  (`value.includes("*** Begin Patch")`), `:96-111` (line-independent scan), `:176` (deny only
  when `targets.length === 0 || relPaths.length < targets.length`). If ≥1 target parses and all
  parsed targets resolve+pass, no deny — so any target the regex missed is never `checkWrite`-d.
- **Failure scenario:** A patch with `*** Add File: docs/ok.md` (parses, allowed) plus a
  file-op header in a whitespace/marker variant the real Codex parser accepts but this regex
  misses → the second file is written with no gate/reservation/direct-edit check. Cannot be
  confirmed against the documented canonical format from this repo alone; depends on the real
  Codex apply_patch grammar's leniency.
- **Location:** `hooks/bee-write-guard.mjs:82,89,96-111,176`.
- **Smallest fix (advisory):** Pin the grammar to Codex's documented apply_patch spec and add a
  live-fire fixture that fails if the real `codex` CLI accepts a file-op line form this regex
  does not parse (co-locate with the isolated-CODEX_HOME acceptance rows in
  hooks/test_hook_contracts.mjs).

---

### Checked and clean

- **Prototype pollution via stdin:** `JSON.parse('{"__proto__":{...}}')` creates an own
  property, not global pollution; array/null top-level → `{}` with a logged `malformed-payload`
  gap (adapter.mjs:176-186). No allow↔deny flip observed.
- **Log-write failures never flip a decision:** `appendHookLog` swallows all errors
  (adapter.mjs:111-119); asserted by the two `log-write-failure-*` contract rows.
- **startFeature partial mutation:** every precondition (phase, HANDOFF, workers, active
  reservations, claimed cells, prior-feature nonterminal cells) is read before the single
  `writeState` (state.mjs:462-529); a refusal throws with zero writes. Malformed `reserved_at`
  → NaN → reservation counts as active (fail-closed).
- **Secrets / isolated-CODEX_HOME:** the acceptance rows override `CODEX_HOME` to a fresh
  `mkdtemp` dir and `rmSync` it in `finally` (test_hook_contracts.mjs codex-acceptance block);
  they never read `auth.json`/`.env`. No credential or env value is logged by the new code
  (crash/coverage-gap logs carry only error stacks and truncated detail strings).
