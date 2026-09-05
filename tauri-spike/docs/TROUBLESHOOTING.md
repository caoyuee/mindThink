# Tauri Spike 本地构建问题排查

本文档列出 `pnpm dev:tauri` / `pnpm build:tauri` 时可能遇到的问题与修复方法。

## 快速诊断

```bash
# 1. 前端依赖
pnpm install

# 2. Rust 工具链
rustc --version    # 应 >= 1.77
cargo --version

# 3. Tauri CLI
cargo tauri --version    # 应 >= 2.x

# 4. 前端质量门禁
pnpm verify

# 5. Rust 类型检查
cd src-tauri
cargo check              # 应无错误
cargo clippy             # 推荐,会有警告但不应有错误

# 6. 启动
cd ..
pnpm dev:tauri
```

## 错误速查表

### E1. `error: linking with `link.exe` failed` (Windows)

**原因**：缺少 MSVC 链接器。

**修复**：
1. 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/)
2. 选择 "Desktop development with C++" 工作负载
3. 重启终端

### E2. `error: failed to run custom build command for openssl-sys` (Windows)

**原因**：缺少 OpenSSL 开发包或 webview2。

**修复**：
```powershell
# 用 vcpkg 或下载预编译
vcpkg install openssl:x64-windows-static
# 然后设置环境变量
$env:VCPKG_ROOT = "C:\vcpkg"
$env:OPENSSL_DIR = "C:\vcpkg\installed\x64-windows-static"
```

### E3. `failed to fetch crates-io` 或下载慢

**修复**：使用国内镜像
```bash
# ~/.cargo/config.toml
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"

[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"

[net]
git-fetch-with-cli = true
```

### E4. `Package vsync was not found in the registry` 或类似版本找不到

**原因**：Cargo.lock 与 Cargo.toml 不一致。

**修复**：
```bash
cd src-tauri
cargo update -p <package>
# 或删除 Cargo.lock 重新生成（不推荐）
```

### E5. `Webview2 Runtime not found` (Windows 7/8)

**修复**：
- 下载 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
- Win10+ 默认已装，Win7/8 需手动安装
- WinXP 完全不支持

### E6. `webkit2gtk-4.1 not found` (Linux)

**修复**（Ubuntu/Debian）：
```bash
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

### E7. `tauri-cli not found`

**修复**：
```bash
cargo install tauri-cli --version "^2"
```

### E8. `The bundle identifier xxx is not valid`

**原因**：`tauri.conf.json` 的 `identifier` 不符合反向域名规范。

**修复**：改为标准格式
```json
{
  "identifier": "com.yourname.desktopnaotu"   // 或 org.naotu.desktopnaotu
}
```

### E9. `Cannot find module '@/...'`

**原因**：TypeScript path alias 在 Vite 中没生效。

**修复**：检查 `tsconfig.json` 的 `paths` 与 `vite.config.ts` 的 `resolve.alias` 一致：
```typescript
// vite.config.ts
resolve: {
  alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
}
```

### E10. 开发时白屏/空白

**可能原因**：
1. Vite dev server 没启动 → 检查 `pnpm dev` 是否先跑
2. WebView 加载了错误的 URL → 检查 `tauri.conf.json` 的 `devUrl`（应为 `http://localhost:5181`）
3. CORS 错误 → 检查 `tauri.conf.json` 的 `security.csp`

**调试**：打开 webview DevTools（菜单 View → Toggle Developer Tools）

### E11. `Failed to bundle project` 打包失败

**可能原因**：
1. 图标文件缺失或尺寸不对
2. 未安装 WiX (Windows msi 打包)
3. macOS 未签名（仅开发可跳过）

**修复**：
- 图标：`tauri icon path/to/icon.png` 自动生成全套
- WiX：Tauri CLI 已自带，无需额外安装
- 签名：参见 BUILD.md

### E12. `panic: ResourceNotFound` 等 Tauri 内部错误

**原因**：capabilities 权限不足。

**修复**：检查 `src-tauri/capabilities/default.json` 是否包含所需权限。
例如报错涉及 `dialog` → 添加 `dialog:default`。

### E13. Rust 编译极慢

**首次编译**会下载数百个 crate 并编译整个依赖树，需要 5-15 分钟。后续增量编译几秒。

**加速**：
```bash
# 用 mold (Linux) 或 lld
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold"]
```

## 调试技巧

### 启用 Rust 详细日志

```bash
cd src-tauri
RUST_LOG=debug cargo run
```

### 启用 WebView DevTools

菜单栏 → View → Toggle Developer Tools（或快捷键 `Ctrl+Shift+I`）

### 查看 panic 堆栈

```bash
RUST_BACKTRACE=full cargo run
```

### 验证 Rust 编译是否成功（不运行）

```bash
cd src-tauri
cargo build --release    # 仅编译,不打包
```

如果这步成功,打包应该也能成功。

### 跨平台打包注意事项

- macOS 应用必须在 macOS 上构建
- Linux 应用可在 Linux 上构建,也可用 Docker（但麻烦）
- Windows 应用可在 Windows 上构建,Linux/Mac 上交叉编译需额外配置

## 完整跑通后的预期

- `pnpm dev:tauri`: 弹出 1200×800 窗口,显示脑图编辑器,可打开/保存 .md
- `pnpm build:tauri`:
  - Windows: `src-tauri/target/release/bundle/msi/*.msi` (~10-20MB)
  - macOS: `src-tauri/target/release/bundle/macos/*.app` 和 `*.dmg`
  - Linux: `src-tauri/target/release/bundle/{deb,appimage}/*`

## 反馈模板

如果以上都不能解决你的问题,把以下信息贴给我：

```
## 环境
- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- Node: v22.x.x
- pnpm: 9.x.x
- Rust: rustc 1.x.x
- Tauri CLI: tauri-cli 2.x.x

## 命令
[你执行的完整命令]

## 完整错误输出
[粘贴]

## 关键文件
- package.json: [内容]
- tauri.conf.json: [内容]
- Cargo.toml: [内容]
```