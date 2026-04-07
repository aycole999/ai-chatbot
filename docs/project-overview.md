# 项目详细介绍

## 1. 项目概述

当前项目是一个基于 Next.js 16 构建的法律文书助手前端。

### 核心特性

- **多模态对话**: 支持文本、图片附件
- **Artifact 系统**: 右侧面板实时生成/编辑文档、代码、表格、图片
- **流式响应**: 使用 AI SDK 实现实时流式输出
- **推理模式**: 支持带思维链 (Chain-of-Thought) 的推理模型
- **匿名会话**: 通过 embed 通道接入后端，无需本地登录体系

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| AI | 对接后端法律服务 |
| UI | shadcn/ui + Tailwind CSS + Radix UI |
| 交互 | 流式会话、文件上传、语音输入 |
| 测试 | Playwright |
| 代码规范 | Ultracite (Biome) |

---

## 2. 页面详解

| 路径 | 文件 | 功能 |
|------|------|------|
| `/` | `app/(legal)/(site)/page.tsx` | 法律文书助手首页 |
| `/legal` | `app/(legal)/(site)/legal/route.ts` | 兼容路径（重定向到 `/`） |

---

## 3. 核心组件详解

### 聊天相关

| 组件 | 文件 | 功能 |
|------|------|------|
| `Chat` | `components/chat.tsx` | 聊天主组件，整合消息列表、输入框、Artifact |
| `Messages` | `components/messages.tsx` | 消息列表，处理滚动和虚拟化 |
| `Message` | `components/message.tsx` | 单条消息渲染，区分用户/助手 |
| `MultimodalInput` | `components/multimodal-input.tsx` | 多模态输入框，支持文本、附件、模型切换 |
| `ChatHeader` | `components/chat-header.tsx` | 聊天头部，显示标题和操作按钮 |
| `MessageActions` | `components/message-actions.tsx` | 消息操作 (复制、投票、编辑) |
| `MessageReasoning` | `components/message-reasoning.tsx` | 展示模型推理过程 |

### Artifact 系统

| 组件 | 文件 | 功能 |
|------|------|------|
| `Artifact` | `components/artifact.tsx` | Artifact 主面板，动画展开/收起 |
| `ArtifactActions` | `components/artifact-actions.tsx` | 版本切换、下载、复制等操作 |
| `ArtifactMessages` | `components/artifact-messages.tsx` | Artifact 内嵌消息列表 |
| `Toolbar` | `components/toolbar.tsx` | Artifact 工具栏 |
| `VersionFooter` | `components/version-footer.tsx` | 版本导航底栏 |

### 编辑器

| 组件 | 文件 | 功能 |
|------|------|------|
| `TextEditor` | `components/text-editor.tsx` | ProseMirror 富文本编辑器 |
| `CodeEditor` | `components/code-editor.tsx` | CodeMirror 代码编辑器 |
| `SheetEditor` | `components/sheet-editor.tsx` | react-data-grid 表格编辑器 |
| `ImageEditor` | `components/image-editor.tsx` | 图片编辑器 |
| `DiffView` | `components/diffview.tsx` | 版本差异对比视图 |

### 法律助手界面

| 组件 | 文件 | 功能 |
|------|------|------|
| `LegalChat` | `components/legal/legal-chat.tsx` | 法律会话主组件 |
| `LegalChatHeader` | `components/legal/legal-chat-header.tsx` | 顶部操作栏 |
| `LegalSidebar` | `components/legal/legal-sidebar.tsx` | 左侧辅助栏 |
| `StepRenderers` | `components/legal/step-renderers.tsx` | 后端步骤表单和文书结果渲染 |
| `VoiceInput` | `components/legal/voice-input.tsx` | 语音录制与识别入口 |

### 消息元素 (`components/elements/`)

| 组件 | 功能 |
|------|------|
| `CodeBlock` | 代码块渲染 (语法高亮) |
| `Reasoning` | 推理过程折叠展示 |
| `Tool` | 工具调用结果展示 |
| `Suggestion` | 建议修改展示 |
| `Loader` | 加载动画 |
| `WebPreview` | 网页预览 |

### 其他

| 组件 | 文件 | 功能 |
|------|------|------|
| `ThemeProvider` | `components/theme-provider.tsx` | 主题切换 |
| `SidebarToggle` | `components/sidebar-toggle.tsx` | 侧边栏展开/收起按钮 |
| `PreviewAttachment` | `components/preview-attachment.tsx` | 上传文件预览 |

---

## 4. Artifact 类型

| 类型 | 目录 | 编辑器 | 用途 |
|------|------|--------|------|
| `text` | `artifacts/text/` | ProseMirror | 富文本文档 |
| `code` | `artifacts/code/` | CodeMirror | Python 代码 (可执行) |
| `image` | `artifacts/image/` | 自定义 | 图片展示/编辑 |
| `sheet` | `artifacts/sheet/` | react-data-grid | CSV 表格 |

---

## 5. AI 工具

定义在 `lib/ai/tools/`：

| 工具 | 功能 |
|------|------|
| `createDocument` | 创建 Artifact (文本/代码/图片/表格) |
| `updateDocument` | 更新现有 Artifact |
| `getWeather` | 获取天气信息 |
| `requestSuggestions` | 请求文档修改建议 |

---

## 6. 自定义 Hooks

| Hook | 功能 |
|------|------|
| `useArtifact` | Artifact 全局状态 (Zustand) |
| `useChatVisibility` | 对话可见性状态 |
| `useAutoResume` | 断线后自动恢复流 |
| `useMessages` | 消息处理逻辑 |
| `useScrollToBottom` | 消息列表自动滚动 |
| `useMobile` | 移动端检测 |

---

## 7. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/legal/bootstrap` | POST | 初始化匿名 embed 会话 |
| `/api/legal/interact` | POST | 发送法律对话消息 |
| `/api/legal/upload` | POST | 代理上传附件到后端 |
| `/api/legal/voice` | POST | 代理语音识别到后端 |
| `/api/legal/cancel` | POST | 取消当前会话请求 |
| `/api/legal/session/[uuid]` | GET | 查询会话状态 |
| `/api/document/download/[documentId]` | GET | 代理下载文档 |
