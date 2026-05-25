# ai-chatbot Docker 双环境部署

本目录提供 `dev` 与 `prod` 两套独立 Docker Compose 部署。两套环境使用不同 compose project、容器名、内部网络、宿主机端口和日志目录，避免开发环境与线上环境互相覆盖。

## 文件

- `script/docker/dev/ai-chatbot/docker-compose.yml`：开发环境聊天前端
- `script/docker/dev/ai-chatbot/.env.example`：开发环境 Docker 变量示例
- `script/docker/dev/ai-chatbot/nginx/conf/nginx.conf`：开发环境 Nginx 入口
- `script/docker/prod/ai-chatbot/docker-compose.yml`：生产环境聊天前端
- `script/docker/prod/ai-chatbot/.env.example`：生产环境 Docker 变量示例
- `script/docker/prod/ai-chatbot/nginx/conf/nginx.conf`：生产环境 Nginx 入口

## 前提

后端双环境需要先启动，并且网络名保持默认：

- dev 后端网络：`legal-dev-net`
- prod 后端网络：`legal-prod-net`

如果使用 Nginx Proxy Manager 或 frpc，还需要共享代理网络：

```bash
docker network create proxy-net
```

## 构建镜像

ai-chatbot 是 Next.js 服务，`BASE_URL` 在容器运行时注入，不需要像静态站点一样为 dev/prod 复制不同 html 产物。可以复用同一个镜像，也可以分环境打标签。

开发环境镜像：

```bash
./script/docker/build-image.sh ai-chatbot:dev
```

生产环境镜像：

```bash
./script/docker/build-image.sh ai-chatbot:prod
```

## 启动

开发环境：

```bash
cd script/docker/dev/ai-chatbot
cp .env.example .env
docker compose up -d
```

生产环境：

```bash
cd script/docker/prod/ai-chatbot
cp .env.example .env
docker compose up -d
```

## 默认端口和容器名

| 环境 | Next.js 容器 | Nginx 容器 | 宿主机端口 | 后端网络 | BASE_URL |
| --- | --- | --- | --- | --- | --- |
| dev | `ai-chatbot-dev` | `ai-chatbot-dev-nginx` | `19182` | `legal-dev-net` | `http://legal-dev-nginx/prod-api` |
| prod | `ai-chatbot-prod` | `ai-chatbot-prod-nginx` | `182` | `legal-prod-net` | `http://legal-prod-nginx/prod-api` |

直接访问宿主机端口：

- dev：`http://服务器IP:19182`
- prod：`http://服务器IP:182`

如果使用 NPM 且 NPM 与 ai-chatbot 在同一台 Docker 主机上，代理目标可以直接填写容器名：

- dev：`ai-chatbot-dev-nginx:80`
- prod：`ai-chatbot-prod-nginx:80`

## 云服务器 NPM + frp

如果 NPM 在云服务器，ai-chatbot 在应用服务器，需要在 frpc 中增加两条隧道：

```toml
[[proxies]]
name = "ai-chatbot-prod-nginx"
type = "tcp"
localIP = "ai-chatbot-prod-nginx"
localPort = 80
remotePort = 18082

[[proxies]]
name = "ai-chatbot-dev-nginx"
type = "tcp"
localIP = "ai-chatbot-dev-nginx"
localPort = 80
remotePort = 19082
```

云服务器 NPM 上游目标：

- prod 聊天域名：`frps:18082`
- dev 聊天域名：`frps:19082`

同时需要在 frps 的 `allowPorts` 和 Docker `expose` 中加入 `18082`、`19082`。

## 注意事项

- `ai-chatbot` 后端访问由 `BASE_URL` 控制，Nginx 只负责把外部流量代理到本环境的 Next.js 容器。
- dev/prod 可以复用同一个镜像；如果要完全隔离版本，分别构建并修改 `.env` 中的 `AI_CHATBOT_IMAGE`。
- 旧的 `script/docker/docker-compose.yml` 保留为兼容入口，新部署优先使用本文件描述的双环境目录。
