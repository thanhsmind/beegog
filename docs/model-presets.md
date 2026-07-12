# Model Presets — copy vào `.bee/config.json` là xong

Các bộ cấu hình `models` chuẩn (decisions 0012/0015/0019/0021). Chọn một preset, dán đè khối `"models"` trong `.bee/config.json` của repo. Quy tắc chung không đổi:

- **Orchestrator = model phiên** (`ceiling`, không cấu hình) — mở phiên bằng model nào thì model đó điều phối.
- **`review` mặc định opus** — model review không phải model đã implement; `null` = rơi về `generation`.
- Effort chỉ áp được ở runtime hỗ trợ chọn per-agent; executor ngoài mang effort trong chính command.
- Lệnh `wsl ...` dành cho Windows có Codex cài trong WSL (đã smoke-test 2026-07-10, codex-cli 0.143.0, prompt qua stdin OK).

## 1. `all-claude` — mặc định, chỉ có Claude subscription

Không cần sửa gì (đây là default từ 0.1.18). Ghi tường minh:

```json
"models": {
  "claude": { "extraction": "haiku", "generation": "sonnet", "review": "opus" }
}
```

## 2. `all-claude-tuned` — đúng bộ trong hình, thêm effort

Phiên mở bằng Fable. Review Opus xhigh, implementer Sonnet max:

```json
"models": {
  "claude": {
    "extraction": "haiku",
    "generation": { "model": "sonnet", "effort": "max" },
    "review":     { "model": "opus",   "effort": "xhigh" }
  }
}
```

Lưu ý: `max` cho generation là đắt — cân nhắc `high` nếu đa số cell là wiring thường.

## 3. `gpt-adversarial-review` — Claude làm, GPT phản biện (WSL + Codex)

Review đi qua Codex CLI, read-only (reviewer không được sửa gì):

```json
"models": {
  "claude": {
    "extraction": "haiku",
    "generation": "sonnet",
    "review": {
      "kind": "cli",
      "command": "wsl bash -lc \"codex exec --skip-git-repo-check -s read-only -c model_reasoning_effort=xhigh -\""
    }
  }
}
```

Muốn ghim model phía GPT: thêm `-m <model-id>` trước dấu `-` cuối (dấu `-` = đọc prompt từ stdin, bắt buộc giữ). Chạy trong WSL trực tiếp thì bỏ phần `wsl bash -lc` và cặp nháy.

## 4. `codex-implements` — plan big (Claude), execute small (GPT)

Worker generation là Codex, cần quyền ghi workspace để reserve/implement/verify/cap qua `.bee/bin`; review vẫn là Opus độc lập:

```json
"models": {
  "claude": {
    "extraction": "haiku",
    "generation": {
      "kind": "cli",
      "command": "wsl bash -lc \"codex exec --skip-git-repo-check -s workspace-write -\""
    },
    "review": "opus"
  }
}
```

An toàn đi kèm (tự động, decision 0018/0019): mọi `[DONE]` từ executor ngoài đều bị orchestrator chạy lại verify + check frozen-judge, không có ngoại lệ spot-check. Giữ `-s workspace-write` — không dùng `--yolo`/bypass toàn máy làm mặc định.

**Mẹo vận hành** (từ pattern codex-first): kết quả cuối lấy qua `-o <file>` thay vì parse stream; nén stderr (`2>/dev/null`) để thinking noise không phình context; sửa lỗi tiếp theo dùng `codex exec resume --last` (giữ context, rẻ hơn chạy mới) — quá 2 vòng resume fail thì `[BLOCKED]` leo thang; cell cần MCP/secrets/tool của phiên thì không bao giờ route ra ngoài.

## 5. `budget` — tiết kiệm tối đa

Review rơi về generation (chấp nhận mất reviewer độc lập — hợp lane tiny/small):

```json
"models": {
  "claude": { "extraction": "haiku", "generation": "sonnet", "review": null }
}
```

## Đổi preset

Sửa `.bee/config.json` → chạy `node .bee/bin/bee_status.mjs` xem dòng `Models (claude): ...` xác nhận. Không cần onboard lại.
