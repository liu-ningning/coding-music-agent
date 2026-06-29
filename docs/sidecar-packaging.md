# 打包指南

> 文档版本：v2.0
> 更新日期：2026-06-25

## 概述

将 sidecar 服务和音乐依赖打包嵌入 Tauri 应用，用户无需安装 Node.js 或启动 sidecar，双击即可使用。

---

## 打包流程

### 1. 更新版本号（可选）

```bash
pnpm package:version 1.0.0
```

会自动更新以下文件中的版本号：
- `package.json`
- `apps/desktop/package.json`
- `apps/sidecar/package.json`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/tauri.conf.json`

### 2. 一键打包

```bash
pnpm package:dmg
```

执行后自动完成：
1. 构建 sidecar（TypeScript → esbuild → npm install 依赖）
2. 构建 desktop 前端
3. Tauri 打包 .app
4. 复制音乐依赖到 .app
5. 生成 DMG 安装包
6. 自动安装到 `/Applications/`

---

## 打包流程详解

```
pnpm package:version 1.0.0    # （可选）更新版本号
  │
  └─ 更新 package.json、Cargo.toml、tauri.conf.json 中的版本号

pnpm package:dmg               # 一键打包
  │
  ├─ 1. pnpm clean                    # 清理旧构建缓存
  │     └─ rm -rf apps/desktop/src-tauri/target
  │
  ├─ 2. pnpm build:sidecar            # 构建 sidecar TypeScript
  │     └─ cd apps/sidecar && tsc -b
  │
  ├─ 3. pnpm build:sidecar:binary     # 打包 sidecar 为可执行资源
  │     └─ bash scripts/build-sidecar.sh
  │           ├─ tsc -b                        # 编译 TypeScript
  │           ├─ esbuild --external:Netease... # 打包为 bundle.js
  │           ├─ cp bundle.js → src-tauri/     # 复制到 Tauri 目录
  │           └─ npm install NeteaseCloud...   # 安装音乐依赖（flat node_modules）
  │
  ├─ 4. pnpm build:desktop            # 构建前端
  │     └─ cd apps/desktop && tsc -b && vite build
  │
  ├─ 5. tauri:build                   # Tauri 打包 .app
  │     └─ cargo build → 生成 .app
  │
  ├─ 6. pnpm copy:netease             # 复制音乐依赖到 .app
  │     └─ cp sidecar_deps/node_modules → .app/Contents/Resources/sidecar_node_modules/
  │
  ├─ 7. pnpm build:dmg               # 生成 DMG 安装包
  │     └─ hdiutil create → Coding Music Agent.dmg
  │
  └─ 8. pnpm install:app             # 自动安装到 /Applications/
        └─ cp .app → /Applications/
```

---

## 打包产物

### 最终产物

| 文件 | 路径 | 大小 | 说明 |
|------|------|------|------|
| **DMG 安装包** | `apps/desktop/src-tauri/target/release/bundle/dmg/Coding Music Agent.dmg` | ~26MB | ✅ 可分享给其他人安装 |
| **已安装应用** | `/Applications/Coding Music Agent.app/` | ~30MB | ✅ 自动安装，可直接使用 |

### 中间产物（开发调试用）

| 文件 | 路径 | 说明 |
|------|------|------|
| `bundle.js` | `apps/desktop/src-tauri/sidecar-bundle.js` | sidecar 打包后的代码 |
| `sidecar_deps/` | `apps/desktop/src-tauri/sidecar_deps/` | npm 安装的音乐依赖 |
| `music-coding` | `apps/desktop/src-tauri/target/release/music-coding` | Rust 编译的二进制 |

### ⚠️ 不要使用的文件

| 文件 | 路径 | 说明 |
|------|------|------|
| `Coding Music Agent_0.0.1_aarch64.dmg` | `bundle/dmg/` | Tauri 自动生成的 DMG（**不含音乐依赖**，不能用） |

---

## 安装方式

### 给其他人安装

1. 发送 `Coding Music Agent.dmg` 文件
2. 对方双击打开 DMG
3. 将 `Coding Music Agent.app` 拖到 `Applications` 文件夹
4. 从启动台或 Applications 打开应用

### 自己调试

```bash
# 一键打包并自动安装
pnpm package:dmg

# 或手动安装
cp -R "apps/desktop/src-tauri/target/release/bundle/macos/Coding Music Agent.app" /Applications/
```

---

## 技术方案

### 为什么这样打包

| 组件 | 打包方式 | 原因 |
|------|----------|------|
| Sidecar 代码 | esbuild → `bundle.js` | 将 TypeScript + 多模块合并为单个文件 |
| NeteaseCloudMusicApi | 外部化 + npm flat install | 该包使用 `__dirname` + `fs.readdirSync` 动态加载模块，无法被 bundler 处理 |
| 音乐依赖 | `copy:netease` 复制到 .app | pnpm 的嵌套依赖结构导致 transitive deps 不在一起 |
| Node.js 运行时 | 使用系统 node | 不打包 node，减小体积；通过 `bash -l` 加载用户环境 |

### 运行时架构

```
用户打开应用
  │
  ├─ Tauri 应用启动
  │     └─ Rust 代码执行
  │           └─ start_sidecar 命令
  │                 ├─ bash -l -c "NODE_PATH=... node bundle.js --port 4567"
  │                 └─ 等待 health check 通过
  │
  ├─ Sidecar 启动（Node.js 进程）
  │     ├─ HTTP 服务监听 4567 端口
  │     ├─ Agent 服务（调用 Claude CLI）
  │     └─ 音乐服务（NeteaseCloudMusicApi）
  │
  └─ 前端加载
        └─ 连接 sidecar HTTP 服务
```

---

## 配置

### 端口配置

修改根目录 `.env` 文件：

```bash
VITE_SIDECAR_HOST=localhost
VITE_SIDECAR_PORT=4567
```

打包后端口配置会被编译到代码中，修改 `.env` 后需要重新打包。

### 环境变量优先级

```
命令行参数 --port > 环境变量 VITE_SIDECAR_PORT > 默认值 4567
```

---

## 常见问题

### Q: 打包报错 `Permission denied`

```bash
# 卸载可能挂载的 DMG
hdiutil detach /tmp/dmg_mount 2>/dev/null

# 关闭应用
pkill -f "Coding Music Agent"

# 清理 target 目录
sudo rm -rf apps/desktop/src-tauri/target
```

### Q: 音乐功能不工作

检查 `sidecar_node_modules` 是否被正确复制：

```bash
ls "/Applications/Coding Music Agent.app/Contents/Resources/sidecar_node_modules/NeteaseCloudMusicApi"
```

如果目录不存在，手动执行：
```bash
pnpm run copy:netease
cp -R "apps/desktop/src-tauri/target/release/bundle/macos/Coding Music Agent.app" /Applications/
```

### Q: 应用打开后显示"服务未启动"

1. 检查系统是否安装了 Node.js：`node --version`
2. 如果使用 nvm，确保 `~/.bashrc` 或 `~/.zshrc` 中有 nvm 初始化代码
3. 从终端启动应用查看日志：`"/Applications/Coding Music Agent.app/Contents/MacOS/music-coding"`

### Q: DMG 太小（< 5MB）

说明音乐依赖没有被包含。确保使用 `pnpm package:dmg` 而不是 `pnpm package`。

### Q: 运行的是旧版本

`tauri:build` 会弹出一个不含音乐依赖的 .app（中间产物），不要使用它。`pnpm package:dmg` 最终会自动安装到 `/Applications/`，用那个版本。

---

## 相关命令速查

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式（同时启动 sidecar + desktop） |
| `pnpm package:version 1.0.0` | 更新版本号 |
| `pnpm package:dmg` | 完整打包 DMG + 自动安装（推荐） |
| `pnpm package` | 仅打包 .app（不含音乐依赖，不推荐） |
| `pnpm -w run copy:netease` | 手动复制音乐依赖到 .app |
| `pnpm -w run build:dmg` | 手动生成 DMG |
| `pnpm -w run install:app` | 手动安装到 /Applications/ |
| `pnpm -w run clean` | 清理构建缓存 |
