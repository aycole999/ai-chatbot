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

仓库已补充 `script/docker/` 部署目录，用于和后端现有 docker/nginx 编排方式对齐。
如果需要在 IDEA 中直接构建镜像，推荐使用仓库根目录的 `Dockerfile`。

推荐链路：

```text
browser -> backend nginx -> ai-chatbot -> backend nginx /prod-api -> ruoyi-server
```

快速开始：

```bash
./script/docker/build-image.sh
cd script/docker
cp .env.example .env
docker compose up -d
```

默认关键变量：

```bash
AI_CHATBOT_IMAGE=ai-chatbot:latest
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
BASE_URL=http://nginx-web/prod-api
```

如果需要基于源码本地构建镜像，则使用 `script/docker/docker-compose.build.yml`。后端 nginx 并入示例见 `script/docker/nginx/chat.server.conf.example`，详细说明见 `script/docker/README.md`。
