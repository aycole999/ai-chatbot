function getBaseUrl(): string {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("BASE_URL is not configured");
  }
  return baseUrl;
}

function getAuthHeaders(): HeadersInit {
  const token = process.env.BEARER_TOKEN;
  const clientId = process.env.CLIENTID;
  if (!token) {
    throw new Error("BEARER_TOKEN is not configured");
  }
  if (!clientId) {
    throw new Error("CLIENTID is not configured");
  }
  return {
    Authorization: `Bearer ${token}`,
    clientid: clientId,
  };
}

function buildProxyHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const copy = (name: string) => {
    const v = upstream.headers.get(name);
    if (v) {
      headers.set(name, v);
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

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await context.params;
  const upstreamUrl = `${getBaseUrl()}/document/download/${encodeURIComponent(documentId)}`;

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: getAuthHeaders(),
    signal: request.signal,
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "Download failed", {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: buildProxyHeaders(upstream),
  });
}
