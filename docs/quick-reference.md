# 快速参考指南

## 常用命令

```bash
# 开发
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器 (localhost:3000)
pnpm build            # 构建生产版本

# 代码质量
pnpm lint             # 检查代码规范
pnpm format           # 自动修复格式问题

# 测试
pnpm test                                    # 运行所有测试
pnpm exec playwright test tests/e2e/         # 运行 e2e 测试
pnpm exec playwright test tests/routes/      # 运行路由测试
pnpm exec playwright test --project=e2e      # 按项目运行
```

---

## 环境变量配置

创建 `.env.local` 文件：

```env
# 必需
BASE_URL=http://localhost:8080       # 法律后端地址
```

---

## 模型配置

编辑 `lib/ai/providers.ts` 修改模型：

```typescript
// 修改这里的模型名称
"chat-model": newapi("openai/gpt-4o-mini"),
"chat-model-reasoning": wrapLanguageModel({
  model: newapi("openai/gpt-4o-mini"),
  middleware: extractReasoningMiddleware({ tagName: "think" }),
}),
```

编辑 `lib/ai/models.ts` 修改 UI 显示：

```typescript
export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "GPT-4o Mini",
    description: "快速响应的通用模型",
  },
  // ...
];
```

---

## 添加新的 AI 工具

1. 在 `lib/ai/tools/` 创建新文件
2. 在实际调用 AI SDK 的 API 路由中注册工具（本仓库已移除 `app/(chat)` 路由组）：

```typescript
tools: {
  getWeather,
  createDocument: createDocument({ session, dataStream }),
  // 添加新工具
  myNewTool: myNewTool({ session, dataStream }),
},
```

---

## 添加新的 Artifact 类型

1. 在 `artifacts/` 创建新目录
2. 实现 `client.tsx` (客户端渲染) 和可选的 `server.ts`
3. 在 `components/artifact.tsx` 注册：

```typescript
export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
  // 添加新类型
  myNewArtifact,
];
```

---

## 代码规范要点

- 使用 `import type` 导入类型
- 不使用 TypeScript enum，改用 `as const`
- 不使用 `any` 类型
- 使用 `for...of` 替代 `Array.forEach`
- React 组件不使用数组索引作为 key
- 使用 `<>` 替代 `<Fragment>`
