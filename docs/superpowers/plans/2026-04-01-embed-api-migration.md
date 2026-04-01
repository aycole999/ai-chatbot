# Embed API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all login-based backend API calls with the new anonymous embed API channel.

**Architecture:** All Next.js API proxy routes switch from Bearer Token auth to `x-embed-session-token` passthrough. The hook manages bootstrap lifecycle (captcha → token → requests). Old textract endpoints are replaced by dedicated voice/upload embed endpoints.

**Tech Stack:** Next.js 16 App Router, React hooks, SSE streaming, Zod validation

**Spec:** `docs/superpowers/specs/2026-04-01-embed-api-migration-design.md`

**Backend API contract:** `RuoYi-Vue-Plus-Legal/docs/legal-module/LEGAL_AI_EMBED_BACKEND_API_HANDOFF.md`

---

## File Structure

### New Files
- `app/(legal)/api/legal/bootstrap/route.ts` — Bootstrap proxy (captcha → session token)
- `app/(legal)/api/legal/voice/route.ts` — Voice recognition proxy (replaces textract)
- `app/(legal)/api/legal/session/[uuid]/route.ts` — Session detail proxy

### Modified Files
- `lib/legal/types.ts` — Add embed types, update actions, remove textract types
- `app/(legal)/api/legal/interact/route.ts` — Switch to embed endpoints, remove auth
- `app/(legal)/api/legal/upload/route.ts` — Switch to embed endpoint, remove auth
- `app/(legal)/api/legal/cancel/route.ts` — Switch to embed endpoint, remove auth, fix request body
- `hooks/use-legal-chat.ts` — Bootstrap flow, token management, voice API
- `components/legal/legal-chat.tsx` — Voice callback adaptation, upload token passthrough
- `lib/api/index.ts` — Remove textract exports, add voice export
- `.env.example` — Remove BEARER_TOKEN/CLIENTID

### Deleted Files
- `app/(legal)/api/textract/route.ts`
- `app/(legal)/api/textract/oss-info/route.ts`
- `lib/api/textract.ts`

---

### Task 1: Update Type Definitions

**Files:**
- Modify: `lib/legal/types.ts`

- [ ] **Step 1: Add embed types at the top of the file (after existing imports)**

在 `LegalMediaAttachment` 定义之前（约第 166 行）插入新类型：

```typescript
// ============================================================
// Embed API 类型
// ============================================================

// Bootstrap 请求
export interface BootstrapRequest {
  captchaToken: string;
  clientNonce: string;
  pageUrl: string;
  parentReferrer?: string;
}

// Bootstrap 响应
export interface BootstrapResponse {
  sessionUuid: string;
  embedSessionToken: string;
  expiresIn: number;
  idleExpiresIn: number;
  nextStep: string;
  message: string;
  prompt: string;
  limits: EmbedLimits;
}

// 会话限制
export interface EmbedLimits {
  maxRounds: number;
  maxInputChars: number;
  uploadLimitPerMinute: number;
  voiceLimitPerMinute: number;
}

// 语音识别响应
export interface VoiceRecognizeResponse {
  text: string;
  provider: string;
  elapsedMs: number;
}

// 会话详情
export interface EmbedSessionInfo {
  sessionUuid: string;
  currentStep: string;
  status: number;
  expireTime: string;
  messageCount: number;
  lastMessageText: string;
}
```

- [ ] **Step 2: Update `LegalInteractRequest` action union (line 205-210)**

Replace:
```typescript
  action?:
    | "continue"
    | "skip"
    | "generate_document"
    | "submit_answers"
    | string;
```

With:
```typescript
  action?:
    | "continue"
    | "skip"
    | "submit_answers"
    | "submit_pre_questions"
    | "pre_generate_document"
    | "close"
    | string;
```

- [ ] **Step 3: Update `LegalChatState` to include embed state (line 255-304)**

Add these fields after `error: string | null;` (line 262):

```typescript
  // embed 会话
  embedSessionToken: string | null;
  limits: EmbedLimits | null;
```

- [ ] **Step 4: Remove textract-related types (lines 216-253)**

Delete the following type definitions:
- `TextractRequest` (lines 216-219)
- `TextractResponse` (lines 222-225)
- `TextractFileResult` (lines 228-235)
- `TextractMultipleResponse` (lines 238-244)
- `FileUploadResponse` (lines 247-252)

- [ ] **Step 5: Commit**

```bash
git add lib/legal/types.ts
git commit -m "refactor: update type definitions for embed API migration"
```

---

### Task 2: Create Shared Proxy Utilities

**Files:**
- Create: `lib/legal/proxy-utils.ts`

将各 route 中重复的工具函数（getBaseUrl、读取 embed token、统一错误处理）提取到共享模块，避免每个 route 文件重复。

- [ ] **Step 1: Create `lib/legal/proxy-utils.ts`**

```typescript
import { NextResponse } from "next/server";

/**
 * 获取后端基础 URL
 */
export function getBaseUrl(): string {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("BASE_URL is not configured");
  }
  return baseUrl;
}

/**
 * 从请求中提取 embed session token
 */
export function getEmbedToken(request: Request): string | null {
  return request.headers.get("x-embed-session-token");
}

/**
 * 构建带 embed token 的请求头（JSON 请求）
 */
export function buildEmbedJsonHeaders(embedToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-embed-session-token": embedToken,
  };
}

/**
 * 构建带 embed token 的请求头（非 JSON 请求，如 multipart）
 */
export function buildEmbedHeaders(embedToken: string): HeadersInit {
  return {
    "x-embed-session-token": embedToken,
  };
}

/**
 * 安全读取 JSON 响应
 */
export async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 需要 embed token 的路由守卫，返回 token 或错误响应
 */
export function requireEmbedToken(
  request: Request
): { token: string } | { error: NextResponse } {
  const token = getEmbedToken(request);
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing x-embed-session-token header" },
        { status: 401 }
      ),
    };
  }
  return { token };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/legal/proxy-utils.ts
git commit -m "feat: add shared proxy utilities for embed API"
```

---

### Task 3: Create Bootstrap Proxy Route

**Files:**
- Create: `app/(legal)/api/legal/bootstrap/route.ts`

- [ ] **Step 1: Create the bootstrap route handler**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { getBaseUrl, safeReadJson } from "@/lib/legal/proxy-utils";

const requestSchema = z.object({
  captchaToken: z.string(),
  clientNonce: z.string(),
  pageUrl: z.string(),
  parentReferrer: z.string().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/app/legal/embed/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    const raw = await safeReadJson(response);
    const payload = raw as { code?: number; msg?: string; data?: unknown } | null;

    if (!response.ok || !payload || payload.code !== 200 || !payload.data) {
      const msg = payload?.msg || "Bootstrap failed";
      return NextResponse.json(
        { error: msg },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json(payload.data);
  } catch (error) {
    console.error("Bootstrap API error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(legal\)/api/legal/bootstrap/route.ts
git commit -m "feat: add bootstrap proxy route for embed API"
```

---

### Task 4: Rewrite Interact Proxy Route

**Files:**
- Modify: `app/(legal)/api/legal/interact/route.ts`

- [ ] **Step 1: Replace the entire file content**

完全重写，去掉 `getAuthHeaders`/`buildJsonHeaders`，去掉 session/create 分支，改用 embed 端点：

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import type { LegalApiResponse } from "@/lib/legal/types";
import {
  buildEmbedJsonHeaders,
  getBaseUrl,
  requireEmbedToken,
  safeReadJson,
} from "@/lib/legal/proxy-utils";

const requestSchema = z.object({
  session_id: z.string(),
  message: z.string().optional(),
  stream: z.boolean().optional().default(false),
  action: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  media_attachments: z
    .array(
      z.object({
        oss_id: z.number(),
        file_name: z.string().optional(),
        file_size: z.number().optional(),
        content_type: z.string().optional(),
        media_duration: z.number().int().optional(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  // 解析请求体
  let requestBody: z.infer<typeof requestSchema>;
  try {
    requestBody = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();
    const headers = buildEmbedJsonHeaders(token);

    const upstreamBody = {
      session_id: requestBody.session_id,
      message: requestBody.message,
      action: requestBody.action,
      data: requestBody.data,
      stream: Boolean(requestBody.stream),
      media_attachments: requestBody.media_attachments,
    };

    // 非流式请求
    if (!requestBody.stream) {
      const response = await fetch(`${baseUrl}/app/legal/embed/send`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
        signal: request.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Embed backend error:", errorText);
        return NextResponse.json(
          { error: "Backend service error" },
          { status: response.status }
        );
      }

      const raw = await safeReadJson(response);
      const payload = raw as { code?: number; msg?: string; data?: unknown } | null;
      if (!payload || payload.code !== 200 || !payload.data) {
        const msg = payload?.msg || "Backend service error";
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      const result = payload.data as {
        sessionId?: string;
        nextStep?: string;
        data?: Record<string, unknown> | null;
        message?: string | null;
      };

      const responseData: Record<string, unknown> =
        (result.data && typeof result.data === "object" ? result.data : {}) ?? {};
      if (!("message" in responseData) && result.message) {
        responseData.message = result.message;
      }

      const data: LegalApiResponse = {
        session_id: result.sessionId || requestBody.session_id || "",
        next_step: result.nextStep as LegalApiResponse["next_step"],
        data: responseData,
      };

      return NextResponse.json(data);
    }

    // 流式请求 - 代理 SSE
    const response = await fetch(`${baseUrl}/app/legal/embed/send_stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(upstreamBody),
      signal: request.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Embed backend stream error:", errorText);
      return NextResponse.json(
        { error: "Backend service error" },
        { status: response.status }
      );
    }

    const stream = response.body;
    if (!stream) {
      return NextResponse.json(
        { error: "No response stream" },
        { status: 500 }
      );
    }

    return new Response(stream, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Legal API error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}
```

关键变更：
- `session_id` 改为必填（bootstrap 后才有 session）
- 移除无 `session_id` 时的 session/create 分支
- 端点从 `/app/legal/ai/message/send[_stream]` → `/app/legal/embed/send[_stream]`
- 认证从 `Authorization: Bearer` → `x-embed-session-token` 透传

- [ ] **Step 2: Commit**

```bash
git add app/\(legal\)/api/legal/interact/route.ts
git commit -m "refactor: switch interact route to embed API endpoints"
```

---

### Task 5: Rewrite Upload Proxy Route

**Files:**
- Modify: `app/(legal)/api/legal/upload/route.ts`

- [ ] **Step 1: Replace the entire file content**

```typescript
import { NextResponse } from "next/server";

import {
  buildEmbedHeaders,
  getBaseUrl,
  requireEmbedToken,
} from "@/lib/legal/proxy-utils";

export async function POST(request: Request) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const backendFormData = new FormData();
    for (const file of files) {
      backendFormData.append("files", file, file.name);
    }

    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/app/legal/embed/upload/files`, {
      method: "POST",
      headers: buildEmbedHeaders(token),
      body: backendFormData,
      signal: request.signal,
    });

    let result: Record<string, unknown> | null = null;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      result = null;
    }

    if (!response.ok) {
      const msg = (result as { msg?: string })?.msg || "Upload failed";
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    if (result && (result as { code?: number }).code === 200 && (result as { data?: unknown }).data) {
      return NextResponse.json((result as { data: unknown }).data);
    }

    return NextResponse.json(
      { error: (result as { msg?: string })?.msg || "Upload failed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Legal upload API error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(legal\)/api/legal/upload/route.ts
git commit -m "refactor: switch upload route to embed API endpoint"
```

---

### Task 6: Create Voice Recognition Proxy Route

**Files:**
- Create: `app/(legal)/api/legal/voice/route.ts`

- [ ] **Step 1: Create the voice route handler**

```typescript
import { NextResponse } from "next/server";

import {
  buildEmbedHeaders,
  getBaseUrl,
  requireEmbedToken,
} from "@/lib/legal/proxy-utils";

export async function POST(request: Request) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);

    const baseUrl = getBaseUrl();
    const response = await fetch(
      `${baseUrl}/app/legal/embed/voice/recognize`,
      {
        method: "POST",
        headers: buildEmbedHeaders(token),
        body: backendFormData,
        signal: request.signal,
      }
    );

    let result: Record<string, unknown> | null = null;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      result = null;
    }

    if (!response.ok) {
      const msg = (result as { msg?: string })?.msg || "Voice recognition failed";
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    if (result && (result as { code?: number }).code === 200 && (result as { data?: unknown }).data) {
      // 返回 { text, provider, elapsedMs }
      return NextResponse.json((result as { data: unknown }).data);
    }

    return NextResponse.json(
      { error: (result as { msg?: string })?.msg || "Voice recognition failed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Voice recognition API error:", error);
    return NextResponse.json(
      { error: "Voice recognition failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(legal\)/api/legal/voice/route.ts
git commit -m "feat: add voice recognition proxy route for embed API"
```

---

### Task 7: Rewrite Cancel Proxy Route

**Files:**
- Modify: `app/(legal)/api/legal/cancel/route.ts`

- [ ] **Step 1: Replace the entire file content**

后端 embed cancel 接口接收 `{ sessionUuid, messageId? }`，字段名与当前不同（当前用 `session_id`）。

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildEmbedJsonHeaders,
  getBaseUrl,
  requireEmbedToken,
} from "@/lib/legal/proxy-utils";

const requestSchema = z.object({
  sessionUuid: z.string(),
  messageId: z.number().optional(),
});

export async function POST(request: Request) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/app/legal/embed/cancel`, {
      method: "POST",
      headers: buildEmbedJsonHeaders(token),
      body: JSON.stringify(body),
      signal: request.signal,
    });

    let result: Record<string, unknown> | null = null;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      result = null;
    }

    if (!response.ok) {
      const msg = (result as { msg?: string })?.msg || "Cancel failed";
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    if (result && (result as { code?: number }).code === 200) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: (result as { msg?: string })?.msg || "Cancel failed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Legal cancel API error:", error);
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
}
```

注意：cancel 请求体字段从 `{ session_id, message_id }` 改为 `{ sessionUuid, messageId }`，需要同步更新 hook 中的 `postCancel` 调用。

- [ ] **Step 2: Commit**

```bash
git add app/\(legal\)/api/legal/cancel/route.ts
git commit -m "refactor: switch cancel route to embed API endpoint"
```

---

### Task 8: Create Session Detail Proxy Route

**Files:**
- Create: `app/(legal)/api/legal/session/[uuid]/route.ts`

- [ ] **Step 1: Create the session detail route handler**

```typescript
import { NextResponse } from "next/server";

import {
  buildEmbedHeaders,
  getBaseUrl,
  requireEmbedToken,
} from "@/lib/legal/proxy-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  const { uuid } = await params;

  if (!uuid) {
    return NextResponse.json(
      { error: "Session UUID is required" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(
      `${baseUrl}/app/legal/embed/session/${uuid}`,
      {
        method: "GET",
        headers: buildEmbedHeaders(token),
        signal: request.signal,
      }
    );

    let result: Record<string, unknown> | null = null;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      result = null;
    }

    if (!response.ok) {
      const msg = (result as { msg?: string })?.msg || "Failed to get session";
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    if (result && (result as { code?: number }).code === 200 && (result as { data?: unknown }).data) {
      return NextResponse.json((result as { data: unknown }).data);
    }

    return NextResponse.json(
      { error: (result as { msg?: string })?.msg || "Failed to get session" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Session detail API error:", error);
    return NextResponse.json(
      { error: "Failed to get session detail" },
      { status: 500 }
    );
  }
}
```

注意：Next.js 16 的动态路由 params 是 `Promise<{ uuid: string }>`，需要 `await params`。

- [ ] **Step 2: Commit**

```bash
git add app/\(legal\)/api/legal/session/\[uuid\]/route.ts
git commit -m "feat: add session detail proxy route for embed API"
```

---

### Task 9: Rewrite the Chat Hook

**Files:**
- Modify: `hooks/use-legal-chat.ts`

这是最大的改动。核心变更：
1. 新增 `embedSessionToken` 和 `limits` 状态
2. `initSession` → 调用 `/api/legal/bootstrap`
3. 所有 fetch 附加 `x-embed-session-token` header
4. `postCancel` 请求体改为 `{ sessionUuid }`
5. Token 过期自动重 bootstrap

- [ ] **Step 1: Update initial state (lines 32-70)**

在 `initialState` 中新增 embed 字段：

```typescript
const initialState: LegalChatState = {
  sessionId: null,
  currentStep: "greeting",
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,

  // embed 会话
  embedSessionToken: null,
  limits: null,

  // greeting
  greeting: undefined,

  // consulting
  consultationProgress: null,
  needMoreInfo: false,
  canProceed: false,

  // select_document_path
  caseInfo: undefined,
  documentPaths: [],
  recommendedPath: null,
  selectedPath: null,

  // ask_question
  currentQuestion: null,
  questionProgress: null,
  requireAttachment: false,
  attachmentHint: null,
  factAnalysis: null,
  pathInfo: null,

  // check_labor_contract
  canSkipContract: false,

  // supplement_info
  supplementFields: [],

  // completed
  completedDocument: undefined,
};
```

- [ ] **Step 2: Update `postInteract` to pass embed token (lines 237-249)**

Replace:
```typescript
  const postInteract = useCallback(
    (body: LegalInteractRequest, signal: AbortSignal) => {
      return fetch("/api/legal/interact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
    },
    []
  );
```

With:
```typescript
  const postInteract = useCallback(
    (body: LegalInteractRequest, signal: AbortSignal) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (state.embedSessionToken) {
        headers["x-embed-session-token"] = state.embedSessionToken;
      }
      return fetch("/api/legal/interact", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
    },
    [state.embedSessionToken]
  );
```

- [ ] **Step 3: Update `postCancel` to use embed format (lines 251-263)**

Replace:
```typescript
  const postCancel = useCallback(async (sessionId: string) => {
    try {
      await fetch("/api/legal/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      // best-effort
    }
  }, []);
```

With:
```typescript
  const postCancel = useCallback(
    async (sessionId: string) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (state.embedSessionToken) {
          headers["x-embed-session-token"] = state.embedSessionToken;
        }
        await fetch("/api/legal/cancel", {
          method: "POST",
          headers,
          body: JSON.stringify({ sessionUuid: sessionId }),
        });
      } catch {
        // best-effort
      }
    },
    [state.embedSessionToken]
  );
```

- [ ] **Step 4: Rewrite `initSession` to use bootstrap (lines 793-823)**

Replace the entire `initSession` callback:
```typescript
  const initSession = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/legal/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captchaToken: "mock-pass",
          clientNonce: `nonce-${Date.now()}-${generateUUID().slice(0, 8)}`,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          parentReferrer:
            typeof document !== "undefined" ? document.referrer : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ||
            "Failed to initialize session"
        );
      }

      const data = (await response.json()) as {
        sessionUuid: string;
        embedSessionToken: string;
        expiresIn: number;
        idleExpiresIn: number;
        nextStep: string;
        message: string;
        prompt: string;
        limits: {
          maxRounds: number;
          maxInputChars: number;
          uploadLimitPerMinute: number;
          voiceLimitPerMinute: number;
        };
      };

      // 更新状态
      setState((prev) => ({
        ...prev,
        sessionId: data.sessionUuid,
        embedSessionToken: data.embedSessionToken,
        limits: data.limits,
        currentStep: "greeting" as const,
        isLoading: false,
        greeting: {
          message: data.message || "",
          prompt: data.prompt || "请描述您的问题或案件情况：",
        },
      }));

      // 添加欢迎消息
      addAssistantMessage(data.message || "欢迎使用法律文书助手", "greeting", {
        message: data.message,
        prompt: data.prompt,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize session",
      }));
    }
  }, [addAssistantMessage]);
```

- [ ] **Step 5: Update `reset` to clear embed state (lines 783-790)**

Replace:
```typescript
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState(initialState);
  }, []);
```

With:
```typescript
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState(initialState);
  }, []);
```

（`initialState` 已包含 `embedSessionToken: null` 和 `limits: null`，无需额外修改。但确保 `initialState` 已更新。）

- [ ] **Step 6: Export `embedSessionToken` and `limits` from the hook return (lines 825-841)**

Replace:
```typescript
  return {
    // 状态
    ...state,
    streamingEnabled,

    // 方法
    sendMessage,
    selectPath,
    autoContinue,
    skipContractCheck,
    submitSupplementInfo,
    stopStream,
    reset,
    initSession,
    setStreamingEnabled,
  };
```

The `...state` spread already includes `embedSessionToken` and `limits` since they're part of `LegalChatState`. No code change needed here, but verify `LegalChatState` type was updated in Task 1.

- [ ] **Step 7: Update dependency arrays**

Verify these dependency arrays include `state.embedSessionToken` where relevant:
- `postInteract` deps: `[state.embedSessionToken]`
- `postCancel` deps: `[state.embedSessionToken]`
- `sendMessage` deps: 已经包含 `postInteract`、`postCancel`（间接依赖）

- [ ] **Step 8: Commit**

```bash
git add hooks/use-legal-chat.ts
git commit -m "refactor: rewrite chat hook for embed API bootstrap and token management"
```

---

### Task 10: Update Legal Chat Component

**Files:**
- Modify: `components/legal/legal-chat.tsx`

- [ ] **Step 1: Update voice recognition callback (lines 617-642)**

Replace the `handleVoiceRecordingComplete` callback. 新 API 直接返回 `{ text, provider, elapsedMs }`，不再是 textract 的嵌套格式。

```typescript
  // 语音录制完成后处理（只填充文本，不添加附件）
  const handleVoiceRecordingComplete = useCallback(
    async (blob: Blob, _duration: number) => {
      try {
        const file = new File(
          [blob],
          `voice_${Date.now()}.webm`,
          { type: blob.type }
        );

        const formData = new FormData();
        formData.append("file", file);

        const headers: Record<string, string> = {};
        if (embedSessionToken) {
          headers["x-embed-session-token"] = embedSessionToken;
        }

        const response = await fetch("/api/legal/voice", {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          toast.error(
            (errorData as { error?: string }).error || "语音识别失败"
          );
          return;
        }

        const data = (await response.json()) as { text: string };

        if (data.text) {
          setInputValue((prev) =>
            prev ? `${prev} ${data.text}` : data.text
          );
        } else {
          toast.error("语音识别未返回结果");
        }
      } catch {
        toast.error("语音识别失败");
      }
    },
    [embedSessionToken]
  );
```

- [ ] **Step 2: Destructure `embedSessionToken` from the hook (line 404-438)**

Add `embedSessionToken` to the destructured hook return:

```typescript
  const {
    // 状态
    currentStep,
    messages,
    isLoading,
    isStreaming,
    error,
    embedSessionToken,
    // 各阶段专属状态
    caseInfo,
    // ... rest unchanged
```

- [ ] **Step 3: Update upload function to pass embed token (lines 524-563)**

Replace:
```typescript
      const response = await fetch("/api/legal/upload", {
        method: "POST",
        body: formData,
      });
```

With:
```typescript
      const headers: Record<string, string> = {};
      if (embedSessionToken) {
        headers["x-embed-session-token"] = embedSessionToken;
      }

      const response = await fetch("/api/legal/upload", {
        method: "POST",
        headers,
        body: formData,
      });
```

并更新 `uploadFilesToLegalUpload` 的依赖数组为 `[embedSessionToken]`。

- [ ] **Step 4: Remove the `recognizeVoice` import (line 15)**

Remove:
```typescript
import { recognizeVoice } from "@/lib/api";
```

这个 import 不再需要，语音识别已内联到 `handleVoiceRecordingComplete` 中。

- [ ] **Step 5: Commit**

```bash
git add components/legal/legal-chat.tsx
git commit -m "refactor: update legal chat component for embed API"
```

---

### Task 11: Delete Old Files and Update Exports

**Files:**
- Delete: `app/(legal)/api/textract/route.ts`
- Delete: `app/(legal)/api/textract/oss-info/route.ts`
- Delete: `lib/api/textract.ts`
- Modify: `lib/api/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Delete textract files**

```bash
rm app/\(legal\)/api/textract/route.ts
rm app/\(legal\)/api/textract/oss-info/route.ts
rmdir app/\(legal\)/api/textract/oss-info
rmdir app/\(legal\)/api/textract
rm lib/api/textract.ts
```

- [ ] **Step 2: Update `lib/api/index.ts`**

Replace entire file:

```typescript
/**
 * API 模块统一导出
 */

export type {
  ApiResponse,
  ErrorInterceptor,
  HttpMethod,
  RequestInterceptor,
  RequestOptions,
  ResponseInterceptor,
} from "@/lib/request";
export {
  addErrorInterceptor,
  addRequestInterceptor,
  addResponseInterceptor,
  del,
  get,
  patch,
  post,
  put,
  RequestError,
  request,
  upload,
} from "@/lib/request";
```

- [ ] **Step 3: Update `.env.example`**

Replace entire file:

```
# RuoYi Legal App AI 后端（用于 /app/(legal) 法律对话）
# 统一后端 Base URL（例如 http://localhost:8080）
BASE_URL=http://localhost:8080
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove textract files and legacy auth env vars"
```

---

### Task 12: Lint Check and Final Verification

**Files:** All modified files

- [ ] **Step 1: Run linter**

```bash
pnpm lint
```

Expected: No errors. If there are lint issues, fix them.

- [ ] **Step 2: Run format**

```bash
pnpm format
```

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Expected: Build succeeds without type errors.

- [ ] **Step 4: Fix any issues found**

Address compilation errors, missing imports, type mismatches.

- [ ] **Step 5: Final commit if there were fixes**

```bash
git add -A
git commit -m "fix: resolve lint and build issues from embed API migration"
```

---

## Execution Notes

- Task 1 (types) must be done first — all other tasks depend on it.
- Task 2 (proxy utils) should be done before Tasks 3-8 as they import from it.
- Tasks 3-8 (proxy routes) are independent of each other and can run in parallel.
- Task 9 (hook) depends on Task 1 and the cancel route body format from Task 7.
- Task 10 (component) depends on Tasks 9 and 6.
- Task 11 (cleanup) should be done after all route changes.
- Task 12 (verification) is always last.
