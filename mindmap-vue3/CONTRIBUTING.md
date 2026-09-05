# Contributing to DesktopNaotu Web

感谢你的贡献！本文档说明如何参与这个项目。

## 快速开始

```bash
# 1. 克隆
git clone https://github.com/NaoTu/DesktopNaotu.git
cd DesktopNaotu/spike/mindmap-vue3

# 2. 安装依赖（pnpm）
pnpm install

# 3. 启动开发服务器
pnpm dev          # http://localhost:5180

# 4. 运行测试
pnpm test
```

## 开发流程

### 1. 阅读规范

开始任何修改前**必读**：

1. [AGENTS.md](./AGENTS.md) — 项目规则与红线
2. [CONVENTIONS.md](./CONVENTIONS.md) — 代码风格
3. [ARCHITECTURE.md](./ARCHITECTURE.md) — 架构

### 2. 创建分支

```bash
git checkout -b feat/<name>     # 新功能
git checkout -b fix/<name>      # bug 修复
git checkout -b refactor/<name> # 重构
```

### 3. 编写代码

- 修改代码前查 AGENTS.md "修改决策树"，确认落点
- 所有修改必须遵守"绝对红线"和"分层约束"
- 涉及 `core/` 或 `stores/` 的改动**必须先在 PR 描述中说明影响范围**

### 4. 跑质量门禁

```bash
pnpm verify       # typecheck + lint + format + test
```

任何一项失败都不能提交。

### 5. 提交与 PR

```bash
git add .
git commit -m "feat(editor): 添加节点拖拽改父"
git push origin feat/<name>
```

PR 描述应包含：

- 改动目的
- 改动模块（按 AGENTS.md 分层）
- 测试覆盖情况
- 截图（如果改了 UI）

## 代码贡献准则

### 命名

- 组件: PascalCase (`MindEditor.vue`)
- 函数/变量: camelCase
- 常量: UPPER_SNAKE
- 类型: PascalCase, 接口用 `I` 前缀（仅 types/ 下使用）
- 文件: kebab-case (`use-shortcuts.ts`) 或 PascalCase (组件)

### TypeScript

- 严格模式必须开启
- 函数参数、返回值必须有类型
- 类型导入用 `import type`

### Vue

- `<script setup>` + Composition API
- 单文件组件, scoped 样式
- 命名导出 composables 以 `use` 开头

### i18n

- 任何用户可见字符串都必须经过 `t()` 函数
- 修改或新增 key 时同步更新 4 个语言文件

### 测试

- 新增的 `core/` 函数必须有单元测试
- 测试文件命名: `<module>.spec.ts`
- 测试位置: `src/tests/`

## 报告问题

通过 [GitHub Issues](https://github.com/NaoTu/DesktopNaotu/issues) 反馈，包含：

- 复现步骤
- 期望行为
- 实际行为
- 环境（浏览器、操作系统）

## 许可

本项目使用 GPL-2.0 许可证，详见 [LICENSE](../LICENSE)。