# Docker Deployment

当前目录提供 `ai-chatbot` 的容器化部署方案。部署方式已改为独立 nginx 入口容器，整体模式对齐 `/home/aycole/ideaProgram/legal-web`。

> 新部署优先使用 `script/docker/dev/ai-chatbot` 与 `script/docker/prod/ai-chatbot` 双环境目录。旧的 `script/docker/docker-compose.yml` 和 `script/docker/docker-compose.build.yml` 保留为单环境兼容入口。双环境说明见 `script/docker/README-dual-env.md`。

## 目录说明

- `docker-compose.yml`：镜像部署编排，服务器推荐使用
- `docker-compose.build.yml`：需要基于源码本地构建镜像时使用
- `app/Dockerfile`：Next.js 生产镜像构建
- `ai-chatbot/nginx/conf/nginx.conf`：独立 nginx 入口配置
- `ai-chatbot/nginx/log/`：独立 nginx 访问日志与错误日志目录
- `.env.example`：镜像部署变量示例
- `.env.build.example`：本地构建镜像时的变量示例

## 部署拓扑

```text
浏览器 / frpc / Nginx Proxy Manager
  -> proxy-net
  -> ai-chatbot-nginx:80
  -> chatbot-net
  -> ai-chatbot:3000
  -> ruoyi-net
  -> nginx-web/prod-api
  -> ruoyi-server*
```

说明：

1. `ai-chatbot-nginx` 是当前前端的唯一对外入口。
2. `ai-chatbot` 容器只在 Docker 网络内暴露 `3000`，不再直接映射宿主机端口。
3. `ai-chatbot-nginx` 加入 `proxy-net`，外层 frpc / Nginx Proxy Manager 可以通过容器名 `ai-chatbot-nginx` 访问。
4. `ai-chatbot` 继续通过 `BASE_URL=http://nginx-web/prod-api` 访问后端接口，保留 Next.js Route Handlers 中的 token、Origin、SSE 代理逻辑。

## 推荐部署方式

线上环境默认使用 `prod/ai-chatbot/docker-compose.yml` 直接启动镜像，不推荐在服务器上拿单独的 docker 目录再本地构建。

原因：

1. 不依赖服务器上的前端源码路径。
2. 不会出现 `build.context`、`Dockerfile` 相对路径失效问题。
3. 更适合 CI/CD，也更符合生产环境职责分离。

### 方式 A：镜像部署，推荐

先在有完整源码的环境构建镜像。你如果和后端一样在 IDEA 的 Docker 服务里执行 Dockerfile，这一步也适用。

推荐先使用统一脚本构建镜像：

```bash
./script/docker/build-image.sh
```

也可以显式指定镜像名：

```bash
./script/docker/build-image.sh ai-chatbot:latest
```

命令行等价示例：

```bash
docker build -f Dockerfile -t registry.example.com/ai-chatbot:latest .
docker push registry.example.com/ai-chatbot:latest
```

如果不是推镜像仓库，而是像后端那样把镜像导入服务器 docker，也可以：

```bash
docker build -f Dockerfile -t ai-chatbot:latest .
docker save -o ai-chatbot-latest.tar ai-chatbot:latest
```

服务器导入：

```bash
docker load -i ai-chatbot-latest.tar
```

服务器只保留部署目录即可，例如：

```text
/home/hrsaas/docker/ai-chatbot/docker/
  ├─ docker-compose.yml
  ├─ ai-chatbot/
  │  └─ nginx/
  │     ├─ conf/
  │     │  └─ nginx.conf
  │     └─ log/
  ├─ README.md
  ├─ .env
  └─ .env.example
```

`.env` 示例：

```env
AI_CHATBOT_IMAGE=ai-chatbot:latest
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
PROXY_DOCKER_NETWORK=proxy-net
BASE_URL=http://nginx-web/prod-api
AI_CHATBOT_HTTP_PORT=182
```

启动：

```bash
cp .env.example .env
docker compose up -d
```

如果镜像已经更新，服务器执行：

```bash
docker compose up -d --force-recreate
```

### 方式 B：服务器本地构建

只有在服务器上存在完整前端源码时，才建议使用 `docker-compose.build.yml`。

```bash
cd script/docker
cp .env.build.example .env
docker compose -f docker-compose.build.yml up -d --build
```

如果把整个 docker 目录单独拷贝到部署目录，必须手动指定前端源码真实路径。

示例：

```env
APP_BUILD_CONTEXT=/home/hrsaas/project/ai-chatbot
APP_DOCKERFILE=/home/hrsaas/docker/ai-chatbot/app/Dockerfile
AI_CHATBOT_IMAGE=ai-chatbot:latest
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
PROXY_DOCKER_NETWORK=proxy-net
BASE_URL=http://nginx-web/prod-api
AI_CHATBOT_HTTP_PORT=182
```

注意：

- `APP_BUILD_CONTEXT` 必须指向包含 `package.json`、`pnpm-lock.yaml`、`app/`、`public/` 的前端项目根目录。
- 如果只拷贝了 docker 目录，但机器上没有完整前端源码，镜像仍然无法构建。

## 关键变量

```env
AI_CHATBOT_IMAGE=ai-chatbot:latest
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
PROXY_DOCKER_NETWORK=proxy-net
BASE_URL=http://nginx-web/prod-api
AI_CHATBOT_HTTP_PORT=182
```

说明：

- `BACKEND_DOCKER_NETWORK` 需要与你后端 compose 实际创建的网络名一致，可通过 `docker network ls` 查看。
- `PROXY_DOCKER_NETWORK` 需要与 frpc / Nginx Proxy Manager 所在外部网络一致。
- `BASE_URL` 默认通过后端现有 `nginx-web` 容器访问 `/prod-api`，无需直接绑定某个 `ruoyi-server` 实例。
- `AI_CHATBOT_HTTP_PORT` 是独立 nginx 暴露到宿主机的端口；如果后端 nginx 仍占用 `182`，需要先释放该端口或改成其他端口。

## IDEA 构建说明

如果你在 IDEA 中直接运行 Dockerfile，IDEA 很可能不仅会构建镜像，还会直接启动一个临时容器。这不是当前推荐的部署方式。

当前推荐模式是：

1. 先构建固定标签镜像，例如 `ai-chatbot:latest`
2. 再由 `docker-compose.yml` 同时启动 `ai-chatbot` 和 `ai-chatbot-nginx`

如果你在 IDEA 中直接运行 `script/docker/app/Dockerfile`，IDEA 往往还会把 Build context 设成 Dockerfile 所在目录，于是构建上下文里没有 `package.json` 和 `pnpm-lock.yaml`，就会出现：

```text
COPY package.json pnpm-lock.yaml ./: not found
```

推荐两种做法：

1. 最推荐：不要“运行 Dockerfile”，而是在终端或 IDEA 外部工具里执行 `./script/docker/build-image.sh`。
2. 如果要在 IDEA 里操作，请创建 Docker Image 配置，而不是 Dockerfile Run/Deploy 配置。
3. 如果仍然使用 `script/docker/app/Dockerfile`，手动把 Build context 改成前端项目根目录。

IDEA 中建议的镜像构建参数：

```text
Dockerfile: /home/aycole/ideaProgram/ai-chatbot/Dockerfile
Context folder: /home/aycole/ideaProgram/ai-chatbot
Image tag: ai-chatbot:latest
```

构建完成后，再在服务器部署目录执行：

```bash
docker compose up -d
```

## 校验

应用容器健康检查：

```bash
docker compose ps
```

宿主机端口校验：

```bash
curl http://127.0.0.1:${AI_CHATBOT_HTTP_PORT:-182}/ping
```

成功应返回：

```text
pong
```
