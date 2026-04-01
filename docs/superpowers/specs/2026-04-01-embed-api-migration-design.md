# Legal Embed API Migration Design

> Date: 2026-04-01
> Scope: 前端全量切换至后端 embed 匿名通道，移除登录态认证

## 背景

后端新增 `/app/legal/embed/**` 匿名嵌入通道，前端需从现有登录态接口（`/app/legal/ai/...` + Bearer Token）一次性迁移至 embed 接口。项目处于开发阶段，不需要向后兼容。

后端 API 契约文档：`RuoYi-Vue-Plus-Legal/docs/legal-module/LEGAL_AI_EMBED_BACKEND_API_HANDOFF.md`

## 决策记录

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 迁移策略 | 一次性替换 | 开发阶段，无线上用户 |
| 验证码 | Mock 直通 (`mock-pass`) | 后端 dev 环境为 mock 模式 |
| 代理层 | 保留 Next.js API Routes | 隐藏后端 URL，统一错误处理 |

## 1. 会话生命周期

### Bootstrap 流程

```
页面加载
  → POST /api/legal/bootstrap
    body: { captchaToken: 'mock-pass', clientNonce, pageUrl, parentReferrer }
  → 后端返回 { sessionUuid, embedSessionToken, expiresIn, limits, message }
  → 前端存入 React state（仅内存）
  → UI 展示欢迎语 message
```

- `embedSessionToken` 不落 localStorage/sessionStorage，刷新页面重新 bootstrap
- `limits` 对象驱动前端输入校验（maxInputChars、maxRounds、uploadLimitPerMinute 等）
- Token 空闲超时 30 分钟，绝对超时 2 小时
- 收到 `嵌入会话令牌无效或已过期` 错误时自动重新 bootstrap

### 新建会话

侧边栏/Header "新对话" 按钮触发 `legal-new-session` 事件 → 重新 bootstrap → 重置全部聊天状态。

## 2. API 代理路由

所有代理路由统一行为：
- 从客户端请求头读取 `x-embed-session-token` 并透传给后端
- 不再附加 `Authorization` 或 `clientid`
- 后端基础 URL 仍读取 `BASE_URL` 环境变量

### 路由清单

| 前端路由 | HTTP 方法 | 后端目标 | 动作 |
|---------|-----------|---------|------|
| `/api/legal/bootstrap` | POST | `/app/legal/embed/bootstrap` | **新增** |
| `/api/legal/interact` | POST | `/app/legal/embed/send` 或 `/app/legal/embed/send_stream` | **改目标** |
| `/api/legal/upload` | POST | `/app/legal/embed/upload/files` | **改目标** |
| `/api/legal/voice` | POST | `/app/legal/embed/voice/recognize` | **新增（替代 textract）** |
| `/api/legal/cancel` | POST | `/app/legal/embed/cancel` | **改目标** |
| `/api/legal/session/[uuid]` | GET | `/app/legal/embed/session/{uuid}` | **新增** |

### 删除路由

- `app/(legal)/api/textract/route.ts`
- `app/(legal)/api/textract/oss-info/route.ts`

### 环境变量变更

- **移除**：`BEARER_TOKEN`、`CLIENTID`
- **保留**：`BASE_URL`（代理层需要）
- **更新** `.env.example` 反映变更

## 3. 类型系统（`lib/legal/types.ts`）

### 新增类型

```typescript
interface BootstrapRequest {
  captchaToken: string
  clientNonce: string
  pageUrl: string
  parentReferrer?: string
}

interface BootstrapResponse {
  sessionUuid: string
  embedSessionToken: string
  expiresIn: number
  idleExpiresIn: number
  nextStep: string
  message: string
  prompt: string
  limits: EmbedLimits
}

interface EmbedLimits {
  maxRounds: number
  maxInputChars: number
  uploadLimitPerMinute: number
  voiceLimitPerMinute: number
}

interface VoiceRecognizeResponse {
  text: string
  provider: string
  elapsedMs: number
}

interface EmbedSessionInfo {
  sessionUuid: string
  currentStep: string
  status: number
  expireTime: string
  messageCount: number
  lastMessageText: string
}
```

### 修改类型

- `LegalAction`：改为 `'continue' | 'skip' | 'submit_answers' | 'submit_pre_questions' | 'pre_generate_document' | 'close'`
- 移除 `contact_lawyer`、`refresh_lawyers` 相关类型和 UI 逻辑

### 删除

- `lib/api/textract.ts`（旧 textract API 函数）

## 4. Hook 改造（`hooks/use-legal-chat.ts`）

### 状态新增

```typescript
// 新增到 hook 内部状态
embedSessionToken: string | null   // bootstrap 返回的 token
limits: EmbedLimits | null         // 前端校验限制
```

### initSession → bootstrap

当前 `initSession()` 发空 POST 到 `/api/legal/interact` 获取 greeting，改为：

1. POST `/api/legal/bootstrap`，body 含 `captchaToken: 'mock-pass'`
2. 存储 `embedSessionToken`、`sessionUuid`、`limits`
3. 用 `message` 字段构造欢迎消息展示

### 请求头注入

所有 fetch 调用统一附加：

```typescript
headers: {
  'x-embed-session-token': embedSessionToken
}
```

代理层透传此 header 给后端。

### 语音识别

`recognizeVoice()` 改为调用 `/api/legal/voice`：
- 请求：multipart/form-data，字段名 `file`
- 响应：`{ text, provider, elapsedMs }` → 取 `text` 插入输入框

### Token 过期处理

任何 API 返回 `嵌入会话令牌无效或已过期` 时：
1. 清空当前 token
2. 自动重新 bootstrap
3. Toast 提示用户"会话已过期，已自动重新开始"

## 5. 流式解析（`lib/legal/stream-parser.ts`）

现有 SSE 解析逻辑基本兼容，需确认：
- `start`、`content`、`done`、`error`、`fallback` 事件类型与后端 embed SSE 一致
- `error` 事件格式 `{"type":"error","message":"..."}` 兼容当前解析器
- 新增并发冲突错误 `当前已有进行中的流式请求` 的 UI 提示

## 6. 组件影响

| 组件 | 改动 | 说明 |
|------|------|------|
| `legal-chat.tsx` | 小改 | initSession 调用改为 bootstrap；附件逻辑不变 |
| `voice-input.tsx` | 小改 | recognizeVoice 返回值格式适配 |
| `step-renderers.tsx` | 无 | 步骤渲染逻辑不变 |
| `legal-sidebar.tsx` | 无 | 新建会话仍触发 event |
| `legal-chat-header.tsx` | 无 | 无变化 |

## 7. 文件变更清单

### 新增

- `app/(legal)/api/legal/bootstrap/route.ts`
- `app/(legal)/api/legal/voice/route.ts`
- `app/(legal)/api/legal/session/[uuid]/route.ts`

### 修改

- `app/(legal)/api/legal/interact/route.ts` — 改后端目标，去 auth
- `app/(legal)/api/legal/upload/route.ts` — 改后端目标，去 auth
- `app/(legal)/api/legal/cancel/route.ts` — 改后端目标，去 auth
- `hooks/use-legal-chat.ts` — bootstrap 流程、token 管理、voice 适配
- `lib/legal/types.ts` — 新增/修改类型定义
- `lib/legal/stream-parser.ts` — 确认错误事件兼容
- `components/legal/legal-chat.tsx` — initSession 调用适配
- `components/legal/voice-input.tsx` — recognizeVoice 适配
- `.env.example` — 移除 BEARER_TOKEN/CLIENTID

### 删除

- `app/(legal)/api/textract/route.ts`
- `app/(legal)/api/textract/oss-info/route.ts`
- `lib/api/textract.ts`

## 8. 风险与注意事项

- **CORS**：浏览器自动带 `Origin`，代理层需确保不覆盖
- **SSE 协议差异**：embed SSE 事件语义需与登录态版本实测确认一致
- **Rate Limit**：bootstrap 每分钟 5 次、每天 30 次，开发时频繁刷新可能触发限流
- **文件上传**：embed 上传返回的 `UploadCredentialVo` 新增 `service`、`objectKey`、`eTag` 字段，前端可忽略仅用 `ossId`
