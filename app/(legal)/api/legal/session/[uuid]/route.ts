import { NextResponse } from "next/server";

import {
  buildEmbedHeaders,
  getBaseUrl,
  requireEmbedToken,
} from "@/lib/legal/proxy-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  const { uuid } = await params;

  if (!uuid) {
    return NextResponse.json(
      { error: "Session UUID is required" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(
      `${baseUrl}/app/legal/embed/session/${uuid}`,
      {
        method: "GET",
        headers: buildEmbedHeaders(token),
        signal: request.signal,
      }
    );

    let result: Record<string, unknown> | null = null;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      result = null;
    }

    if (!response.ok) {
      const msg =
        (result as { msg?: string } | null)?.msg ||
        "Failed to get session";
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    if (
      result &&
      (result as { code?: number }).code === 200 &&
      (result as { data?: unknown }).data
    ) {
      return NextResponse.json((result as { data: unknown }).data);
    }

    return NextResponse.json(
      {
        error:
          (result as { msg?: string } | null)?.msg ||
          "Failed to get session",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Session detail API error:", error);
    return NextResponse.json(
      { error: "Failed to get session detail" },
      { status: 500 }
    );
  }
}
