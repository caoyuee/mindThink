# CONVENTIONS.md — 代码风格与命名约定

## 1. 文件命名

| 类型            | 规则                            | 示例                                |
| --------------- | ------------------------------- | ----------------------------------- |
| Vue 组件        | PascalCase，与组件名一致        | `MindEditor.vue`、`Toolbar.vue`     |
| TypeScript 文件 | kebab-case 或 camelCase，按语义 | `tree.ts`、`file.ts`、`commands.ts` |
| 目录            | 小写，单数优先                  | `components/`、`stores/`、`core/`   |
| 类型定义        | 同名 `.d.ts`                    | `types/markmap.d.ts`                |
| 配置文件        | 小写带点                        | `vite.config.ts`、`tsconfig.json`   |

## 2. 命名约定

### 变量与函数

| 场景     | 风格                     | 示例                             |
| -------- | ------------------------ | -------------------------------- |
| 局部变量 | camelCase                | `const newNode = ...`            |
| 函数     | camelCase，动词开头      | `addChild()`、`renameNode()`     |
| 布尔     | `is/has/can/should` 前缀 | `isRoot`、`canUndo`、`hasData()` |
| 常量     | UPPER_SNAKE              | `MAX_HISTORY = 100`              |
| 私有成员 | `_` 前缀（仅用于类）     | `_kmPath`                        |

### 类型

| 场景     | 风格                       | 示例                            |
| -------- | -------------------------- | ------------------------------- |
| 接口     | I + PascalCase             | `IMindNode`、`IRecentlyItem`    |
| 类型别名 | PascalCase                 | `MindDoc`、`StatusList`         |
| 枚举     | PascalCase 成员 PascalCase | `enum Status { None, Opening }` |
| 泛型     | 单字母或 PascalCase        | `T`、`TNode`                    |

### Vue

| 场景       | 风格          | 示例                          |
| ---------- | ------------- | ----------------------------- |
| 组件 name  | PascalCase    | `MindEditor`                  |
| 事件       | kebab-case    | `@select`、`@action`          |
| Props      | camelCase     | `targetId: string`            |
| Emits      | camelCase     | `emit('select', node)`        |
| Slot       | kebab-case    | `<template #toolbar-actions>` |
| Ref        | `xxxRef` 后缀 | `svgRef`、`menuRef`           |
| Composable | `use` 前缀    | `useMindmap()`                |

## 3. TypeScript 规范

### 严格模式（必须）

- `strict: true`（开启全部严格选项）
- `noImplicitAny: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

### 导入

- ✅ 类型导入用 `import type { ... }`
- ✅ 默认导入与命名导入分行
- ❌ 不使用 `import * as`
- ❌ 不使用 `require()`（除非处理 CommonJS 兼容性）

### 类型注解

- 函数参数、返回值必须有类型
- 公开 API 必须有 JSDoc 注释
- 内部实现可省略

### 错误处理

- ✅ 用 `try/catch` 显式处理
- ❌ 不静默 `catch (e) {}`
- ❌ 不用 `any` 兜底（除非对接第三方库）
- ✅ 错误向上抛，让 store 或 UI 层统一处理

### 异步

- ✅ 异步函数返回 `Promise<T>`
- ✅ 异步回调用 `async/await`
- ❌ 不用 `.then().catch()` 链（除非必须）

## 4. Vue 规范

### SFC 结构

```vue
<script setup lang="ts">
// 1. imports
// 2. props/emits
// 3. refs/reactive
// 4. computed
// 5. functions
// 6. lifecycle hooks
// 7. watch
</script>

<template>
  <!-- 模板 -->
</template>

<style scoped>
/* 样式 */
</style>
```

### Composition API 强制

- 一律使用 `<script setup>` + Composition API
- 不用 Options API（除非与库强耦合）

### 响应式

- 基本类型 `ref()`
- 对象 `reactive()` 仅在嵌套结构时使用
- 避免深响应（`shallowRef` 用于 markmap、文件对象等）

### 组件通信

- 父子：`props` + `emits`
- 兄弟/全局：Pinia store
- ❌ 不使用事件总线（`mitt`、`new Vue()` 等）

## 5. CSS 规范

### 主题变量（必须）

所有颜色、间距、字体走 CSS 变量（在 `styles/global.css` 定义）：

```css
:root {
  --bg: #fff;
  --fg: #1f2328;
  --accent: #3b82f6;
}

[data-theme='dark'] {
  --bg: #1c1d22;
  --fg: #e6e7eb;
}
```

- ❌ 不在组件中硬编码颜色/字体
- ✅ 使用 `var(--xxx)` 引用

### 命名

- 类名 kebab-case：`mind-editor`、`toolbar-btn`
- BEM 风格：`block__element--modifier`
- 状态类：`is-xxx`、`has-xxx`

### 作用域

- 单文件组件用 `<style scoped>`
- 全局样式放 `styles/global.css`

## 6. 注释规范

### 必须注释的场景

- 公开 API（JSDoc）
- 复杂的算法或业务逻辑
- TODO/FIXME（必须标可写）
- 跨模块的影响

### 不需要注释

- 显而易见的代码
- 函数名已说明用途的

## 7. Git 规范（建议）

### 分支

- `main`: 稳定版本
- `feat/<name>`: 新功能
- `fix/<name>`: bug 修复
- `refactor/<name>`: 重构

### Commit

- 中文/英文均可
- 格式：`<type>(>scope): <subject>`
- type: feat / fix / refactor / docs / test / chore

## 8. 依赖管理

### 添加依赖

- 用 `pnpm add <pkg>` 而非修改 `package.json`
- 区分 `dependencies` 与 `devDependencies`
- 新依赖必须在 PR 描述中说明用途

### 不允许

- ❌ 提交 `node_modules/`、`dist/`、`*.log`
- ❌ 安装与项目无关的包
- ❌ 使用未维护（>2 年未更新）的包

---

## 9. 检查命令

```bash
# 类型检查
pnpm exec vue-tsc --noEmit

# 代码风格检查
pnpm lint

# 自动修复
pnpm lint:fix

# 格式化
pnpm format

# 检查并格式化（提交前）
pnpm check
```
