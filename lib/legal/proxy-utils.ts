import { NextResponse } from "next/server";
import {
  EMBED_PAGE_URL_HEADER,
  EMBED_PARENT_REFERRER_HEADER,
  getOriginFromSourceUrl,
} from "@/lib/legal/embed-source";

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

  const pageUrlOrigin = getOriginFromSourceUrl(
    request.headers.get(EMBED_PAGE_URL_HEADER)
  );
  if (pageUrlOrigin) {
    return pageUrlOrigin;
  }

  const parentReferrerOrigin = getOriginFromSourceUrl(
    request.headers.get(EMBED_PARENT_REFERRER_HEADER)
  );
  if (parentReferrerOrigin) {
    return parentReferrerOrigin;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

/**
 * 从浏览器请求中提取 Referer，用于转发给后端识别来源页面
 */
export function getReferer(request: Request): string | null {
  return (
    request.headers.get("referer") ||
    request.headers.get(EMBED_PAGE_URL_HEADER) ||
    request.headers.get(EMBED_PARENT_REFERRER_HEADER)
  );
}

/**
 * 透传显式来源头，避免代理链路依赖浏览器自动补 Origin/Referer
 */
export function withEmbedSourceHeaders(
  headers: HeadersInit,
  request: Request
): Headers {
  const mergedHeaders = new Headers(headers);
  const pageUrl = request.headers.get(EMBED_PAGE_URL_HEADER);
  const parentReferrer = request.headers.get(EMBED_PARENT_REFERRER_HEADER);

  if (pageUrl) {
    mergedHeaders.set(EMBED_PAGE_URL_HEADER, pageUrl);
  }

  if (parentReferrer) {
    mergedHeaders.set(EMBED_PARENT_REFERRER_HEADER, parentReferrer);
  }

  return mergedHeaders;
}

/**
 * 构建带 embed token + Origin 的请求头（JSON 请求）
 */
export function buildEmbedJsonHeaders(
  embedToken: string,
  origin?: string | null,
  referer?: string | null
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-embed-session-token": embedToken,
  };
  if (origin) {
    headers.Origin = origin;
  }
  if (referer) {
    headers.Referer = referer;
  }
  return headers;
}

/**
 * 构建带 embed token + Origin 的请求头（非 JSON 请求，如 multipart）
 */
export function buildEmbedHeaders(
  embedToken: string,
  origin?: string | null,
  referer?: string | null
): HeadersInit {
  const headers: Record<string, string> = {
    "x-embed-session-token": embedToken,
  };
  if (origin) {
    headers.Origin = origin;
  }
  if (referer) {
    headers.Referer = referer;
  }
  return headers;
}

/**
 * 构建仅带 Origin 的请求头（bootstrap 不需要 token）
 */
export function buildOriginHeaders(
  origin?: string | null,
  referer?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (origin) {
    headers.Origin = origin;
  }
  if (referer) {
    headers.Referer = referer;
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
