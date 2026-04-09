import { NextResponse } from "next/server";

import {
  buildEmbedHeaders,
  getBaseUrl,
  getOrigin,
  getReferer,
  requireEmbedToken,
  safeReadJson,
  withEmbedSourceHeaders,
} from "@/lib/legal/proxy-utils";

function buildProxyHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const copy = (name: string) => {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  };

  copy("content-type");
  copy("content-disposition");
  copy("content-length");
  copy("access-control-expose-headers");
  copy("download-filename");
  headers.set("cache-control", "no-store");
  return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = (await safeReadJson(response)) as {
      error?: string;
      msg?: string;
    } | null;
    return payload?.error || payload?.msg || "Download failed";
  }

  const text = await response.text().catch(() => "");
  return text || "Download failed";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  const { documentId } = await context.params;
  if (!documentId) {
    return NextResponse.json(
      { error: "Document ID is required" },
      { status: 400 }
    );
  }

  try {
    const upstreamUrl = `${getBaseUrl()}/app/legal/embed/document/download/${encodeURIComponent(documentId)}`;
    const origin = getOrigin(request);
    const referer = getReferer(request);
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: withEmbedSourceHeaders(
        buildEmbedHeaders(token, origin, referer),
        request
      ),
      signal: request.signal,
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const error = await readErrorMessage(upstream);
      return NextResponse.json({ error }, { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: buildProxyHeaders(upstream),
    });
  } catch (error) {
    console.error("Legal document download API error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
