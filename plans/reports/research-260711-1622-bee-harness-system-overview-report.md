# Research Report: Hệ thống Harness (bee) trong repo beegog

- **Ngày nghiên cứu:** 2026-07-11 16:22 (+07)
- **Phạm vi:** đọc trực tiếp repo (README.md, docs/02-architecture.md, docs/03/08/09/11, skills/bee-swarming, skills/bee-planning) + skill `/ck:cook` local (`~/.claude/skills/cook`). Không cần web search — toàn bộ là nội bộ repo.

## Tóm tắt điều hành

Repo này là **bee** — một "agentic-development harness" (bộ khung điều khiển) cho Claude Code và Codex. "Harness" ở đây = Instructions + Tools + Environment + State + Feedback (frame từ docs/09): mọi thứ bao quanh agent để nó *chứng minh* từng bước thay vì "vibe-coding". Bee chưng cất từ 7 hệ thống upstream (khuym, claudekit, gsd-core, gstack, **repository-harness**, superpowers, compound-engineering) — docs/08 và 09 là biên bản "adopt gì / bỏ gì" từ repository-harness và khóa learn-harness-engineering.

Điểm khác biệt cốt lõi: enforcement bằng **code, không bằng lời hứa của agent** — helper `bee_cells.mjs cap` từ chối đóng cell khi thiếu bằng chứng verify; hook write-guard chặn sửa source trước Gate 3 (đã chứng kiến trực tiếp trong phiên này: lệnh bash bị intake gate chặn khi phase=idle).

## 1. Hệ thống giải quyết vấn đề gì (mục tiêu chính)

4 failure mode của AI coding tự do (README):

1. Code trước khi mục tiêu rõ → build sai thứ cần.
2. Nói "done" mà không kiểm chứng thật ("tests pass" không nêu test nào).
3. Quên quyết định đã chốt ở session trước.
4. Mất mạch giữa chừng task lớn (context cạn).

Bee trả lời bằng 4 cơ chế: **Gates** (4 điểm người duyệt), **Cells** (đơn vị việc nhỏ, đóng phải có proof), **Lanes** (nghi thức tỉ lệ với rủi ro), **Compounding** (việc xong → tri thức bền: specs, decision log, critical patterns). Mục tiêu: mỗi "done" có bằng chứng ghi lại được, agent "bớt sai sót" theo thời gian.

## 2. Thành phần / module chính

### Lớp runtime (per machine) — 14+ skills `bee-*`

| Skill | Vai trò |
|---|---|
| `bee-hive` | Bootstrap, routing theo scope+risk, state, gates — load đầu mỗi session |
| `bee-exploring` | Chốt intent mờ thành decisions (Gate 1) |
| `bee-xia` | Research có nhãn bằng chứng, reuse-first |
| `bee-planning` | Shape work: plan.md thống nhất, cắt cells cho slice hiện tại (Gate 2) |
| `bee-briefing` | Render implement-plan.md human-readable (projection, không phải planner thứ 2 — docs/11) |
| `bee-validating` | Reality gate, feasibility, spikes (Gate 3) |
| **`bee-swarming`** | **Orchestrator** — điều phối workers theo waves (chi tiết mục 4) |
| `bee-executing` | 1 worker : 1 cell — implement → verify → cap |
| `bee-reviewing` | Multi-agent review, P1/P2/P3, artifact verification (EXISTS→SUBSTANTIVE→WIRED), UAT (Gate 4) |
| `bee-scribing` | BA của hive: specs tech-agnostic trong `docs/specs/` |
| `bee-compounding` | Chuyển việc xong thành learnings/decisions |
| `bee-grooming` | Săn tech debt, drift, entropy score |
| `bee-bypass-gate` | Autopilot opt-in: tự duyệt Gate 1–3 lane thấp; safety floor tuyệt đối (high-risk, UAT, secrets luôn hỏi) |
| `bee-writing-skills` | TDD-for-skills |

### Lớp repo (per project, cài bởi `onboard_bee.mjs`)

- **4 vendored helpers** `.bee/bin/` (Node 18+, zero deps): `bee_status.mjs` (scout tình hình), `bee_cells.mjs` (lifecycle cell — `claim` throw nếu Gate 3 chưa duyệt; `cap` từ chối khi thiếu proof), `bee_reservations.mjs` (khóa file giữa workers song song, TTL), `bee_decisions.mjs` (log quyết định append-only, chặn secrets/injection).
- **6 hooks Claude Code**: session-init (preamble), prompt-context, **write-guard** (chặn sửa source pre-Gate-3, chặn write xung đột không reservation, chặn đọc secrets), state-sync, chain-nudge, session-close. Codex không có hooks — helpers tự enforce (dual-runtime, docs/06).
- **State** `.bee/`: `state.json` (phase, gates, workers), `cells/*.json`, `HANDOFF.json` (pause ~65% context, không bao giờ auto-resume), `decisions.jsonl`, `backlog.jsonl`, `reservations.json`, `config.json` (models tiers, gate_bypass, advisor, commands chuẩn của host project).
- **Docs 2 chiều**: `docs/history/` (log-shaped, append-only — "how we got here") vs `docs/specs/` (state-shaped, overwrite — "where we are", đạt "rebuild bar").

## 3. Luồng làm việc điển hình (yêu cầu → kết quả)

```
User: "add feature X"
  → bee-hive route theo lane (tiny/small/standard/high-risk/spike)
  → bee-exploring chốt decisions → CONTEXT.md
  ▶ GATE 1 (đúng quyết định chưa?)
  → bee-planning shape → plan.md (requirements-only) [+ bee-briefing render brief nếu lane lớn]
  ▶ GATE 2 (đúng thứ cần, đúng cỡ chưa?)
  → bee-planning prep: cắt cells slice hiện tại → .bee/cells/
  → bee-validating: chứng minh khả thi trên repo thật
  ▶ GATE 3 (được sửa file thật chưa? — trước đó write-guard DENY mọi source write)
  → bee-swarming spawn workers → bee-executing per cell: implement → verify → cap (có proof)
  → bee-reviewing: multi-agent review + artifact verification + UAT
  ▶ GATE 4 (P1 chặn merge)
  → bee-briefing (walkthrough) → bee-scribing (sync specs) → bee-compounding (learnings)
  → done
```

Lane quyết định độ nặng: typo fix = 1 cell, chạy solo, không ceremony; auth change = spikes bắt buộc, trace chặt. Quy tắc không đổi: **lane scale ceremony, không bao giờ scale memory** — tiny fix đổi behavior vẫn phải sync spec.

## 4. Khái niệm riêng + chi tiết Orchestrator (bee-swarming)

### Khái niệm riêng

- **Cell**: 1 file JSON = 1 work ticket cold-start được (worker zero-history thực hiện đúng): `id, lane, deps, decisions cited, files, read_first, action, must_haves {truths/artifacts/key_links/prohibitions}, verify (lệnh thật), trace`. Cap từ chối nếu không có verify pass + output + files_changed; cell `behavior_change` còn đòi **before-state** (`red_failure_evidence`).
- **Gate**: 4 điểm người duyệt, 3 gate enforce bằng code.
- **Lane**: tiny/small/standard/high-risk/spike — chọn bằng đếm risk flags cơ học.
- **Wave**: nhóm cells chạy song song trong 1 đợt (deps đã cap + không chung file).
- **Reservation**: khóa file TTL giữa workers; xung đột → `[BLOCKED]`, không bao giờ "spawn cả hai và cẩn thận".
- **Model tiers**: extraction / generation / ceiling — ceiling = session model, giữ khan hiếm; orchestrator phán tier **lúc dispatch** (decision 0016), transport tier tường minh (decision 0023 — dispatch trần bị hook `bee-model-guard` DENY).
- **Handoff**: pause tại ~65% context, session sau surface và **chờ**, không auto-resume.
- **Scribing debt**: cell behavior_change đã cap nhưng spec chưa sync — đếm và hiển thị liên tục.

### Orchestrator hoạt động thế nào (`bee-swarming/SKILL.md`)

1. **Solo vs swarm**: lane `tiny`/`small` → orchestrator tự implement in-session (vẫn giữ kỷ luật cell). `standard`/`high-risk` → **không bao giờ tự sửa code**, kể cả fix 1 dòng — mọi thứ thành cell và dispatch.
2. **Precondition**: Gate 3 approved (check `bee_status --json`), sweep reservations cũ, đã đọc critical-patterns.
3. **Wave analysis**: `bee_cells.mjs ready` → cells deps-capped, không chung file → cùng wave; còn lại wave sau.
4. **Assign**: orchestrator gán đúng **1 cell / 1 worker**. Worker không bao giờ tự chọn cell.
5. **Isolation contract**: prompt worker chỉ chứa cell id + đường dẫn CONTEXT.md/plan.md + global constraints + reservation identity + status-token protocol (`[DONE] [BLOCKED] [HANDOFF] [NOOP]`) — **không bao giờ session history**. Spawn bằng agent type mặc định + template inline, không dùng agent type của plugin khác.
6. **Tier judgment lúc dispatch**: mechanical → extraction; bình thường → generation; tích hợp/kiến trúc/high-risk → ceiling. Ghi bằng `bee_cells.mjs tier`, resolve qua `resolveTier` (marker `[bee-tier: …]` anchored, hoặc model param — bare dispatch bị deny).
7. **Goal-check mọi `[DONE]`** (decision 0018): lời worker không phải bằng chứng — orchestrator **tự chạy lại verify** (standard/high-risk: mọi behavior-change cell), chạy **frozen judge** (`bee_cells.mjs judge`) phát hiện worker sửa test/CI/lockfile không khai báo. Fail → re-dispatch cùng tier kèm output lỗi (task miss = rerun, không lén nâng tier).
8. **Rescue ladder** cho `[BLOCKED]`: (1) thêm context → (2) nâng tier 1 nấc → (3) escalate lên user / quay lại planning.
9. **Context budget**: ~65% → viết HANDOFF.json, pause giữa wave an toàn.
10. Wave sạch (mọi cell capped + goal-checked + judge-intact) → wave kế → hết → bee-reviewing.

## 5. Câu hỏi trọng tâm: plan từ `/ck:plan` có dùng bee-swarm/cell được không? Khác gì `/ck:cook --parallel`?

### Có dùng được không? — **Không trực tiếp, nhưng adopt được qua chain**

Sự thật kiểm chứng từ repo:

- Cells **chỉ** được tạo bởi bee-planning prep pass, **sau Gate 2**, từ `plan.md` chuẩn `bee-plan/v1` (frontmatter `artifact_contract` / `artifact_readiness` machine-checkable — docs/02). Không có đường ingest plan ngoài nào trong bee-planning/bee-hive (đã grep: không có "external plan" ingestion path).
- bee-swarming precondition cứng: Gate 3 approved trong `state.json`, cells validated. `bee_cells.mjs claim` throw và write-guard DENY source writes nếu chưa — plan `/ck:plan` không thể "nhảy cóc" vào swarm.

Con đường khả thi: coi plan `/ck:plan` (plans/<slug>/plan.md + phase-*.md) là **input liệu/requirements** cho chain: bee-hive route → exploring chốt các quyết định trong plan thành decisions (Gate 1 nhanh vì đã có sẵn phân tích) → bee-planning re-shape thành plan.md bee-plan/v1 + cắt cells → validating → Gate 3 → swarm. Plan ngoài tăng tốc khâu exploring/planning chứ không thay thế gates. Lưu ý: docs/11 (`bee-briefing`) là chiều **ngược lại** — render implement-plan human-readable *từ* artifacts của bee, không phải ingest.

Muốn ingest trực tiếp phải viết converter phase-file → cell JSON (`bee_cells.mjs add --file`) — nhưng vẫn phải qua Gate 2/3 và validating; và phase của /ck:plan thường to hơn cell (1 phase ≈ nhiều cells), thiếu `must_haves`/`verify` per-unit nên convert 1:1 sẽ tạo cell "béo" khó goal-check.

### Khác biệt cơ chế: bee-swarming vs `/ck:cook --parallel`

| Khía cạnh | `/ck:cook --parallel` | bee-swarming (cell/wave) |
|---|---|---|
| Đơn vị song song | **Phase file** (`phase-XX-*.md` từ `/ck:plan --parallel`), 1 phase → 1 `fullstack-developer` agent | **Cell** (nhỏ hơn phase), wave tính từ deps + file overlap |
| Chống xung đột file | File ownership ghi trong **prompt** — kỷ luật agent, không enforce | `bee_reservations.mjs` + write-guard hook **DENY** write xung đột lúc runtime |
| Điều kiện bắt đầu | User approve plan (conversational gate) | Gate 3 ghi trong `state.json`; `claim` throw + hook chặn nếu thiếu — **enforce bằng code** |
| "Done" nghĩa là gì | Agent báo xong + code-reviewer subagent review + user approve | `cap` từ chối thiếu verify output/files/before-state; orchestrator **tự chạy lại verify** + frozen judge chống sửa test |
| Worker context | Prompt phase + scout summary | Isolation contract chặt: cell + CONTEXT.md, cấm session history |
| Chọn model | Không có cơ chế tier | Tier judged per-dispatch, transport tường minh, hook deny dispatch trần |
| Blocked | Không có ladder chuẩn | Rescue ladder 3 nấc (context → tier → escalate) |
| Context dài | Không có | HANDOFF.json tại 65%, không auto-resume |
| Bộ nhớ sau việc | Journal (tùy chọn) | Bắt buộc: specs sync, decisions, learnings, scribing debt được đếm |

Tóm gọn: cả hai đều fan-out subagents song song, nhưng `/ck:cook --parallel` là **orchestration bằng prompt-discipline** (nhanh, nhẹ, tin agent + review gate hội thoại), còn bee-swarming là **orchestration bằng state machine cơ học** (chậm hơn, nhiều nghi thức hơn, nhưng mọi ràng buộc — gate, khóa file, proof-to-close, chống gian lận test — được code từ chối thay vì agent tự giác). Chọn cook --parallel cho việc vừa, tin cậy tương tác; chọn bee cho việc cần bằng chứng và chống drift dài hạn.

## Ghi chú thuật ngữ "Harness"

Trong repo, "harness" xuất hiện 3 nghĩa: (1) chính hệ thống bee = harness cho agent; (2) `repository-harness` — 1 trong 7 upstream được chưng cất (docs/08); (3) `learn-harness-engineering` — khóa học nguồn frame 5 lớp (docs/09). Các feature `harness09`, `harness10` trong docs/history là các đợt adopt từ 2 nguồn này (standard commands + baseline gate, backlog/fresh-session artifacts…).

## Câu hỏi chưa giải quyết

1. Chủ repo có muốn xây đường ingest chính thức plan ngoài (`/ck:plan`, Antigravity template) → cells không? Hiện chưa có decision record nào cho hướng này (docs/11 chỉ cover chiều render ra).
2. Nếu ingest: mapping phase→cells nên là 1:N (cắt lại) hay 1:1 (cell béo)? Khuyến nghị 1:N qua bee-planning prep để giữ goal-check khả thi.
