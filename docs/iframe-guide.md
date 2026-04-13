# iframe 对接指南

本文档用于说明当前法律文书助手前端在 iframe 场景下的接入方式。

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