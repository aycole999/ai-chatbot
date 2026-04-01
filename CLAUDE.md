
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chat SDK - an open-source AI chatbot template built with Next.js 16 and the Vercel AI SDK. Uses NewAPI as the AI provider backend (OpenAI-compatible API).

## Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start dev server with Turbo (localhost:3000)
pnpm build            # Run migrations then build

# Database (Drizzle ORM + PostgreSQL)
pnpm db:migrate       # Apply migrations
pnpm db:generate      # Generate migration from schema changes
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:push          # Push schema directly (dev only)

# Code Quality (Ultracite/Biome)
pnpm lint             # Check formatting and lint issues
pnpm format           # Auto-fix formatting and lint issues

# Testing (Playwright)
pnpm test             # Run all Playwright tests (sets PLAYWRIGHT=True)
# Run specific test file:
pnpm exec playwright test tests/e2e/legal-default.test.ts
# Run specific project:
pnpm exec playwright test --project=e2e
pnpm exec playwright test --project=routes
```

## Architecture

### Route Groups (Next.js App Router)
- `app/(auth)/` - Authentication UI (`/login`, `/register`) and Auth.js routes (`/api/auth/*`)
- `app/(legal)/` - Legal assistant UI (served at `/`) and related legal API routes

### Key Directories
- `lib/ai/` - AI provider configuration, model definitions, prompts, and tools
- `lib/db/` - Drizzle schema, queries, and migrations
- `components/` - React components (chat UI, artifacts, editors)

### AI Provider Setup (`lib/ai/providers.ts`)
Uses NewAPI (OpenAI-compatible) configured via environment variables. Model aliases:
- `chat-model` - Default chat model
- `chat-model-reasoning` - Model with chain-of-thought reasoning (uses `extractReasoningMiddleware`)
- `title-model` - For generating chat titles
- `artifact-model` - For document/artifact generation

### Database Schema (`lib/db/schema.ts`)
Main tables: `User`, `Chat`, `Message_v2`, `Vote_v2`, `Document`, `Suggestion`, `Stream`
Note: `Message` and `Vote` (without `_v2`) are deprecated.

### AI Tools (`lib/ai/tools/`)
Available tools for the chat model:
- `getWeather` - Weather information
- `createDocument` - Create text/code/image/sheet artifacts
- `updateDocument` - Modify existing artifacts
- `requestSuggestions` - Generate document suggestions

## Environment Variables

Required in `.env.local`:
- `AUTH_SECRET` - NextAuth secret
- `NEWAPI_BASE_URL` - NewAPI endpoint (must end with `/v1`)
- `NEWAPI_API_KEY` - NewAPI key
- `POSTGRES_URL` - PostgreSQL connection string
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

Optional:
- `REDIS_URL` - Enables resumable streams
- `AGENT_DEFAULT_TIMEOUT` - Agent execution timeout in milliseconds (default: 60000)
- `ENABLE_MULTI_AGENT` - Enable/disable multi-agent mode (default: true)
- `ENABLE_MCP_TOOLS` - Enable MCP tools integration (default: false)

### MCP Server Configuration

When `ENABLE_MCP_TOOLS=true`, configure MCP servers with:
- `MCP_SERVER_<NAME>_URL` - Server URL (for http/sse transport)
- `MCP_SERVER_<NAME>_TRANSPORT` - Transport type: http, sse, or stdio
- `MCP_SERVER_<NAME>_TOKEN` - Auth token (optional)
- `MCP_SERVER_<NAME>_COMMAND` - Command for stdio transport
- `MCP_SERVER_<NAME>_ARGS` - Comma-separated args for stdio transport

## Code Style (Ultracite/Biome)

- No TypeScript enums - use object literals with `as const`
- Use `import type` for type-only imports
- No `any` type
- Use `for...of` instead of `Array.forEach`
- No nested ternaries
- No console.log in production code
- React: no array index as key, use fragments `<>` over `<Fragment>`
