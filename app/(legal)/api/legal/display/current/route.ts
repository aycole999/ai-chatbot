import { NextResponse } from "next/server";

import {
  getBaseUrl,
  getOrigin,
  getReferer,
  safeReadJson,
  withEmbedSourceHeaders,
} from "@/lib/legal/proxy-utils";

export async function GET(request: Request) {
  try {
    const baseUrl = getBaseUrl();
    const origin = getOrigin(request);
    const referer = getReferer(request);
    const headers = withEmbedSourceHeaders(new Headers(), request);

    if (origin) {
      headers.set("Origin", origin);
    }

    if (referer) {
      headers.set("Referer", referer);
    }

    const response = await fetch(`${baseUrl}/app/legal/embed/display/current`, {
      headers,
      signal: request.signal,
      cache: "no-store",
    });

    const raw = await safeReadJson(response);
    const payload = raw as {
      code?: number;
      msg?: string;
      data?: unknown;
    } | null;

    if (!response.ok || !payload || payload.code !== 200 || !payload.data) {
      const msg = payload?.msg || "Failed to load display config";
      return NextResponse.json(
        { error: msg },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json(payload.data);
  } catch (error) {
    console.error("Display config API error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 500 }
    );
  }
}
