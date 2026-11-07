# Changelog

All notable changes to **DesktopNaotu Web** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/), versioning
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (alpha → first formal release)

- 工程化基础:
  - vue-router 4 集成, 路由: /editor、/settings、/about
  - vue-i18n 10 集成, 4 语言: zh-CN、en、zh-TW、de
  - 多 store 拆分: `mindmap`（脑图）、`ui`（主题）、`config`（用户配置）
  - 全局 Toast 系统（`composables/useToast.ts` + `components/common/Toast.vue`）
  - 全局快捷键 composable（`composables/useShortcuts.ts`）
  - 全局错误处理（`composables/useErrorHandler.ts`）
- 组件分层:
  - `components/layout/` (AppHeader, AppStatusBar)
  - `components/editor/` (MindEditor, NodeContextMenu)
  - `components/panels/` (Toolbar, Properties)
  - `components/common/` (Toast)
  - `views/` (EditorView, SettingsView, AboutView, NotFoundView)
- 主题/UI 状态持久化到 localStorage
- 单元测试: vitest + happy-dom + 14 个测试覆盖 core/tree 与 core/commands
- CI: GitHub Actions (typecheck + lint + format + test + build)
- 项目规则: AGENTS.md / CONVENTIONS.md / ARCHITECTURE.md
- 质量门禁: ESLint 9 + Prettier 3 + EditorConfig

### Changed

- 包名: `mindmap-vue3-spike` → `desktop-naotu-web`
- 目录重组: 扁平 `components/` → 按职责分子目录
- 命令栈命令名改用 i18n key (如 `command.addChild`)
- 引入 nanoid 生成稳定节点 ID

### Technical

- 测试环境: happy-dom (Vitest 2.1)
- ESLint 9 flat config, 类型安全规则化
- TypeScript strict + noImplicitAny + noUnusedLocals

## [0.0.1] - Spike (废弃)

内部 spike 阶段，未发布 npm。仅供 commit
history 参考，已被本 changelog 的"未发布"取代。
