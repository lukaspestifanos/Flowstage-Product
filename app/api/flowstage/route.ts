import { NextRequest, NextResponse } from "next/server";
import {
  listAudios,
  listAesthetics,
  getAestheticDetail,
  getAestheticVideos,
  getAestheticAudios,
  getLimits,
} from "@/lib/flowstage";

export async function GET(req: NextRequest) {
  const aestheticId = req.nextUrl.searchParams.get("aestheticId");

  try {
    // Always fetch base data
    const [audiosData, aesthetics, limits] = await Promise.all([
      listAudios(),
      listAesthetics(),
      getLimits(),
    ]);

    const result: Record<string, unknown> = {
      audios: audiosData.audios,
      aesthetics,
      limits,
    };

    // If an aesthetic is selected, fetch its videos (with analyses) and audios (with sections/lyrics)
    if (aestheticId) {
      const [detail, videos, aestheticAudios] = await Promise.all([
        getAestheticDetail(aestheticId).catch(() => null),
        getAestheticVideos(aestheticId).catch(() => []),
        getAestheticAudios(aestheticId).catch(() => []),
      ]);

      // Flatten videos to top-level so page.tsx can read data.videos
      result.videos = videos;

      result.selectedAesthetic = {
        ...detail,
        analyzedVideos: videos,
        audiosWithLyrics: aestheticAudios,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Flowstage data fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
