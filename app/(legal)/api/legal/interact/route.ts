import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildEmbedJsonHeaders,
  getBaseUrl,
  getOrigin,
  requireEmbedToken,
  safeReadJson,
} from "@/lib/legal/proxy-utils";
import type { LegalApiResponse } from "@/lib/legal/types";

const requestSchema = z.object({
  session_id: z.string(),
  message: z.string().optional(),
  stream: z.boolean().optional().default(false),
  action: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  media_attachments: z
    .array(
      z.object({
        oss_id: z.number(),
        file_name: z.string().optional(),
        file_size: z.number().optional(),
        content_type: z.string().optional(),
        media_duration: z.number().int().optional(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  // 解析请求体
  let requestBody: z.infer<typeof requestSchema>;
  try {
    requestBody = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();
    const origin = getOrigin(request);
    const headers = buildEmbedJsonHeaders(token, origin);

    const upstreamBody = {
      session_id: requestBody.session_id,
      message: requestBody.message,
      action: requestBody.action,
      data: requestBody.data,
      stream: Boolean(requestBody.stream),
      media_attachments: requestBody.media_attachments,
    };

    // 非流式请求
    if (!requestBody.stream) {
      const response = await fetch(`${baseUrl}/app/legal/embed/send`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
        signal: request.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Embed backend error:", errorText);
        return NextResponse.json(
          { error: "Backend service error" },
          { status: response.status }
        );
      }

      const raw = await safeReadJson(response);
      const payload = raw as {
        code?: number;
        msg?: string;
        data?: unknown;
      } | null;
      if (!payload || payload.code !== 200 || !payload.data) {
        const msg = payload?.msg || "Backend service error";
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      const result = payload.data as {
        sessionId?: string;
        nextStep?: string;
        data?: Record<string, unknown> | null;
        message?: string | null;
      };

      const responseData: Record<string, unknown> =
        (result.data && typeof result.data === "object" ? result.data : {}) ??
        {};
      if (!("message" in responseData) && result.message) {
        responseData.message = result.message;
      }

      const data: LegalApiResponse = {
        session_id: result.sessionId || requestBody.session_id || "",
        next_step: result.nextStep as LegalApiResponse["next_step"],
        data: responseData,
      };

      return NextResponse.json(data);
    }

    // 流式请求 - 代理 SSE
    const response = await fetch(`${baseUrl}/app/legal/embed/send_stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(upstreamBody),
      signal: request.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Embed backend stream error:", errorText);
      return NextResponse.json(
        { error: "Backend service error" },
        { status: response.status }
      );
    }

    const stream = response.body;
    if (!stream) {
      return NextResponse.json(
        { error: "No response stream" },
        { status: 500 }
      );
    }

    return new Response(stream, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Legal API error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}
