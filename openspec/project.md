# Project Context

## Purpose

一个基于 Next.js 16 构建的法律文书助手前端，通过匿名 embed 会话代理接入法律后端。

### 核心特性
- **多模态对话**: 支持文本、图片附件
- **Artifact 系统**: 右侧面板实时生成/编辑文档、代码、表格、图片
- **流式响应**: 使用 AI SDK 实现实时流式输出
- **推理模式**: 支持带思维链 (Chain-of-Thought) 的推理模型
- **版本控制**: Artifact 支持历史版本切换和 diff 对比

## Tech Stack

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| AI | 对接后端法律服务 |
| UI | shadcn/ui + Tailwind CSS 4.x + Radix UI |
| 交互 | 流式会话、文件上传、语音输入 |
| 测试 | Playwright |
| 代码规范 | Ultracite (Biome) |
| 包管理 | pnpm 9.x |

## Project Conventions

### Code Style

使用 Ultracite/Biome 进行代码格式化和 lint 检查：

```bash
pnpm lint    # 检查格式和 lint 问题
pnpm format  # 自动修复
```

**规则**:
- 不使用 TypeScript enum - 使用 `object as const`
- 使用 `import type` 进行类型导入
- 禁止使用 `any` 类型
- 使用 `for...of` 替代 `Array.forEach`
- 禁止嵌套三元表达式
- 生产代码禁止 `console.log`
- React: 不使用数组索引作为 key，优先使用 `<>` 而非 `<Fragment>`

### Architecture Patterns

**Route Groups (Next.js App Router)**:
- `app/(legal)/` - Legal UI（`/`）与法律相关 API（`/api/legal/*`），并提供 `/legal` → `/` 重定向

**Key Directories**:
- `lib/ai/` - AI 配置、模型定义、prompts、tools
- `components/` - React 组件 (聊天 UI、artifacts、编辑器)
- `hooks/` - 自定义 React hooks

**AI Provider Setup** (`lib/ai/providers.ts`):
使用 NewAPI (OpenAI 兼容) 配置，模型别名:
- `chat-model` - 默认聊天模型
- `chat-model-reasoning` - 带推理链的模型
- `title-model` - 生成标题的模型
- `artifact-model` - 文档/artifact 生成模型

### Testing Strategy

使用 Playwright 进行 E2E 测试：

```bash
pnpm test                                    # 运行所有测试
pnpm exec playwright test tests/e2e/legal-default.test.ts  # 运行特定文件
pnpm exec playwright test --project=e2e      # 运行特定项目
```

测试文件位于 `tests/` 目录。

### Git Workflow

- 主分支: `main`
- 使用语义化提交信息
- PR 需要通过 lint 检查
- 变更提案使用 OpenSpec 流程

## Domain Context

### AI 工具 (`lib/ai/tools/`)

| 工具 | 功能 |
|------|------|
| `createDocument` | 创建 Artifact (文本/代码/图片/表格) |
| `updateDocument` | 更新现有 Artifact |
| `getWeather` | 获取天气信息 |
| `requestSuggestions` | 请求文档修改建议 |

### Artifact 类型

| 类型 | 编辑器 | 用途 |
|------|--------|------|
| `text` | ProseMirror | 富文本文档 |
| `code` | CodeMirror | Python 代码 |
| `image` | 自定义 | 图片展示/编辑 |
| `sheet` | react-data-grid | CSV 表格 |

### API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/legal/bootstrap` | POST | 初始化匿名 embed 会话 |
| `/api/legal/interact` | POST | 法律对话代理 API |
| `/api/legal/upload` | POST | 附件上传代理 |
| `/api/legal/voice` | POST | 语音识别代理 |
| `/ping` | GET | 健康检查 |

## Important Constraints

### 环境变量 (必需)
- `BASE_URL` - 法律后端地址

### 文件上传限制
- 当前仅支持 JPEG/PNG 图片
- 最大 5MB

### 浏览器兼容性
- 需要现代浏览器支持 (Chrome, Firefox, Safari, Edge)
- 需要 JavaScript 启用

## External Dependencies

### 核心服务
- **法律后端服务**: 提供 embed 会话、上传、语音与文书流程

### 主要 npm 包
- `ai` (5.x): Vercel AI SDK
- `next` (16.x): React 框架
- `zod`: Schema 验证

## Commands Quick Reference

```bash
# Development
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器 (localhost:3000)
pnpm build            # 构建生产版本

# Code Quality
pnpm lint             # 检查格式和 lint
pnpm format           # 自动修复

# Testing
pnpm test             # 运行所有 Playwright 测试
```
