# Validation — gate-bypass-stop-net slice 1 (gbsn-1)

Verdict: READY. Gate 3 auto-approved under gate_bypass=total.

## Reality gate
- MODE FIT: standard (3 flags), single cell — fit.
- REPO FIT: encodeAdvisory→encodeBlock parallel (adapter.mjs); shouldInject/markInjected
  already power interval-deduped injection (inject.mjs:318); bypassLevel normalizes
  off/normal/full/total (state.mjs:1009). All reused, none invented.
- ASSUMPTIONS (verified): a Stop-event {decision:"block",reason} CONTINUES the turn on both
  Claude and Codex — adapter.mjs:341-344 documents this precisely (the reason it was avoided
  for advisories is exactly the behavior we want here). shouldInject 30-min interval bounds
  the loop-guard.
- SMALLER PATH: none — minimal targeted net.
- PROOF SURFACE: hooks/test_bypass_stop_net.mjs + test_hook_contracts + test_gate_bypass_doctrine.

## Structural check
- Cell gbsn-1 files bounded (adapter.mjs, bee-session-close.mjs, new test); verify runnable.
- Prohibitions pin the two real hazards: PreCompact/SubagentStop never block; advisory path
  survives when the net does not fire.
