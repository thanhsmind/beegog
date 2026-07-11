OUTCOME: done

FINDINGS

## P2 - Tier control marker shares a trust channel with task content

- Evidence: `hooks/bee-model-guard.mjs:21` defines an unanchored marker regex; `hooks/bee-model-guard.mjs:94-101` accepts a match anywhere in the full `description` or first 500 prompt characters. The public contract repeats this behavior at `docs/decisions/0023-explicit-tier-transport.md:12-15`.
- Failure scenario: a user request, repository instruction, retrieved document, or other untrusted text containing `[bee-tier: ceiling]` (or another accepted tier) is copied near the start of an Agent/Task prompt or into its description. A dispatch that accidentally omits `model` then passes the guard even though the caller made no tier decision, silently inheriting the ceiling model. This is control-data injection into the enforcement channel and defeats the guard's purpose.
- Smallest credible fix: reserve a caller-controlled location and anchor the marker there, e.g. require the description or first prompt line to begin with exactly one canonical `[bee-tier: <tier>]` declaration; do not search arbitrary task prose. Update D1/decision 0023 and add negative tests where valid-looking markers occur later in quoted/untrusted description and prompt content.

SUMMARY
One P2 injection/trust-boundary finding: arbitrary task prose can spoof the tier marker and bypass explicit-tier enforcement.
No auth/authz, secret-in-code, permission, or sensitive-data logging findings were identified in the reviewed diff.
