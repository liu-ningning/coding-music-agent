# Coding Music Agent — CLAUDE.md

## 项目概述

面向 AI Coding 用户的沉浸式桌面工作舱。内置编程 Agent，音乐 Agent 根据开发状态自动调节声音环境与界面氛围。

## 技术栈

Tauri 2.x + React 18 + TypeScript 5 + Zustand + Tailwind CSS 4 + AG-UI + Claude Agent SDK + 网易云音乐 + SQLite

## 目录结构

```
apps/desktop/      # Tauri 桌面应用
apps/sidecar/      # Node.js sidecar 服务
packages/          # 共享类型、配置、设计 Token
.claude/docs/      # 产品/设计/技术/开发计划文档
```

## 开发命令

```bash
pnpm install           # 安装依赖
pnpm dev:sidecar       # 启动 sidecar
pnpm dev:desktop       # 启动 Tauri 窗口
pnpm build:sidecar     # 构建 sidecar
pnpm build:desktop     # 构建 Tauri 应用
pnpm test              # 单元测试
pnpm lint              # ESLint
pnpm typecheck         # 类型检查
```

## 核心概念：CodingMoodState

系统核心状态，驱动音乐推荐和 UI 氛围：

- `feature_flow` — 写新功能，中 BPM，青蓝
- `debug_calm` — Debug，低刺激，蓝灰
- `deep_refactor` — 重构，ambient，蓝紫
- `review_focus` — Review，极低干扰
- `emergency_focus` — 线上故障，白噪音
- `low_energy` — 疲劳，温和陪伴
- `late_night_flow` — 深夜，深色 ambient
- `neutral` — 默认

## 数据流

```
用户操作 / Agent 事件 / 时间天气
  → Context Provider → determineMood → RecommendationOrchestrator
  → Music Provider → Music Agent 事件 → React UI 更新
```

## 专属规范

- 回复使用中文，代码注释使用中文
- 避免 `any`，共享类型在 `packages/shared-types`
- 所有组件必须有 loading / empty / error / permission 状态
- 使用 Tailwind CSS，颜色用 CSS Variables
- 异步操作必须有 try/catch

## 日志规范

**前后端均禁止直接使用 `console.log/warn/error`**。

### 前端（Desktop）

使用 `apps/desktop/src/utils/debugLogger.ts`：

```typescript
import { debugInfo, debugWarn, debugError } from '@/utils/debugLogger';
const MODULE = '模块名';

debugInfo(MODULE, '关键步骤信息');
debugWarn(MODULE, '非关键警告');
debugError(MODULE, '错误信息');
```

- 日志通过设置面板「调试日志」开关控制，开启后在左下角浮层显示
- 仅保留关键步骤日志（创建、失败、切换），移除轮询、下载进度等噪音
- 静默失败的 catch 块用注释说明原因，不输出日志

### 后端（Sidecar）

使用 `apps/sidecar/src/utils/logger.ts`：

```typescript
import { createLogger } from '../utils/logger';
const log = createLogger('模块名');

log.info('关键步骤信息');
log.warn('非关键警告');
log.error('错误信息');
```

- 输出格式：`[HH:MM:SS] [模块名] 消息`，error/warn 带级别标签和颜色
- 通过环境变量 `LOG_LEVEL` 控制级别（info/warn/error），默认 info
- 仅保留关键步骤日志（启动、预热、加载数量、失败），移除逐条数据操作日志

## 硬性要求
1. 不允许凭空猜测。
2. 不允许说“应该已经完成”。
3. 所有结论必须来自代码、命令结果、运行结果或页面检查。
4. 如果某项无法验证，必须明确写“无法验证”以及原因。
5. 不要只给问题，也必须给生产级别处理方案。
6. 报告要写得足够详细，后续可以直接交给  Claude Code 按报告修复。

## 测试要求

- 新功能/修复必须有测试，覆盖率 > 80%
- 测试重点：determineMood、推荐编排、权限判断、store reducers
- 不删除已有测试

## 开发计划协作

- 用户说"开始 X.X" → 标记任务为 `[@]`，开始开发
- 用户说"完成 X.X" → 标记任务为 `[x]`，更新进度
- 用户说"继续开发" → 找下一个 `[ ]` 任务，开始实现
- 详细协作指南见 [开发计划](./docs/04-development-plan.md) 和 [其他开发计划](./docs/06-lightweight-iterations.md) 的"Claude 开发协作指南"章节

## 详细文档

- [PRD](./docs/01-prd.md)
- [设计](./docs/02-design-interaction.md)
- [技术](./docs/03-technical-document.md)
- [开发计划](./docs/04-development-plan.md)
- [音乐推荐开发计划](./docs/05-music-recommendation-roadmap.md)
- [音乐推荐逻辑](../docs/music-recommendation-logic.md)
- [打包指南](../docs/sidecar-packaging.md)
