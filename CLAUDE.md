
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Legal document assistant frontend built with Next.js 16. The app integrates with the RuoYi legal backend through anonymous embed session proxy routes and uses NewAPI as the AI provider backend (OpenAI-compatible API).

## Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start dev server with Turbo (localhost:3000)
pnpm build            # Build production bundle

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
- `app/(legal)/` - Legal assistant UI (served at `/`) and related legal API routes

### Key Directories
- `lib/ai/` - AI provider configuration, model definitions, prompts, and tools
- `components/` - React components (chat UI, artifacts, editors)

### AI Provider Setup (`lib/ai/providers.ts`)
Uses NewAPI (OpenAI-compatible) configured via environment variables. Model aliases:
- `chat-model` - Default chat model
- `chat-model-reasoning` - Model with chain-of-thought reasoning (uses `extractReasoningMiddleware`)
- `title-model` - For generating chat titles
- `artifact-model` - For document/artifact generation

### AI Tools (`lib/ai/tools/`)
Available tools for the chat model:
- `getWeather` - Weather information
- `createDocument` - Create text/code/image/sheet artifacts
- `updateDocument` - Modify existing artifacts
- `requestSuggestions` - Generate document suggestions

## Environment Variables

Required in `.env.local`:
- `BASE_URL` - Backend base URL for legal proxy routes

Optional:
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
