import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildEmbedJsonHeaders,
  getBaseUrl,
  getOrigin,
  getReferer,
  requireEmbedToken,
  safeReadJson,
  withEmbedSourceHeaders,
} from "@/lib/legal/proxy-utils";

const requestSchema = z.object({
  session_id: z.string(),
  template_id: z.union([z.string(), z.number()]).transform(String),
  answers: z.unknown(),
});

export async function POST(request: Request) {
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }

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

    const response = await fetch(
      `${baseUrl}/app/legal/embed/pre-questions/recommend`,
      {
        method: "POST",
        headers: withEmbedSourceHeaders(
          buildEmbedJsonHeaders(tokenResult.token, origin, referer),
          request
        ),
        body: JSON.stringify(body),
        signal: request.signal,
      }
    );

    const raw = await safeReadJson(response);
    const payload = raw as {
      code?: number;
      msg?: string;
      data?: unknown;
    } | null;

    if (!response.ok || !payload || payload.code !== 200 || !payload.data) {
      const msg = payload?.msg || "Recommend failed";
      return NextResponse.json(
        { error: msg },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json(payload.data);
  } catch (error) {
    console.error("Pre-question recommend API error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}
