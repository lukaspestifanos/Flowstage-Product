import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.theflowstage.com";

function getApiKey(): string {
  const key = process.env.FLOWSTAGE_API_KEY;
  if (!key) throw new Error("FLOWSTAGE_API_KEY not set");
  return key;
}

// Adds a video from a public URL to a Flowstage aesthetic
// POST /v1/aesthetics/{id}/videos
export async function POST(req: NextRequest) {
  try {
    const { aestheticId, url, name, analyze } = await req.json();

    if (!aestheticId || !url) {
      return NextResponse.json(
        { error: "aestheticId and url are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${BASE_URL}/v1/aesthetics/${aestheticId}/videos`, {
      method: "POST",
      headers: {
        "X-API-Key": getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        name: name || url.split("/").pop()?.split("?")[0] || "Uploaded clip",
        analyze: analyze !== false, // default true — Flowstage analyzes the clip
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Flowstage ${res.status}: ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Upload clip error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
