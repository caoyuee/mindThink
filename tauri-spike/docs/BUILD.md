# 跨平台构建指南

本文档说明如何在不同操作系统上构建 DesktopNaotu 桌面应用。

## 前置依赖

### 通用

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- **Rust** ≥ 1.77（[rustup](https://rustup.rs/)）
- **Tauri CLI** ≥ 2.x：`cargo install tauri-cli --version "^2"`

### 各平台

#### Windows

- WebView2 Runtime（Win10+ 默认已装，Win7/8 需手动装）
- Microsoft C++ Build Tools（[Visual Studio Installer](https://visualstudio.microsoft.com/) 选 "Desktop development with C++"）
- 打包 `.msi` 需要 [WiX Toolset](https://wixtoolset.org/) v3

```powershell
# 安装 Tauri CLI
cargo install tauri-cli --version "^2"

# 开发运行
pnpm dev:tauri

# 打包（产物在 src-tauri/target/release/bundle/msi/）
pnpm build:tauri
```

#### macOS

- Xcode Command Line Tools：`xcode-select --install`
- macOS 10.15+（Catalina）
- 代码签名需要 Apple Developer ID

```bash
# 安装 Tauri CLI
cargo install tauri-cli --version "^2"

# 开发运行（自动用默认签名）
pnpm dev:tauri

# 打包（产物在 src-tauri/target/release/bundle/macos/ 与 .dmg）
pnpm build:tauri

# 带签名的 release 构建
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
APPLE_CERTIFICATE="..." \
pnpm build:tauri
```

#### Linux

- webkit2gtk-4.1（Debian/Ubuntu：`libwebkit2gtk-4.1-dev`）
- librsvg2-dev、libssl-dev、libayatana-appindicator3-dev（托盘）
- 打包 `.deb`/`.AppImage` 依赖 `dpkg`/`fakeroot`

**Ubuntu/Debian**：

```bash
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev build-essential curl wget file

# 安装 Tauri CLI
cargo install tauri-cli --version "^2"

# 开发运行
pnpm dev:tauri

# 打包（产物在 src-tauri/target/release/bundle/{deb,appimage}/）
pnpm build:tauri
```

**Fedora**：

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel gtk3-devel \
  libappindicator-gtk3-devel librsvg2-devel
cargo install tauri-cli --version "^2"
pnpm build:tauri
```

**Arch**：

```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
cargo install tauri-cli --version "^2"
pnpm build:tauri
```

## 跨平台编译

Tauri 不直接支持交叉编译（macOS 应用必须在 macOS 上构建），但可以通过 CI/CD 在不同 OS 上分别构建：

| 目标 | 构建 OS | 工具 |
|---|---|---|
| `.msi` | Windows | GitHub Actions windows-latest |
| `.dmg`/`.app` | macOS | GitHub Actions macos-latest |
| `.deb`/`.AppImage` | Linux | GitHub Actions ubuntu-latest |

### GitHub Actions 示例（参考）

```yaml
name: Release

on:
  push:
    tags: ['v*']

release:
  strategy:
    matrix:
      os: [ubuntu-latest, windows-latest, macos-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable

      - run: pnpm install
      - run: pnpm build:tauri

      - uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/release/bundle/**/*.msi
            src-tauri/target/release/bundle/**/*.dmg
            src-tauri/target/release/bundle/**/*.deb
            src-tauri/target/release/bundle/**/*.AppImage
```

## 自动更新（远期）

```toml
# src-tauri/Cargo.toml 加入
tauri-plugin-updater = "2"
```

启用后用户可一键升级到最新版本，需要配置：
- GitHub Releases 作为更新源
- 端到端签名（`TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）

## 故障排查

| 问题 | 解决 |
|---|---|
| `error: linking with `link.exe` failed` | 安装 Visual Studio Build Tools |
| `webkit2gtk-4.0 not found` | Linux 上装 `libwebkit2gtk-4.1-dev` |
| 打包 .msi 找不到 wix | `cargo install tauri-cli --version "^2"` 已自带 |
| 启动后白屏 | 检查 `tauri.conf.json` 的 `frontendDist`/`devUrl` |
| Webview2 缺失（Win） | 下载 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |

## 参考

- [Tauri 2.x 官方文档](https://tauri.app/v2/)
- [Tauri 跨平台构建](https://tauri.app/v2/guides/distribution/)
- [Capacities 权限系统](https://tauri.app/v2/security/capabilities/)