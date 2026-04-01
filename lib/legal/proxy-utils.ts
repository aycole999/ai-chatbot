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
 * 构建带 embed token 的请求头（JSON 请求）
 */
export function buildEmbedJsonHeaders(embedToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-embed-session-token": embedToken,
  };
}

/**
 * 构建带 embed token 的请求头（非 JSON 请求，如 multipart）
 */
export function buildEmbedHeaders(embedToken: string): HeadersInit {
  return {
    "x-embed-session-token": embedToken,
  };
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
