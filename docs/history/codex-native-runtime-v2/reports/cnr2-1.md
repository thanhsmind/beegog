# cnr2-1 — Docs truth cleanup: Codex DOES have hooks + trust-verify procedure

**Status:** [DONE]

**Outcome:** Replaced the three stale "Codex has no (lifecycle) hooks" claims (`INSTALL.md:120`, `README.md:434`, `docs/06-runtime-integration.md:52`) with paraphrased, accurate prose naming the 7 shipped `.codex/hooks.json` events, and added a three-state Codex hook verify procedure (trust / conditional `/hooks` review / event-specific observed evidence via `.bee/logs/tools.jsonl`) to `INSTALL.md` §4. Also updated the now-obsolete "accepted gaps ... if Codex grows hook support" framing in `docs/06-runtime-integration.md` to note those gaps are mechanism-present but capability-spike-pending, not absent.

**Files touched:** `INSTALL.md`, `README.md`, `docs/06-runtime-integration.md`

**Verify:** `bash -c '! grep -n "Codex has no hooks\|Codex has no lifecycle hooks" INSTALL.md README.md docs/06-runtime-integration.md && grep -qi "hooks_trusted_and_observed" INSTALL.md && grep -q "tools.jsonl" INSTALL.md && echo DOCS-CLEAN'` → `DOCS-CLEAN`

Full trace/evidence: `.bee/cells/cnr2-1.json`
