# iframe 对接指南

本文档用于说明当前法律文书助手前端在 iframe 场景下的接入方式、权限配置、上线注意事项与常见问题排查方法。

适用场景：

- 业务系统通过 iframe 嵌入本项目页面
- 需要使用语音输入
- 需要下载生成的文书
- 需要兼容生产环境浏览器限制

## 1. 推荐接入方式

推荐的 iframe 配置如下：

```html
<iframe
  src="https://your-ai-chat-domain"
  class="w-full h-full border-0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
  allow="microphone"
></iframe>
```

如果你们使用 Vue 模板，可以写成：

```vue
<iframe
  :src="aiChatUrl"
  class="w-full h-full border-0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
  allow="microphone"
/>
```

## 2. 每个权限的作用

### sandbox

推荐值：

```text
allow-scripts allow-same-origin allow-forms allow-popups allow-downloads
```

含义如下：

- `allow-scripts`
  - 允许页面 JS 运行
  - 没有它，页面基本无法正常工作

- `allow-same-origin`
  - 允许 iframe 页面保持原始 origin
  - 没有它，很多前端能力会受限

- `allow-forms`
  - 允许表单行为
  - 当前项目里上传、交互类场景建议保留

- `allow-popups`
  - 允许弹出新窗口
  - 某些浏览器或后续新窗口交互可能依赖它

- `allow-downloads`
  - 允许 iframe 内触发下载
  - 当前项目文书下载必须重点关注这一项

### allow

推荐值：

```text
microphone
```

含义如下：

- `allow="microphone"`
  - 允许 iframe 内页面申请麦克风权限
  - 当前项目语音输入必须配置

## 3. 为什么语音需要这样配

当前项目的语音输入依赖浏览器原生能力：

- `navigator.mediaDevices.getUserMedia({ audio: true })`
- `MediaRecorder`

所以语音输入必须同时满足：

1. iframe 页面本身通过 HTTPS 访问
2. iframe 带 `allow="microphone"`
3. 宿主页面或网关没有通过 `Permissions-Policy` 禁止麦克风

如果本地可用、线上 iframe 中点击语音没反应，优先检查这三项。

相关实现位置：

- `components/legal/voice-input.tsx`
- `hooks/use-voice-recorder.ts`
- `app/(legal)/api/legal/voice/route.ts`

## 4. 为什么下载需要这样配

当前项目的文书下载是前端先请求下载代理接口，再通过浏览器脚本触发下载。

下载链路：

1. 前端请求 `/api/document/download/[documentId]`
2. Next.js 代理到后端下载接口
3. 前端收到文件流后，通过 `blob + a.click()` 触发浏览器下载

在普通独立页面里，这通常可行；但在 iframe 中，如果没有：

```text
allow-downloads
```

浏览器很可能直接拦截下载，表现为：

- 点击下载没有反应
- 没有明显错误提示
- 本地独立页可以下载，但 iframe 内不行

相关实现位置：

- `components/legal/legal-chat.tsx`
- `app/api/document/download/[documentId]/route.ts`

## 5. 生产环境必须满足的前置条件

### 5.1 必须使用 HTTPS

无论是语音还是更严格的浏览器能力控制，生产环境都建议只在 HTTPS 下运行。

尤其是语音输入：

- `localhost` 本地可用，不代表线上环境也一定可用
- 裸 IP、HTTP、证书异常域名都可能导致浏览器拒绝麦克风

### 5.2 不要用裸 IP 作为正式入口

推荐使用正式域名，例如：

```text
https://ai-chat.example.com
```

不要依赖：

```text
http://1.2.3.4:3000
```

### 5.3 检查宿主站的响应头策略

如果宿主系统或上层 nginx 设置了过严的权限策略，也会影响 iframe 内能力。

重点检查是否存在类似响应头：

```http
Permissions-Policy: microphone=()
```

如果有这种配置，iframe 内会被禁止使用麦克风。

## 6. 当前项目对接时的推荐模板

推荐直接使用下面这份模板：

```vue
<template>
  <iframe
    :src="aiChatUrl"
    class="w-full h-full border-0"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
    allow="microphone"
  />
</template>

<script setup lang="ts">
const aiChatUrl = "https://your-ai-chat-domain";
</script>
```

## 7. 常见问题排查

### 7.1 语音输入点击没反应

优先检查：

1. 页面是否 HTTPS
2. iframe 是否带 `allow="microphone"`
3. 宿主页面是否有 `Permissions-Policy: microphone=()`
4. 浏览器是否已经拒绝麦克风权限

浏览器控制台可执行：

```js
window.isSecureContext
```

期望结果：

```js
true
```

再执行：

```js
typeof navigator.mediaDevices?.getUserMedia
```

期望结果：

```js
"function"
```

### 7.2 文书下载点击没反应

优先检查：

1. iframe `sandbox` 是否包含 `allow-downloads`
2. Network 面板里是否有 `/api/document/download/...` 请求
3. 是否只有 iframe 内不行，而独立页面正常

如果独立页正常、iframe 内不正常，通常优先怀疑 iframe 下载权限，而不是后端下载接口。

### 7.3 本地正常，生产环境 iframe 中异常

优先怀疑：

- 安全上下文差异
- iframe 权限差异
- 宿主页面安全策略差异

不要先默认判断为前端业务逻辑问题。

## 8. 上线前检查清单

建议在宿主系统上线前逐项确认：

- iframe 使用 HTTPS 地址
- iframe 带 `allow="microphone"`
- iframe `sandbox` 包含 `allow-downloads`
- iframe `sandbox` 包含 `allow-scripts allow-same-origin allow-forms`
- 宿主站没有禁用 `microphone`
- 文书下载按钮在 iframe 中可以实际触发下载
- 语音按钮在 iframe 中可以正常弹出麦克风权限

## 9. 与当前项目相关的补充说明

### 9.1 语音与下载是两类不同权限

需要明确区分：

- 语音依赖：
  - `allow="microphone"`
  - HTTPS

- 下载依赖：
  - `sandbox` 中的 `allow-downloads`

它们互相不能替代。

### 9.2 当前推荐的最小安全可用配置

```html
<iframe
  src="https://your-ai-chat-domain"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
  allow="microphone"
></iframe>
```

如果后续宿主系统还有额外限制，需要基于浏览器控制台与 Network 面板继续排查。
