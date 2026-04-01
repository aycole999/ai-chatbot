import { NextResponse } from "next/server";
import { z } from "zod";

import { getBaseUrl, safeReadJson } from "@/lib/legal/proxy-utils";

const requestSchema = z.object({
  captchaToken: z.string(),
  clientNonce: z.string(),
  pageUrl: z.string(),
  parentReferrer: z.string().optional(),
});

export async function POST(request: Request) {
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

    const response = await fetch(`${baseUrl}/app/legal/embed/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    const raw = await safeReadJson(response);
    const payload = raw as {
      code?: number;
      msg?: string;
      data?: unknown;
    } | null;

    if (!response.ok || !payload || payload.code !== 200 || !payload.data) {
      const msg = payload?.msg || "Bootstrap failed";
      return NextResponse.json(
        { error: msg },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json(payload.data);
  } catch (error) {
    console.error("Bootstrap API error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}
