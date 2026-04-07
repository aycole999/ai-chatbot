import { NextResponse } from "next/server";

/**
 * 获取后端基础 URL
 */
export function getBaseUrl(): string {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("BASE_URL is not configured");
  }
  return baseUrl;
}

/**
 * 从请求中提取 embed session token
 */
export function getEmbedToken(request: Request): string | null {
  return request.headers.get("x-embed-session-token");
}

/**
 * 从浏览器请求中提取 Origin，用于转发给后端白名单校验
 */
export function getOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

/**
 * 构建带 embed token + Origin 的请求头（JSON 请求）
 */
export function buildEmbedJsonHeaders(
  embedToken: string,
  origin?: string | null
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-embed-session-token": embedToken,
  };
  if (origin) {
    headers.Origin = origin;
  }
  return headers;
}

/**
 * 构建带 embed token + Origin 的请求头（非 JSON 请求，如 multipart）
 */
export function buildEmbedHeaders(
  embedToken: string,
  origin?: string | null
): HeadersInit {
  const headers: Record<string, string> = {
    "x-embed-session-token": embedToken,
  };
  if (origin) {
    headers.Origin = origin;
  }
  return headers;
}

/**
 * 构建仅带 Origin 的请求头（bootstrap 不需要 token）
 */
export function buildOriginHeaders(
  origin?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (origin) {
    headers.Origin = origin;
  }
  return headers;
}

/**
 * 安全读取 JSON 响应
 */
export async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 需要 embed token 的路由守卫
 */
export function requireEmbedToken(
  request: Request
): { token: string } | { error: NextResponse } {
  const token = getEmbedToken(request);
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing x-embed-session-token header" },
        { status: 401 }
      ),
    };
  }
  return { token };
}
