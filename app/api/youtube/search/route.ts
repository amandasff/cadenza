import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q?.trim()) return NextResponse.json([]);

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not set" }, { status: 500 });
  }

  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=8` +
    `&q=${encodeURIComponent(q)}&key=${key}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "YouTube API error" },
      { status: res.status }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data.items ?? []).map((item: any) => ({
    id: item.id.videoId as string,
    title: item.snippet.title as string,
    thumbnail: (item.snippet.thumbnails?.medium?.url ??
      item.snippet.thumbnails?.default?.url ?? "") as string,
  }));

  return NextResponse.json(results);
}
