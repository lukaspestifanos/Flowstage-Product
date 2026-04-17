import { NextResponse } from "next/server";
import {
  createDraftEdit,
  getEditProgress,
} from "@/lib/flowstage";

// Frontend sends this shape (from page.tsx handleRender)
interface RenderEditBody {
  plan: {
    section: { name: string; start_time: number; end_time: number };
    hook: string;
    clips: {
      video_id: string;
      start_time: number;
      end_time: number;
    }[];
    preset_name?: string;
  };
  audio_id: string;
  aesthetic_id: string;
  preset_name?: string;
}

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 60;

export async function POST(request: Request) {
  let body: RenderEditBody;
  try {
    body = (await request.json()) as RenderEditBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plan, audio_id, aesthetic_id, preset_name } = body;

  if (!plan || !audio_id || !aesthetic_id || !plan.clips?.length) {
    return NextResponse.json(
      { error: "plan (with clips), audio_id, and aesthetic_id are required" },
      { status: 400 }
    );
  }

  try {
    const draft = await createDraftEdit({
      aesthetic_id,
      audio_id,
      section_start_time: plan.section.start_time,
      section_end_time: plan.section.end_time,
      hook: plan.hook,
      preset_name: preset_name || plan.preset_name,
      render: true,
      videos: plan.clips.map((c) => ({
        video_id: c.video_id,
        start_time: c.start_time || 0,
        end_time: c.end_time,
      })),
    });

    const editId = draft.video_edit_id;

    // Poll until done, error, or timeout
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const progress = await getEditProgress(editId);

      if (progress.status === "done") {
        // Frontend reads data.render_url
        return NextResponse.json({
          editId,
          status: "done",
          render_url: progress.url,
          progress: 1.0,
        });
      }

      if (progress.status === "error") {
        return NextResponse.json(
          { error: progress.error || "Render failed", editId, status: "error" },
          { status: 502 }
        );
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    // Timed out — return current state
    const final = await getEditProgress(editId);
    return NextResponse.json({
      editId,
      status: final.status,
      render_url: final.url,
      progress: final.progress,
    });
  } catch (error) {
    console.error("render-edit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Render request failed" },
      { status: 500 }
    );
  }
}
