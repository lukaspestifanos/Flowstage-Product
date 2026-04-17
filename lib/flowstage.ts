const BASE_URL = "https://api.theflowstage.com";

function getApiKey(): string {
  const key = process.env.FLOWSTAGE_API_KEY;
  if (!key) throw new Error("FLOWSTAGE_API_KEY not set");
  return key;
}

async function api<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-API-Key": getApiKey(),
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Flowstage ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Audio / Songs ──────────────────────────────────────

export interface LyricLine {
  text: string;
  start_time: number;
  end_time: number;
}

export interface AudioSection {
  id: string;
  name: string;
  start_time: number;
  end_time: number;
  lines?: LyricLine[];
}

export interface Audio {
  id: string;
  name: string;
  duration: number;
  url?: string;
  sections?: AudioSection[];
}

export async function listAudios(): Promise<{ audios: Audio[]; total: number }> {
  return api("/v1/audios?limit=50&offset=0");
}

// ── Aesthetics ─────────────────────────────────────────

export interface Aesthetic {
  id: string;
  name: string;
  description?: string;
  video_preset_names?: string[];
  slideshow_preset_names?: string[];
}

export async function listAesthetics(): Promise<Aesthetic[]> {
  const data = await api<{ aesthetics: Aesthetic[] }>("/v1/aesthetics");
  return data.aesthetics;
}

export interface AestheticDetail {
  id: string;
  name: string;
  description?: string;
  videos: VideoSummary[];
  audios: Audio[];
  hooks: { text: string }[];
  video_preset_names: string[];
  slideshow_preset_names?: string[];
}

export interface VideoSummary {
  id: string;
  name: string;
  url: string;
  duration: number;
}

export async function getAestheticDetail(
  id: string
): Promise<AestheticDetail> {
  return api(`/v1/aesthetics/${id}`);
}

// ── Videos with Analysis ───────────────────────────────

export interface VideoAnalysis {
  tags: string[];
  scene_summary: string;
  scene_focus: string;
  location: string;
  time_of_day: string;
}

export interface AnalyzedVideo {
  id: string;
  name: string;
  url: string;
  duration: number;
  thumbnail?: string;
  analysis?: VideoAnalysis;
}

export async function getAestheticVideos(
  aestheticId: string
): Promise<AnalyzedVideo[]> {
  const data = await api<{ videos: AnalyzedVideo[] }>(
    `/v1/aesthetics/${aestheticId}/videos`
  );
  return data.videos;
}

// ── Aesthetic Audios (with sections + lyrics) ──────────

export async function getAestheticAudios(
  aestheticId: string
): Promise<Audio[]> {
  const data = await api<{ audios: Audio[] }>(
    `/v1/aesthetics/${aestheticId}/audios`
  );
  return data.audios;
}

// ── Video Edits (Draft Mode) ───────────────────────────

export interface VideoClipInput {
  video_id: string;
  start_time?: number;
  end_time: number;
}

export interface CreateDraftEditParams {
  aesthetic_id: string;
  audio_id: string;
  section_start_time: number;
  section_end_time: number;
  hook?: string;
  name?: string;
  preset_name?: string;
  render?: boolean;
  videos: VideoClipInput[];
}

export interface VideoEditResponse {
  video_edit_id: string;
  status: string;
  message: string;
}

export async function createDraftEdit(
  params: CreateDraftEditParams
): Promise<VideoEditResponse> {
  return api<VideoEditResponse>("/v1/video-edits/draft", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Render Progress ────────────────────────────────────

export interface RenderProgress {
  edit_id: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  url?: string;
  message?: string;
  error?: string;
}

export async function getEditProgress(
  editId: string
): Promise<RenderProgress> {
  return api<RenderProgress>(`/v1/video-edits/${editId}/progress`);
}

export async function waitForRender(
  editId: string,
  maxAttempts = 60
): Promise<RenderProgress> {
  for (let i = 0; i < maxAttempts; i++) {
    const progress = await getEditProgress(editId);
    if (progress.status === "done") return progress;
    if (progress.status === "error") {
      throw new Error(`Render failed: ${progress.error || "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Render timed out after ${maxAttempts * 5}s`);
}

// ── Video Edit Status ──────────────────────────────────

export interface VideoEditStatus {
  id: string;
  status: string;
  render_status: string;
  render_progress: number;
  render_url?: string;
  duration?: number;
}

export async function getEditStatus(
  editId: string
): Promise<VideoEditStatus> {
  return api(`/v1/video-edits/${editId}`);
}

// ── Limits ─────────────────────────────────────────────

export interface UsageLimits {
  periodStart: string;
  periodEnd: string;
  limits: {
    posts_per_month: number;
    audios_uploaded_per_month: number;
    video_edits_per_month: number;
    slideshow_edits_per_month: number;
  };
  usage: {
    posts_per_month: number;
    audios_uploaded_per_month: number;
    video_edits_per_month: number;
    slideshow_edits_per_month: number;
  };
}

export async function getLimits(): Promise<UsageLimits> {
  return api("/v1/limits");
}
