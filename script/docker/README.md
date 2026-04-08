# Docker Deployment

当前目录提供的是前端 `ai-chatbot` 的容器化部署方案，目标是复用后端已有的 `nginx-web` 容器与 docker 网络。
推荐交付方式与后端保持一致：本地或 IDEA 中构建镜像，服务器仅启动镜像。

## 目录说明

- `docker-compose.yml`：前端服务编排
- `docker-compose.build.yml`：仅在需要基于源码本地构建镜像时使用
- `app/Dockerfile`：Next.js 生产镜像构建
- `nginx/chat.server.conf.example`：并入后端 nginx 的示例配置
- `nginx/nginx.conf.port82.example`：保留现有后台前端，新增 `82` 端口给聊天前端
- `nginx/nginx.conf.domain.example`：后台与聊天前端使用不同域名的完整示例
- `.env.example`：部署变量示例
- `.env.build.example`：本地构建镜像时的变量示例

## 推荐拓扑

浏览器 -> 后端现有 nginx -> `ai-chatbot` 容器 -> 后端现有 nginx `/prod-api` -> `ruoyi-server*`

这样做的原因：

1. 浏览器仍然只访问前端域名。
2. Next.js Route Handlers 继续作为 BFF，保留当前的 token、Origin、SSE 代理逻辑。
3. `BASE_URL` 指向 `http://nginx-web/prod-api` 后，可直接复用后端 nginx 的负载均衡能力。

## 推荐部署方式

线上环境默认使用 `docker-compose.yml` 直接启动镜像，不推荐在服务器上拿单独的 docker 目录再本地构建。

原因：

1. 不依赖服务器上的前端源码路径。
2. 不会出现 `build.context`、`Dockerfile` 相对路径失效问题。
3. 更适合 CI/CD，也更符合生产环境职责分离。

### 方式 A：镜像部署，推荐

先在有完整源码的环境构建镜像。你如果和后端一样在 IDEA 的 Docker 服务里执行 Dockerfile，这一步也适用。

构建时需要注意：

1. 如果在命令行构建，推荐直接使用仓库根目录的 `Dockerfile`。
2. 如果在 IDEA 中直接运行 Dockerfile，也推荐选择仓库根目录的 `Dockerfile`。
3. `script/docker/app/Dockerfile` 仍可用，但 Build context 必须指向前端项目根目录，而不是 `script/docker/` 或 `script/docker/app/`。

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

如果不是推镜像仓库，而是像你后端那样把镜像导入服务器 docker，也可以：

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
  ├─ nginx/
  ├─ README.md
  ├─ .env
  └─ .env.example
```

`.env` 示例：

```env
AI_CHATBOT_IMAGE=ai-chatbot:latest
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
BASE_URL=http://nginx-web/prod-api
CHATBOT_PORT=3000
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

## 启动方式

1. 确认后端 compose 已启动，并存在 docker 网络。
2. 复制变量文件：

```bash
cd script/docker
cp .env.build.example .env
```

3. 启动前端容器：

```bash
docker compose -f docker-compose.build.yml up -d --build
```

## 本地构建时的两种使用方式

### 方式一：在当前前端仓库内直接执行

目录结构保持仓库原样：

```text
ai-chatbot/
  ├─ package.json
  ├─ app/
  ├─ script/docker/
  └─ ...
```

此时 `.env` 可以直接使用默认值：

```env
APP_BUILD_CONTEXT=../..
APP_DOCKERFILE=script/docker/app/Dockerfile
```

### 方式二：只把 docker 目录单独拷贝到部署目录

例如你现在的部署目录：

```text
/home/hrsaas/docker/ai-chatbot/
  ├─ app/
  ├─ docker-compose.yml
  ├─ nginx/
  └─ README.md
```

这种方式下，`docker-compose.build.yml` 已经不在源码仓库内，必须手动指定前端源码真实路径。

示例：

```env
APP_BUILD_CONTEXT=/home/hrsaas/project/ai-chatbot
APP_DOCKERFILE=/home/hrsaas/docker/ai-chatbot/app/Dockerfile
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
BASE_URL=http://nginx-web/prod-api
CHATBOT_PORT=3000
```

注意：

- `APP_BUILD_CONTEXT` 必须指向包含 `package.json`、`pnpm-lock.yaml`、`app/`、`public/` 的前端项目根目录。
- 如果你只拷贝了 docker 目录，但机器上没有完整前端源码，那么镜像仍然无法构建。因为 Docker 构建需要项目源码，而不是只要部署文件。

## 关键变量

```env
AI_CHATBOT_IMAGE=ai-chatbot:latest
BACKEND_DOCKER_NETWORK=legal_ruoyi-net
BASE_URL=http://nginx-web/prod-api
CHATBOT_PORT=3000
```

说明：

- `BACKEND_DOCKER_NETWORK` 需要与你后端 compose 实际创建的网络名一致，可通过 `docker network ls` 查看。
- `BASE_URL` 默认通过后端现有 `nginx-web` 容器访问 `/prod-api`，无需直接绑定某个 `ruoyi-server` 实例。
- 默认镜像模式只需要 `AI_CHATBOT_IMAGE`、`BACKEND_DOCKER_NETWORK`、`BASE_URL`、`CHATBOT_PORT`。
- 本地构建模式额外需要 `APP_BUILD_CONTEXT`、`APP_DOCKERFILE`。

## IDEA 构建说明

如果你在 IDEA 中直接运行 Dockerfile，IDEA 很可能不仅会构建镜像，还会直接启动一个临时容器。这不是当前推荐的部署方式。

当前推荐模式是：

1. 先构建固定标签镜像，例如 `ai-chatbot:latest`
2. 再由 `docker-compose.yml` 决定如何启动容器

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

## 接入后端 nginx

将 `nginx/chat.server.conf.example` 中的 `upstream` 与 `server` 合并到后端的 `script/docker/nginx/conf/nginx.conf` 的 `http {}` 内。

推荐使用独立域名，例如：

- `chat.example.com` -> 前端 `ai-chatbot`
- `api.example.com` 或原有域名 -> 后端管理端/接口

如果一定要使用同域名子路径（例如 `/chat/`），则需要额外改造 Next.js 的 `basePath` 和静态资源路径，当前仓库还没有做这层支持。

## 校验

前端容器健康检查使用：

```bash
curl http://127.0.0.1:${CHATBOT_PORT:-3000}/ping
```

成功应返回：

```text
pong
```
