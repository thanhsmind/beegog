# Skill Metadata Parity — Execution

Metadata parity is closed across the shared skill tree: `SKILL.md` remains canonical, the renderer/checker owns minimal OpenAI projections with implicit invocation enabled, and onboarding distributes the nested metadata through its existing deep mirror.

- RED pressure tests are frozen at `0c0bb57`; GREEN implementation is frozen at `ffacf89`.
- The identical three pressure prompts passed when rerun by isolated agents with plan decisions D1–D6 explicitly loaded; no rationalization-driven refactor was required.
- The projection and distribution contract is documented in [07-contracts.md](../../../07-contracts.md#openai-skill-metadata-projection).
- Full verification output is recorded only in the [`smp-3` cell trace](../../../../.bee/cells/smp-3.json).
