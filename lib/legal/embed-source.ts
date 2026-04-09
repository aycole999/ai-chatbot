export const EMBED_PAGE_URL_HEADER = "x-embed-page-url";
export const EMBED_PARENT_REFERRER_HEADER = "x-embed-parent-referrer";

function normalizeSourceUrl(value?: string | null): string | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function getOriginFromSourceUrl(value?: string | null): string | null {
  const normalizedUrl = normalizeSourceUrl(value);
  if (!normalizedUrl) {
    return null;
  }

  try {
    return new URL(normalizedUrl).origin;
  } catch {
    return null;
  }
}

export function buildEmbedSourceRequestHeaders({
  pageUrl,
  parentReferrer,
}: {
  pageUrl?: string | null;
  parentReferrer?: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = {};

  const normalizedPageUrl = normalizeSourceUrl(pageUrl);
  if (normalizedPageUrl) {
    headers[EMBED_PAGE_URL_HEADER] = normalizedPageUrl;
  }

  const normalizedParentReferrer = normalizeSourceUrl(parentReferrer);
  if (normalizedParentReferrer) {
    headers[EMBED_PARENT_REFERRER_HEADER] = normalizedParentReferrer;
  }

  return headers;
}

export function buildCurrentEmbedSourceRequestHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  return buildEmbedSourceRequestHeaders({
    pageUrl: window.location.href,
    parentReferrer:
      typeof document === "undefined" ? undefined : document.referrer,
  });
}
