import { NextResponse } from "next/server";

function parseSourceParam(request: Request): URL | null {
  const url = new URL(request.url);
  const src = url.searchParams.get("src");
  if (!src) return null;
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const targetUrl = parseSourceParam(request);
  if (!targetUrl) {
    return NextResponse.json(
      { error: "Invalid or missing src parameter" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        // Identify ourselves to remote servers.
        "User-Agent": "JAMRA/desktop (+https://github.com/ShoobyDoo/JAMRA)",
      },
      cache: "no-cache",
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream responded with ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
    const cacheHeader =
      upstream.headers.get("cache-control") ??
      "public, max-age=3600, stale-while-revalidate=7200";
    headers.set("Cache-Control", cacheHeader);
    headers.set("Access-Control-Allow-Origin", "*");

    const body = upstream.body ?? null;
    return new Response(body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch upstream image: ${String(error)}` },
      { status: 502 }
    );
  }
}
