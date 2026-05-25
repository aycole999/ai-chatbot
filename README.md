# 法律文书助手前端

当前项目是一个基于 Next.js 16 的法律文书助手前端，默认通过 Next.js API Routes 代理到后端 `BASE_URL`。

语音输入在部署环境中的排查与上线注意事项见：

- `docs/voice-input-deployment-guide.md`

iframe 嵌入场景的对接说明见：

- `docs/iframe-integration-guide.md`

## Runtime Requirements

当前仓库不再依赖以下基础设施：

- Redis
- PostgreSQL
- Vercel Blob

本地和部署环境当前只需要配置后端地址：

```bash
BASE_URL=http://localhost:8080
```

## Running Locally

```bash
pnpm install
pnpm dev
```

应用默认运行在 [http://localhost:3000](http://localhost:3000)。

## Production Build

```bash
pnpm install
pnpm build
pnpm start
```

## Docker Deployment

仓库已补充 `script/docker/` 部署目录，用于和 `legal-web` 一样通过独立 nginx 容器作为前端入口。
如果需要在 IDEA 中直接构建镜像，推荐使用仓库根目录的 `Dockerfile`。

推荐链路：

```text
browser / frpc / Nginx Proxy Manager -> ai-chatbot-nginx -> ai-chatbot -> backend nginx /prod-api -> ruoyi-server
```

快速开始：

```bash
./script/docker/build-image.sh
cd script/docker/prod/ai-chatbot
cp .env.example .env
docker compose up -d
```

默认关键变量：

```bash
AI_CHATBOT_IMAGE=ai-chatbot:latest
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
PROXY_DOCKER_NETWORK=proxy-net
BASE_URL=http://nginx-web/prod-api
AI_CHATBOT_HTTP_PORT=182
```

如果需要同时运行 dev/prod，使用 `script/docker/dev/ai-chatbot` 和 `script/docker/prod/ai-chatbot` 两套部署目录。详细说明见 `script/docker/README-dual-env.md`。
