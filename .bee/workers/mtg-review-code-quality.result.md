OUTCOME: done

FINDINGS

## P2 - Fail-open does not cover malformed top-level payloads

- Evidence: `hooks/bee-model-guard.mjs:34` returns any valid JSON value, but `hooks/bee-model-guard.mjs:105-106` immediately dereferences `payload.cwd` and calls `findRepoRoot` before the guarded block begins at line 120. `hooks/bee-model-guard.mjs:41` also passes the value directly to `path.resolve`.
- Failure scenario: valid JSON such as `null`, or an unrecognized payload with an object-valued `cwd`, throws before the catch. The hook exits with an uncaught error instead of the D2-required exit 0 fail-open behavior, and the crash is not recorded by `logCrash`.
- Smallest credible fix: normalize the parsed payload to a plain object and accept `cwd` only when it is a string, or move payload/root resolution inside the existing try/catch; add cases for `null`, arrays, and non-string `cwd`.

## P2 - The declared `Task` compatibility path is untested at both enforcement and onboarding seams

- Evidence: `hooks/bee-model-guard.mjs:19` declares both `Agent` and `Task`, while every dispatch case in `hooks/test_model_guard.mjs:124-233` uses `Agent` (apart from the non-dispatch `Edit` case at lines 212-214). The onboarding assertion at `skills/bee-hive/scripts/test_onboard_bee.mjs:399-410` only searches serialized settings for the hook filename; it does not assert the `Agent|Task` matcher or that the command is under `PreToolUse`.
- Failure scenario: a later edit can drop `Task` from the runtime set or wire the hook under the wrong matcher/event while both suites stay green, allowing legacy bare `Task` dispatches to inherit the ceiling model silently.
- Smallest credible fix: add bare-deny and explicit-tier allow cases using `tool_name: "Task"`, and structurally assert a `PreToolUse` entry whose matcher is `Agent|Task` and whose command names `bee-model-guard.mjs`.

## P3 - Active guidance still states the superseded ceiling transport without its marker

- Evidence: `docs/decisions/0015-ceiling-is-the-session-model.md:3` says omission alone no longer expresses ceiling, but line 19 still says omitting `model` makes a ceiling cell run on the session model. Likewise, `skills/bee-swarming/references/swarming-reference.md:39` says to omit `model`, and line 50 describes `inherit` only as omitting it; the required marker is deferred until line 52.
- Failure scenario: a maintainer or agent following the concise tier bullet or `resolveTier` description emits a bare ceiling dispatch and is denied, despite following apparently operative documentation.
- Smallest credible fix: amend each old transport sentence inline to say “omit `model` and add `[bee-tier: ceiling]`,” rather than relying on a later amendment note.

## P3 - The hook test leaks all temporary fixture repositories

- Evidence: `hooks/test_model_guard.mjs:37` creates fixtures with `fs.mkdtempSync`; lines 114-116 create three of them on every run, and execution reaches the file end at line 239 without a cleanup block.
- Failure scenario: repeated local or CI runs accumulate full copied `.bee/bin/lib` fixture trees under the system temp directory, creating avoidable disk and debugging noise.
- Smallest credible fix: retain the fixture paths and remove them with `fs.rmSync(path, { recursive: true, force: true })` in a `finally` block.

SUMMARY
2 P2 findings: malformed top-level payloads escape fail-open handling, and the promised `Task` path lacks regression coverage.
2 P3 findings: superseded ceiling guidance remains contradictory, and the test fixtures are never cleaned up.
