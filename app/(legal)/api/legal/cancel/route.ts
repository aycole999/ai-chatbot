import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildEmbedJsonHeaders,
  getBaseUrl,
  getOrigin,
  getReferer,
  requireEmbedToken,
  withEmbedSourceHeaders,
} from "@/lib/legal/proxy-utils";

const requestSchema = z.object({
  sessionUuid: z.string(),
  messageId: z.number().optional(),
});

export async function POST(request: Request) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();
    const origin = getOrigin(request);
    const referer = getReferer(request);
    const response = await fetch(`${baseUrl}/app/legal/embed/cancel`, {
      method: "POST",
      headers: withEmbedSourceHeaders(
        buildEmbedJsonHeaders(token, origin, referer),
        request
      ),
      body: JSON.stringify(body),
      signal: request.signal,
    });

    let result: Record<string, unknown> | null = null;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      result = null;
    }

    if (!response.ok) {
      const msg = (result as { msg?: string } | null)?.msg || "Cancel failed";
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    if (result && (result as { code?: number }).code === 200) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: (result as { msg?: string } | null)?.msg || "Cancel failed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Legal cancel API error:", error);
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
}
