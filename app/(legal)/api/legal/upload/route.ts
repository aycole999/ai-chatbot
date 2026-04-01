import { NextResponse } from "next/server";

import {
  buildEmbedHeaders,
  getBaseUrl,
  getOrigin,
  requireEmbedToken,
} from "@/lib/legal/proxy-utils";

export async function POST(request: Request) {
  // 校验 embed token
  const tokenResult = requireEmbedToken(request);
  if ("error" in tokenResult) {
    return tokenResult.error;
  }
  const { token } = tokenResult;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const backendFormData = new FormData();
    for (const file of files) {
      backendFormData.append("files", file, file.name);
    }

    const baseUrl = getBaseUrl();
    const origin = getOrigin(request);
    const response = await fetch(`${baseUrl}/app/legal/embed/upload/files`, {
      method: "POST",
      headers: buildEmbedHeaders(token, origin),
      body: backendFormData,
      signal: request.signal,
    });

    let result: Record<string, unknown> | null = null;
    try {
      result = (await response.json()) as Record<string, unknown>;
    } catch {
      result = null;
    }

    if (!response.ok) {
      const msg = (result as { msg?: string } | null)?.msg || "Upload failed";
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
      { error: (result as { msg?: string } | null)?.msg || "Upload failed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Legal upload API error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
