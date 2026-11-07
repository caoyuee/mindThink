# AGENTS.md — Web 端补充规则

> 统一规则基线在 [`../AGENTS.md`](../AGENTS.md)，本文件只补充 Web 端（纯浏览器）特定约定。

## Web 端特定约定

1. **文件 IO**：`core/file.ts` 的 Web 实现走 FS Access API；禁止组件/store 直接访问文件系统。
2. **无 Tauri 依赖**：Web 端不得引用 `__TAURI__` / `tauri-file.ts` / invoke；`isTauri()` 恒为 false。
3. **无原生菜单**：`core/menu-spec.ts` 的 `buildMenuSpec` 在 Web 端仅用于测试，不渲染原生菜单。
4. **文档标题**：用 `document.title`（无原生窗口标题能力）。

## 验证

```bash
pnpm verify   # typecheck + test（本 app）；lint / format / 聚合 verify 在仓库根
```

> 更多分层/红线/决策树/i18n/协作规范见 [`../AGENTS.md`](../AGENTS.md)。
