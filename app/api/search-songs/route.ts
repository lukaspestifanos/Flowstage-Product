import { NextRequest, NextResponse } from "next/server";

// Searches LRCLIB for any song — works for TikTok sounds, album tracks, anything
// No API key needed

interface LrcLibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

function parseSyncedLyrics(synced: string): { text: string; start_time: number; end_time: number }[] {
  const lines: { text: string; time: number }[] = [];
  for (const line of synced.split("\n")) {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/);
    if (match && match[3].trim()) {
      const mins = parseInt(match[1]);
      const secs = parseFloat(match[2]);
      lines.push({ text: match[3].trim(), time: mins * 60 + secs });
    }
  }
  return lines.map((l, i) => ({
    text: l.text,
    start_time: l.time,
    end_time: i < lines.length - 1 ? lines[i + 1].time : l.time + 3,
  }));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": "EditorMode/1.0" },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return NextResponse.json({ results: [] });

    const data: LrcLibResult[] = await res.json();

    const seen = new Set<string>();
    const results = data
      .filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics))
      .filter((r) => {
        const key = `${r.artistName.toLowerCase()}|${r.trackName.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        artist: r.artistName,
        title: r.trackName,
        album: r.albumName || "",
        duration: r.duration,
        hasTimestamps: !!r.syncedLyrics,
        lines: r.syncedLyrics
          ? parseSyncedLyrics(r.syncedLyrics)
          : (r.plainLyrics || "").split("\n").filter(Boolean).map((text, i) => ({
              text, start_time: i * 4, end_time: (i + 1) * 4,
            })),
        rawLyrics: r.syncedLyrics || r.plainLyrics || "",
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Song search error:", error);
    return NextResponse.json({ results: [] });
  }
}
