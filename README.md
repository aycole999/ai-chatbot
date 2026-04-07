# 法律文书助手前端

当前项目是一个基于 Next.js 16 的法律文书助手前端，默认通过 Next.js API Routes 代理到后端 `BASE_URL`。

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
