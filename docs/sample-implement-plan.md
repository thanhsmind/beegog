Dưới đây là bộ **template + hướng dẫn dùng ngay** để bạn cho AI agent tạo tài liệu kiểu **Implementation Plan** giống Antigravity.

Theo tài liệu/codelab chính thức của Google, Antigravity tạo các **Artifacts** để agent truyền đạt kế hoạch, nhận phản hồi và chứng minh việc đã làm; trong đó `Implementation Plan` dùng để thiết kế thay đổi trên codebase trước khi triển khai, `Task List` là danh sách bước thực hiện, còn `Walkthrough` được tạo sau khi hoàn tất để tóm tắt và hướng dẫn kiểm thử. ([Google Codelabs][1])

---

## 1. Cấu trúc nên dùng

Một Implementation Plan tốt nên có 9 phần:

1. **Goal** — mục tiêu cuối cùng cần đạt.
2. **Current State** — agent đã đọc code/tài liệu nào, hiện trạng ra sao.
3. **Scope / Non-scope** — làm gì và không làm gì.
4. **Proposed Approach** — hướng giải quyết tổng thể.
5. **Technical Design** — thay đổi kỹ thuật cụ thể.
6. **Affected Files / Components** — file, module, DB, API, UI bị ảnh hưởng.
7. **Implementation Steps** — các phase triển khai.
8. **Validation Plan** — test, command, manual check, screenshot nếu có UI.
9. **Risks / Rollback / Open Questions** — rủi ro, cách quay lại, điểm cần xác nhận.

Điểm quan trọng: **đừng để agent code ngay**. Bắt agent tạo plan trước, bạn review, sau đó mới cho proceed.

---

## 2. Template Markdown cho Implementation Plan

Bạn có thể lưu file này thành:

```text
docs/templates/IMPLEMENTATION_PLAN_TEMPLATE.md
```

````md
# Implementation Plan: {{FEATURE_OR_TASK_NAME}}

## 0. Review Status

- Status: Draft / Ready for Review / Approved / Needs Revision
- Owner: {{AGENT_OR_PERSON}}
- Date: {{YYYY-MM-DD}}
- Related task / issue: {{LINK_OR_ID}}
- Target branch: {{BRANCH_NAME}}

---

## 1. Goal

Describe the user-facing or business outcome.

**User request**

> {{ORIGINAL_USER_REQUEST}}

**Success looks like**

- {{SUCCESS_CRITERION_1}}
- {{SUCCESS_CRITERION_2}}
- {{SUCCESS_CRITERION_3}}

---

## 2. Current State / Findings

Summarize what the agent inspected before proposing changes.

**Files / areas inspected**

- `{{path/to/file}}` — {{why it matters}}
- `{{path/to/file}}` — {{why it matters}}

**Current behavior**

- {{CURRENT_BEHAVIOR_1}}
- {{CURRENT_BEHAVIOR_2}}

**Constraints discovered**

- {{CONSTRAINT_1}}
- {{CONSTRAINT_2}}

---

## 3. Scope

### In scope

- {{WHAT_WILL_BE_CHANGED_1}}
- {{WHAT_WILL_BE_CHANGED_2}}
- {{WHAT_WILL_BE_CHANGED_3}}

### Out of scope

- {{WHAT_WILL_NOT_BE_CHANGED_1}}
- {{WHAT_WILL_NOT_BE_CHANGED_2}}

---

## 4. Proposed Approach

Explain the high-level solution.

{{SHORT_PARAGRAPH_EXPLAINING_THE_APPROACH}}

**Why this approach**

- {{REASON_1}}
- {{REASON_2}}
- {{REASON_3}}

**Alternatives considered**

| Option | Why not chosen |
|---|---|
| {{OPTION_A}} | {{REASON}} |
| {{OPTION_B}} | {{REASON}} |

---

## 5. Technical Design

### 5.1 Architecture / Flow

Describe the new or changed flow.

```text
{{USER_OR_SYSTEM_ACTION}}
  -> {{COMPONENT_A}}
  -> {{COMPONENT_B}}
  -> {{OUTPUT_OR_STATE_CHANGE}}
````

### 5.2 Data model changes

* New tables / fields: {{YES_NO_AND_DETAILS}}
* Migration needed: {{YES_NO_AND_DETAILS}}
* Backward compatibility: {{NOTES}}

### 5.3 API / RPC / Function changes

| Area             | Change     |
| ---------------- | ---------- |
| Endpoint / RPC   | {{CHANGE}} |
| Request payload  | {{CHANGE}} |
| Response payload | {{CHANGE}} |
| Error handling   | {{CHANGE}} |

### 5.4 UI / UX changes

* {{UI_CHANGE_1}}
* {{UI_CHANGE_2}}
* Empty state: {{DETAIL}}
* Loading state: {{DETAIL}}
* Error state: {{DETAIL}}

### 5.5 Security / Permission considerations

* Authentication: {{DETAIL}}
* Authorization: {{DETAIL}}
* Sensitive data: {{DETAIL}}
* Rate limit / abuse prevention: {{DETAIL}}

---

## 6. Affected Files / Components

| Action | File / Component   | Purpose |
| ------ | ------------------ | ------- |
| Modify | `{{path/to/file}}` | {{WHY}} |
| Create | `{{path/to/file}}` | {{WHY}} |
| Delete | `{{path/to/file}}` | {{WHY}} |

---

## 7. Implementation Steps

### Phase 1: {{PHASE_NAME}}

* [ ] {{STEP_1}}
* [ ] {{STEP_2}}
* [ ] {{STEP_3}}

### Phase 2: {{PHASE_NAME}}

* [ ] {{STEP_1}}
* [ ] {{STEP_2}}

### Phase 3: Cleanup and polish

* [ ] Remove unused code
* [ ] Update comments / docs where needed
* [ ] Ensure naming and structure are consistent

---

## 8. Validation Plan

### Automated checks

Run:

```bash
{{TEST_COMMAND}}
{{LINT_COMMAND}}
{{BUILD_COMMAND}}
```

Expected result:

* {{EXPECTED_RESULT_1}}
* {{EXPECTED_RESULT_2}}

### Manual checks

* [ ] {{MANUAL_CHECK_1}}
* [ ] {{MANUAL_CHECK_2}}
* [ ] {{MANUAL_CHECK_3}}

### UI verification, if applicable

* [ ] Capture screenshot before change
* [ ] Capture screenshot after change
* [ ] Confirm layout works on desktop
* [ ] Confirm layout works on mobile

---

## 9. Risks and Mitigation

| Risk       |              Impact | Mitigation     |
| ---------- | ------------------: | -------------- |
| {{RISK_1}} | High / Medium / Low | {{MITIGATION}} |
| {{RISK_2}} | High / Medium / Low | {{MITIGATION}} |

---

## 10. Rollback Plan

If the implementation causes issues:

1. {{ROLLBACK_STEP_1}}
2. {{ROLLBACK_STEP_2}}
3. {{ROLLBACK_STEP_3}}

---

## 11. Open Questions

* {{QUESTION_1}}
* {{QUESTION_2}}

If there are no open questions, write:

> No blocking open questions. The plan is ready for review.

````

---

## 3. Hướng dẫn cho AI agent

Bạn có thể dùng phần này làm **system instruction / project rule / skill instruction**.

```md
# Implementation Plan Writing Guide for AI Agent

You are an implementation planning agent. Your job is to create a clear, reviewable implementation plan before making code changes.

## Core rules

1. Do not modify files before the implementation plan is approved.
2. Inspect the relevant codebase first.
3. Mention only files, APIs, tables, functions, or components that actually exist, unless clearly marked as "to be created".
4. Separate facts from assumptions.
5. If information is missing, add it under "Open Questions" instead of guessing.
6. Keep the plan technical enough for a developer to execute, but concise enough for a human to review.
7. Always include validation steps.
8. Always include rollback considerations for risky changes.
9. Do not hide uncertainty.
10. Do not over-engineer the solution.

## Required output

Return a Markdown document using this exact section order:

1. Review Status
2. Goal
3. Current State / Findings
4. Scope
5. Proposed Approach
6. Technical Design
7. Affected Files / Components
8. Implementation Steps
9. Validation Plan
10. Risks and Mitigation
11. Rollback Plan
12. Open Questions

## Quality bar

A good implementation plan must answer:

- What are we changing?
- Why are we changing it?
- Where will the change happen?
- How will we implement it?
- How will we verify it works?
- What can go wrong?
- How do we roll back?
- What needs human review?

## Style

- Use direct, specific language.
- Prefer tables for affected files, risks, and API changes.
- Prefer checklists for implementation and validation steps.
- Avoid vague statements like "update the code accordingly".
- Avoid pretending that tests passed before actually running them.
````

---

## 4. Nếu dùng Antigravity Skill

Antigravity hỗ trợ skill theo dạng thư mục, có thể đặt ở phạm vi global hoặc project; một skill thường có `SKILL.md`, và có thể có thêm `scripts`, `references`, `assets`. ([Google Codelabs][1])

Bạn có thể tạo:

```text
.agents/skills/implementation-plan-writer/SKILL.md
```

Với nội dung:

````md
---
name: implementation-plan-writer
description: Creates reviewable implementation plans before code changes. Use when the user asks to plan, design, refactor, build a feature, fix a bug, or make architectural changes.
---

# Implementation Plan Writer

When this skill is triggered, create a structured implementation plan before modifying code.

## Before writing the plan

1. Read the user's request carefully.
2. Inspect relevant files, folders, routes, APIs, database schema, tests, and configuration.
3. Identify the current behavior and the desired behavior.
4. Identify affected components.
5. Identify risks and validation requirements.

## Do not

- Do not modify code before the plan is approved.
- Do not invent file paths.
- Do not claim tests were run unless they were actually run.
- Do not skip validation.
- Do not bury open questions inside the main plan.

## Output format

Use this structure:

# Implementation Plan: {{task_name}}

## 0. Review Status

- Status: Draft
- Date: {{YYYY-MM-DD}}
- Related request: {{short_summary}}

## 1. Goal

{{goal}}

## 2. Current State / Findings

{{findings}}

## 3. Scope

### In scope

{{in_scope}}

### Out of scope

{{out_of_scope}}

## 4. Proposed Approach

{{approach}}

## 5. Technical Design

{{technical_design}}

## 6. Affected Files / Components

| Action | File / Component | Purpose |
|---|---|---|
| Modify/Create/Delete | `path` | reason |

## 7. Implementation Steps

- [ ] {{step_1}}
- [ ] {{step_2}}
- [ ] {{step_3}}

## 8. Validation Plan

### Automated checks

```bash
{{commands}}
````

### Manual checks

* [ ] {{manual_check_1}}
* [ ] {{manual_check_2}}

## 9. Risks and Mitigation

| Risk     | Impact     | Mitigation     |
| -------- | ---------- | -------------- |
| {{risk}} | {{impact}} | {{mitigation}} |

## 10. Rollback Plan

{{rollback}}

## 11. Open Questions

{{questions_or_no_blockers}}

````

---

## 5. Prompt mẫu để gọi agent

Dùng prompt này mỗi khi muốn agent tạo plan:

```text
Create an Implementation Plan before making any code changes.

Requirements:
- Inspect the relevant codebase first.
- Do not modify files yet.
- Use the implementation-plan-writer format.
- Include current findings, affected files, proposed approach, implementation steps, validation plan, risks, rollback plan, and open questions.
- Mark assumptions clearly.
- Only mention files or functions that actually exist, unless marked as "to be created".
- Stop after producing the plan and wait for review.
````

---

## 6. Bản rút gọn để áp dụng thực tế

Với workflow của bạn, tôi khuyên dùng quy trình này:

```text
User Request
  ↓
Agent reads codebase / context
  ↓
Agent creates Implementation Plan
  ↓
Human reviews and comments
  ↓
Agent revises plan
  ↓
Human approves
  ↓
Agent creates Task List
  ↓
Agent implements
  ↓
Agent creates Walkthrough + validation evidence
```

Đây chính là tinh thần Antigravity: không chỉ để agent “làm”, mà bắt agent **trình bày ý định, phạm vi, rủi ro và cách kiểm chứng** trước khi chạm vào code.

[1]: https://codelabs.developers.google.com/getting-started-google-antigravity?hl=vi "Làm quen với Google Antigravity  |  Google Codelabs"
