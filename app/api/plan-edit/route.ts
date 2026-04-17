import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Input types (what the frontend sends) ──────────────

interface AudioSection {
  id?: string;
  name: string;
  start_time: number;
  end_time: number;
  lines?: { text: string; start_time: number; end_time: number }[];
}

interface InputAudio {
  id: string;
  name: string;
  duration?: number;
  sections?: AudioSection[];
}

interface InputAesthetic {
  id: string;
  name: string;
  hooks?: { text: string }[];
  preset_name?: string;
}

interface InputClip {
  id: string;
  name: string;
  url: string;
  duration: number;
  thumbnail?: string;
  analysis?: {
    tags?: string[];
    scene_summary?: string;
    scene_focus?: string;
    location?: string;
    time_of_day?: string;
  };
}

interface PlanEditBody {
  audio: InputAudio;
  aesthetic: InputAesthetic;
  clips: InputClip[];
}

// ── Output types (what the frontend expects) ───────────

interface PlanClip {
  video_id: string;
  video_name?: string;
  thumbnail?: string;
  url?: string;
  start_time: number;
  end_time: number;
  reasoning: string;
  emotional_beat: string;
}

interface EditPlan {
  section: { name: string; start_time: number; end_time: number };
  hook: string;
  narrative_summary: string;
  clips: PlanClip[];
  preset_name?: string;
}

// ── Gemini ─────────────────────────────────────────────

const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"] as const;

const EMOTION_TAGS = new Set([
  "emotional", "sad", "melancholy", "melancholic", "nostalgic", "nostalgia",
  "longing", "yearning", "romantic", "love", "intimate", "tender", "dreamy",
  "ethereal", "hopeful", "bittersweet", "lonely", "vulnerable", "reflective",
  "cinematic", "moody", "soft", "warm", "quiet", "peaceful", "joyful",
  "happy", "euphoric", "heartbreak", "tears", "serene",
]);

function buildPrompt(audio: InputAudio, clips: InputClip[]): string {
  const songBlock = (audio.sections || [])
    .map((s) => {
      const lines = (s.lines || [])
        .map((l) => `    [${l.start_time.toFixed(2)}s–${l.end_time.toFixed(2)}s] ${l.text}`)
        .join("\n");
      return `  § ${s.name} (${s.start_time.toFixed(2)}s–${s.end_time.toFixed(2)}s)\n${lines}`;
    })
    .join("\n\n");

  const clipBlock = clips
    .map((c, i) => {
      const a = c.analysis || {};
      return (
        `  [${i + 1}] id=${c.id} • "${c.name}" • ${c.duration.toFixed(2)}s\n` +
        `      focus: ${a.scene_focus || "unknown"}\n` +
        `      location: ${a.location || "unknown"} • time: ${a.time_of_day || "unknown"}\n` +
        `      tags: ${(a.tags || []).join(", ") || "none"}\n` +
        `      summary: ${a.scene_summary || "no analysis"}`
      );
    })
    .join("\n\n");

  return `You are an edit director for emotional, narrative TikTok edits — the kind people rewatch because something about them aches. You are NOT a beat-matcher. You are a storyteller who pairs images with feelings.

Your job: read the song's actual lyrics, understand the emotional arc, then pick ONE section of the song to build a short edit around and choose which clips go where. You are matching clips to the MEANING of each line — its feeling, its subject, its turn — not to drum hits or tempo.

SONG
  Title: "${audio.name}"

  Sections with timed lyrics:
${songBlock || "  (no sections available — use the full track)"}

AVAILABLE CLIPS (${clips.length})
${clipBlock}

INSTRUCTIONS
1. Pick ONE section (usually the chorus, bridge, or the most emotionally-charged verse — whichever lands hardest on its own). Briefly justify.
2. Write a hook: a short opening caption (max ~12 words) that sets up what the viewer is about to feel. It should feel like the first line of a diary entry, not a title card.
3. Order the clips to tell the section's story. Each clip must sit on a specific emotional beat: "setup", "tension", "release", or "payoff". Quote or paraphrase the line it rides under. You may use a subset of clips if some don't earn their place — quality over coverage. Do not repeat a clip.
4. Write a 2–3 sentence narrative_summary describing the emotional journey of the finished edit.

RETURN STRICT JSON — no prose, no markdown fences, no commentary outside the JSON — matching EXACTLY:
{
  "chosen_section": { "name": string, "start_time": number, "end_time": number, "reasoning": string },
  "hook": { "text": string, "reasoning": string },
  "clip_order": [ { "video_id": string, "position": number, "emotional_beat": "setup"|"tension"|"release"|"payoff", "reasoning": string } ],
  "narrative_summary": string
}

The video_id values MUST be real ids from the clip list above. position is 1-indexed and contiguous.`;
}

function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, "");
    s = s.replace(/\n?```\s*$/, "");
  }
  return s.trim();
}

// ── Transform Gemini output to frontend's expected shape ─

function transformToFrontendPlan(
  raw: {
    chosen_section: { name: string; start_time: number; end_time: number; reasoning: string };
    hook: { text: string; reasoning: string };
    clip_order: { video_id: string; position: number; emotional_beat: string; reasoning: string }[];
    narrative_summary: string;
  },
  clips: InputClip[],
  presetName?: string
): EditPlan {
  const clipMap = new Map(clips.map((c) => [c.id, c]));

  // Filter out any hallucinated video_ids that don't exist in our clip set
  const validClipOrder = raw.clip_order.filter((entry) => clipMap.has(entry.video_id));

  return {
    section: {
      name: raw.chosen_section.name,
      start_time: raw.chosen_section.start_time,
      end_time: raw.chosen_section.end_time,
    },
    hook: raw.hook.text,
    narrative_summary: raw.narrative_summary,
    preset_name: presetName,
    clips: validClipOrder.map((entry) => {
      const source = clipMap.get(entry.video_id);
      return {
        video_id: entry.video_id,
        video_name: source?.name,
        thumbnail: source?.thumbnail,
        url: source?.url,
        start_time: 0,
        end_time: source?.duration || 5,
        reasoning: entry.reasoning,
        emotional_beat: entry.emotional_beat,
      };
    }),
  };
}

// ── Fallback (no Gemini) ───────────────────────────────

function buildFallback(audio: InputAudio, clips: InputClip[], presetName?: string): EditPlan {
  const sections = audio.sections || [];
  const chorus = sections.find((s) => /chorus/i.test(s.name));
  const bridge = sections.find((s) => /bridge/i.test(s.name));
  const chosen = chorus ?? bridge ?? sections[0] ?? {
    name: "Full track",
    start_time: 0,
    end_time: audio.duration || 30,
    lines: [],
  };

  const ranked = [...clips]
    .map((c) => ({
      clip: c,
      score: (c.analysis?.tags || []).filter((t) => EMOTION_TAGS.has(t.toLowerCase().trim())).length,
    }))
    .sort((a, b) => b.score - a.score);

  const beats: string[] = ["setup", "tension", "release", "payoff"];
  const maxClips = Math.min(ranked.length, Math.max(3, (chosen as AudioSection).lines?.length || 4));
  const chosenClips = ranked.slice(0, maxClips);

  const firstLine = (chosen as AudioSection).lines?.[0]?.text ?? audio.name;

  return {
    section: { name: chosen.name, start_time: chosen.start_time, end_time: chosen.end_time },
    hook: firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine,
    narrative_summary: `A quiet edit of "${audio.name}", built around the ${chosen.name.toLowerCase()}. Clips ordered by emotional tag density to foreground feeling over motion.`,
    preset_name: presetName,
    clips: chosenClips.map((entry, i) => ({
      video_id: entry.clip.id,
      video_name: entry.clip.name,
      thumbnail: entry.clip.thumbnail,
      url: entry.clip.url,
      start_time: 0,
      end_time: entry.clip.duration || 5,
      reasoning: `Fallback rank: ${entry.score} emotional tag(s) — ${(entry.clip.analysis?.tags || []).join(", ")}`,
      emotional_beat: beats[i % beats.length],
    })),
  };
}

// ── Route handler ──────────────────────────────────────

export async function POST(request: Request) {
  let body: PlanEditBody;
  try {
    body = (await request.json()) as PlanEditBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { audio, aesthetic, clips } = body;
  if (!audio || !clips?.length) {
    return NextResponse.json(
      { error: "audio and non-empty clips[] required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = buildPrompt(audio, clips);
  const presetName = aesthetic?.preset_name;

  if (apiKey) {
    for (const model of MODELS) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({ model });
        const result = await generativeModel.generateContent(prompt);
        const text = result.response.text();
        const cleaned = stripFences(text);
        const parsed = JSON.parse(cleaned);

        if (parsed?.chosen_section && parsed?.hook && Array.isArray(parsed?.clip_order)) {
          const plan = transformToFrontendPlan(parsed, clips, presetName);
          return NextResponse.json({ plan });
        }
        console.warn(`plan-edit: ${model} returned unparseable output`);
      } catch (err) {
        console.warn(`plan-edit: ${model} failed: ${err instanceof Error ? err.message.slice(0, 100) : err}`);
      }
    }
  }

  // Fallback
  console.warn("plan-edit: using fallback");
  const plan = buildFallback(audio, clips, presetName);
  return NextResponse.json({ plan });
}
