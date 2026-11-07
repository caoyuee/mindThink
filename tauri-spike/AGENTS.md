# AGENTS.md — Tauri 桌面端补充规则

> 统一规则基线在 [`../AGENTS.md`](../AGENTS.md)，本文件只补充 Tauri 特定约定。

## Tauri 特定红线

1. **禁止在 webview 调用 `electron.*`**：本项目是 Tauri，混用 Electron API 会引起混淆。
2. **禁止直接 invoke 绕过 `core/file.ts`**：文件 IO 必须经 `core/file.ts` 抽象（Tauri 分支走 `tauri-file.ts`）。
3. **调用 Tauri 命令前先 `isTauri()` 检测**。
4. **Rust 命令必须 `async` + 返回 `AppResult<T>`**：禁止 `unwrap()`/`expect()` 于生产路径。
5. **新增 Tauri 命令三件套**：
   - `src-tauri/src/commands.rs` 定义
   - `src-tauri/src/lib.rs` 的 `generate_handler![...]` 注册
   - `src-tauri/capabilities/default.json` 加权限（如需要）
6. **Webview 安全默认**：`nodeIntegration: false`、`contextIsolation: true`、最小化 CSP。
7. **前端不得 panic/throw 阻断 webview**：错误走 toast。

## 验证

```bash
pnpm verify                          # 前端：parity + typecheck + lint + format + test
cd src-tauri && cargo fmt -- --check && cargo check && cargo test && cargo clippy --all-targets -- -D warnings
```

## 已知注意

- Vite 文件监视已排除 `src-tauri/target/**`、`*.rs`（防 Windows EBUSY）。
- 多 binary 已在 `Cargo.toml` 设 `default-run = "desktop-naotu"`（防 installer 错选 MCP HTTP binary）。
- `pnpm exec tauri info` 在 pnpm 11 环境可能因 CLI 版本解析 panic，非应用配置错误。

> 更多分层/红线/决策树/i18n/协作规范见 [`../AGENTS.md`](../AGENTS.md)。
