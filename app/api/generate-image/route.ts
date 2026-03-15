import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get("prompt");
  const seed = req.nextUrl.searchParams.get("seed") ?? String(Math.floor(Math.random() * 99999));

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const upstream = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=500&seed=${seed}&nologo=true&model=flux`;

  try {
    const resp = await fetch(upstream, { next: { revalidate: 0 } });
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream ${resp.status}` }, { status: 502 });
    }
    const contentType = resp.headers.get("content-type") ?? "image/jpeg";
    const buf = await resp.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
