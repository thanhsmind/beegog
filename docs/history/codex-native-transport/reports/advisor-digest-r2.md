# Advisor digest r2 — codex-native-transport (second consult, session 6d0892b6)

Advisor: fable (ceiling). 2026-07-19, after taking over from the stale prior
session. Verdict: GO-WITH-CONDITIONS. The prior consult's fold (plan.md
§Advisor conditions) stands; this consult ADDS the deltas below (full
verbatim text retained in session transcript; deltas are what changes cells):

- **Δ1 (→ cnt-1): validateModelsConfig false-flags the new shapes.**
  `looksLikeCli = 'kind' in value || 'command' in value` (state.mjs:366)
  makes `{kind:'native'}` emit bogus `cli-malformed`; the composite falls to
  the :414 `model-shape-malformed` branch. Insert explicit native + composite
  acceptance branches BEFORE :366 with their own reject codes — the resolver
  branches alone are not enough; the validator is a separate consumer.
- **Δ2 (→ cnt-2): classification record is a SEPARATE gitignored file, never
  doctor-attest.json.** The trust attest's 3 legs (hooks sha / codex version
  / repo identity) cannot see codex config.toml changes — a toggled-off
  multi_agent_v2 would leave a native_model_override verdict "valid".
  The classification record needs a 4th validity leg: a hash over the
  relevant codex feature/config scope (features.multi_agent_v2,
  hide_spawn_agent_metadata, tool_namespace) captured at probe time;
  config change invalidates, not just version change.
- **Δ3 (→ cnt-4): fail-open direction of the route-check.** The config read
  inside the hook must be wrapped in its own try/catch returning noOpinion()
  (audit/economics still log); deny fires ONLY when the read succeeded AND
  override fields genuinely mismatch. A read error is an allow-hole by
  design (defense-in-depth), never a deny-storm. No-override spawns keep the
  exact marker-only path — freeze those rows before editing.
- **Δ4 (WAIT semantics): cnt-4's CAP is gated on V3 evidence** (override
  fields visible in PreToolUse tool_input, from the live probe / cnt-5). V3
  negative ⇒ cnt-4 rescopes to "document the gap + keep marker-only". V1
  negative ⇒ success criterion #1 is fixture-only on 0.144.4 (named in the
  close report). Dispatching cnt-1/2/3 does NOT wait — their outcomes are
  V-independent.
- Confirmations (no cell change): dogfood's standalone review:{kind:'cli'}
  keeps exact semantics (golden row already in cnt-1's brief); D9 is a
  recommendation for new defaults, not a migration; economics status name
  stays `native-requested` per the prior fold (this consult's
  "requested-accepted" wording is superseded by the folded decision);
  "byte-stability" = the existing field assertions, dispatch_id uuid is fine.
