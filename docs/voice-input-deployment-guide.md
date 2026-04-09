# 语音输入部署排查指南

本文档用于排查当前项目中“本地语音输入正常，但部署到服务器后点击语音输入无反应”的问题。

适用范围：

- 法律咨询页面语音输入
- `components/legal/voice-input.tsx`
- `hooks/use-voice-recorder.ts`
- `/api/legal/voice`

## 1. 当前语音链路

当前项目的语音输入分为两段：

1. 浏览器申请麦克风并录音
2. 前端将录音文件上传到 `/api/legal/voice`
3. Next.js API 再代理到后端 `${BASE_URL}/app/legal/embed/voice/recognize`
4. 后端返回识别文本，前端写回输入框

对应代码位置：

- 录音与权限申请: `hooks/use-voice-recorder.ts`
- 录音 UI: `components/legal/voice-input.tsx`
- 识别结果写回输入框: `components/legal/legal-chat.tsx`
- 语音代理接口: `app/(legal)/api/legal/voice/route.ts`

因此要区分两类问题：

- 点击麦克风后根本没有进入录音态
- 已经录到音，但识别请求失败

如果用户反馈是“点击完全没反应”，优先排查浏览器侧权限和安全上下文，而不是后端识别接口。

## 2. 最常见原因

### 2.1 线上页面不是安全上下文

`navigator.mediaDevices.getUserMedia({ audio: true })` 只能在安全上下文中使用。

本地 `localhost` 属于浏览器特例，即使不是 HTTPS 也通常可以录音；但线上部署后如果是以下场景，就会失败：

- 使用 `http://` 访问
- 使用裸 IP 访问
- 证书无效或浏览器不信任
- 反向代理导致浏览器判定当前页不是安全上下文

这类问题的典型表现就是：

- 点击麦克风无反应
- 没进入录音态
- 不会走到 `/api/legal/voice`

### 2.2 页面运行在 iframe/embed 中，但没有放开麦克风权限

当前项目是 embed 场景，启动时会透传 `Origin` 和 embed token。

如果页面被嵌在 iframe 中，除了 HTTPS，还必须满足：

- iframe 带 `allow="microphone"`
- 宿主页面没有通过 `Permissions-Policy` 禁止麦克风

如果缺少这些条件，也会表现为“点击没反应”。

### 2.3 浏览器权限被拒绝

当前前端逻辑在权限失败时会更新内部状态，但对用户的可见提示不够强。

典型情况：

- 浏览器之前拒绝过麦克风
- 浏览器地址栏权限是“已阻止”
- 系统层面禁用了浏览器麦克风权限

表现同样可能接近“按钮无反应”。

### 2.4 生产环境浏览器能力差异

当前录音逻辑优先使用：

- `audio/webm`
- 不支持时退回 `audio/mp4`

如果部署后访问环境是某些受限浏览器、企业环境浏览器或 WebView，可能出现：

- `MediaRecorder` 不可用
- 音频 MIME 类型支持异常
- 录音启动失败

### 2.5 后端代理或识别接口异常

这类问题通常不是“点击没反应”，而是：

- 已经能录音
- 点击确认后返回“语音识别失败”

常见原因：

- `BASE_URL` 配置错误
- 后端 `/app/legal/embed/voice/recognize` 不通
- embed token 校验失败
- 反向代理丢失 `Origin` 或请求头

## 3. 推荐排查顺序

### 第一步：确认是不是浏览器录音阶段就失败了

在部署环境页面打开浏览器控制台，执行：

```js
window.isSecureContext
```

期望结果：

```js
true
```

如果是 `false`，说明当前页面不是安全上下文，语音输入无法工作。

再执行：

```js
typeof navigator.mediaDevices
```

期望结果：

```js
"object"
```

再执行：

```js
typeof navigator.mediaDevices?.getUserMedia
```

期望结果：

```js
"function"
```

如果这里不成立，优先处理 HTTPS / iframe / 权限策略问题。

### 第二步：直接测试麦克风权限

在控制台执行：

```js
await navigator.mediaDevices.getUserMedia({ audio: true })
```

如果这里直接报错，说明问题还在浏览器录音阶段，不在后端。

常见报错含义：

- `NotAllowedError`: 用户拒绝权限、iframe 未授权、权限策略限制
- `NotFoundError`: 系统没有可用麦克风设备
- `NotReadableError`: 麦克风被别的程序占用
- `SecurityError`: 当前环境不允许访问麦克风

### 第三步：确认是否为 iframe 权限问题

如果项目部署后是嵌入到其他站点中的，需要检查宿主 iframe：

```html
<iframe
  src="https://your-chatbot-domain"
  allow="microphone"
></iframe>
```

至少要有：

```html
allow="microphone"
```

如果宿主没有带这个属性，前端无法录音。

### 第四步：检查响应头是否禁止麦克风

检查线上页面响应头是否存在类似配置：

```http
Permissions-Policy: microphone=()
```

如果是这种配置，浏览器会禁止麦克风访问。

如果是 iframe 嵌入场景，宿主站和网关都需要一起检查。

### 第五步：确认是否已经进入录音态

当前项目点击语音按钮后，正常情况应该：

- 输入框切换到录音态
- 显示波形动画和确认/取消按钮

如果这些 UI 完全没有出现，说明失败发生在：

- `requestPermission()`
- `startRecording()`

对应代码：

- `components/legal/voice-input.tsx`
- `hooks/use-voice-recorder.ts`

### 第六步：如果能录音，再检查识别接口

如果已经能录音，但确认后没有识别文本，则检查：

- 浏览器 Network 面板里 `/api/legal/voice` 是否发出
- 返回状态码是否是 `200`
- Next.js 服务日志是否打印 `Voice recognition API error`
- 后端 `${BASE_URL}/app/legal/embed/voice/recognize` 是否正常

## 4. 生产环境专项检查清单

上线前建议逐项确认：

- 页面通过 HTTPS 域名访问
- 浏览器地址栏证书状态正常
- 非裸 IP 访问
- 如果是 iframe 嵌入，iframe 带 `allow="microphone"`
- 没有错误的 `Permissions-Policy: microphone=()`
- 部署环境浏览器支持 `MediaRecorder`
- 服务器 `BASE_URL` 已正确配置
- 后端语音识别接口在当前网络下可达
- 反向代理没有丢掉 `Origin` 和 `x-embed-session-token`

## 5. 当前项目中的已知特点

### 5.1 本地能用不代表线上一定能用

因为本地 `localhost` 被浏览器视为安全上下文特例，所以本地录音通过并不能证明线上环境满足录音条件。

### 5.2 当前前端对失败原因提示不够明显

当前代码在这些场景下用户提示比较弱：

- 麦克风权限被拒绝
- 页面不是安全上下文
- iframe 没有麦克风权限
- `MediaRecorder` 初始化失败

因此线上很容易被描述为“点击没反应”，但真实原因通常是浏览器已拒绝调用。

### 5.3 语音识别代理依赖 `BASE_URL`

`/api/legal/voice` 本质上是转发：

```text
/api/legal/voice
-> ${BASE_URL}/app/legal/embed/voice/recognize
```

如果录音可以开始，但识别失败，再重点看 `BASE_URL`、后端接口、网关和 token 透传。

## 6. 推荐的线上排查流程

建议按下面顺序处理：

1. 先确认访问地址是否为 HTTPS 域名
2. 再确认是否为 iframe 嵌入场景
3. 若是 iframe，确认 `allow="microphone"`
4. 在浏览器控制台验证 `window.isSecureContext`
5. 手动执行 `navigator.mediaDevices.getUserMedia({ audio: true })`
6. 若录音正常，再检查 `/api/legal/voice` 请求与服务端日志

## 7. 常见结论模板

### 场景 A：点击没反应，本地正常，线上是 HTTP

结论：

- 原因是线上不是安全上下文
- 录音权限申请在浏览器侧就失败
- 与后端识别接口无关

### 场景 B：点击没反应，页面嵌在 iframe 内

结论：

- 高概率是 iframe 未加 `allow="microphone"`
- 或宿主站的 `Permissions-Policy` 禁掉了麦克风

### 场景 C：可以录音，但确认后无法转文字

结论：

- 浏览器录音能力正常
- 问题在 `/api/legal/voice` 或后端识别链路
- 优先检查 `BASE_URL`、token、后端接口、网关日志

## 8. 后续建议

为了避免线上继续出现“点击没反应但原因不明”的情况，建议后续补两类增强：

- 前端增加更明确的错误提示
  - 区分 HTTPS 问题、权限问题、iframe 权限问题、浏览器不支持
- 增加线上可观测性
  - 录音申请失败日志
  - `/api/legal/voice` 请求日志
  - 后端识别接口失败原因透出

如果需要进一步落地，可以继续补一版“语音输入诊断增强”，把错误信息直接展示给用户和运维人员。
