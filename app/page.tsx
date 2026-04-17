"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────

interface AudioSection {
  id?: string;
  name: string;
  start_time: number;
  end_time: number;
}

interface Audio {
  id: string;
  name: string;
  duration?: number;
  sections?: AudioSection[];
}

interface VideoAnalysis {
  tags?: string[];
  scene_summary?: string;
  scene_focus?: string;
  location?: string;
  time_of_day?: string;
}

interface AnalyzedVideo {
  id: string;
  name: string;
  url: string;
  duration: number;
  thumbnail?: string;
  analysis?: VideoAnalysis;
}

interface Aesthetic {
  id: string;
  name: string;
  detail?: {
    videos?: AnalyzedVideo[];
    hooks?: { text: string }[];
    video_preset_names?: string[];
  };
}

type EmotionalBeat = "setup" | "tension" | "release" | "payoff";

interface PlanClip {
  video_id: string;
  video_name?: string;
  thumbnail?: string;
  url?: string;
  start_time: number;
  end_time: number;
  reasoning: string;
  emotional_beat: EmotionalBeat;
}

interface EditPlan {
  section: { name: string; start_time: number; end_time: number };
  hook: string;
  narrative_summary: string;
  clips: PlanClip[];
  preset_name?: string;
}

// ── Helpers ────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const BEAT_STYLES: Record<EmotionalBeat, string> = {
  setup: "border-sky-500/30 text-sky-300 bg-sky-500/5",
  tension: "border-amber-500/30 text-amber-300 bg-amber-500/5",
  release: "border-violet-500/30 text-violet-300 bg-violet-500/5",
  payoff: "border-emerald-500/30 text-emerald-300 bg-emerald-500/5",
};

// ── Video thumbnail — renders first frame from video URL ─

function VideoThumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <video
      src={src}
      muted
      preload="metadata"
      playsInline
      className={className || "w-full h-full object-cover"}
      onLoadedData={(e) => {
        // Seek to 0.5s for a better frame than pure black
        const v = e.currentTarget;
        v.currentTime = Math.min(0.5, v.duration || 0.5);
      }}
      title={alt}
    />
  );
}

// ── Component ──────────────────────────────────────────

// ── Analytics types ────────────────────────────────────

interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  timezone?: string;
  bound_aesthetic_id?: string;
}

interface PostMetrics {
  id: string;
  social_account_id: string;
  caption: string;
  hashtags: string[];
  time_scheduled: string;
  is_posted: boolean;
  tt_status: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  hook: string | null;
  account_handle?: string;
  account_platform?: string;
  video_edit: {
    id: string;
    name: string;
    render_url: string | null;
  } | null;
}

interface AnalyticsStats {
  totalPosts: number;
  scheduledPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagement: string;
}

type Tab = "editor" | "analytics" | "settings";

export default function EditorMode() {
  const [activeTab, setActiveTab] = useState<Tab>("editor");

  // Connection state
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyStored, setApiKeyStored] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingFlowstage, setConnectingFlowstage] = useState(false);

  // Analytics state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [analyticsPosts, setAnalyticsPosts] = useState<PostMetrics[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [audios, setAudios] = useState<Audio[]>([]);
  const [aesthetics, setAesthetics] = useState<Aesthetic[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [usageLimits, setUsageLimits] = useState<{ usage: Record<string, number>; limits: Record<string, number> } | null>(null);

  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [selectedAestheticId, setSelectedAestheticId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  const [clips, setClips] = useState<AnalyzedVideo[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null);

  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Clip upload
  const [clipUrl, setClipUrl] = useState("");
  const [uploadingClip, setUploadingClip] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetch("/api/flowstage")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setApiKeyStored(true);
        setAudios(data.audios || []);
        setAesthetics(data.aesthetics || []);
        if (data.limits) setUsageLimits(data.limits);
        if (data.audios?.length) setSelectedAudioId(data.audios[0].id);
        if (data.aesthetics?.length) setSelectedAestheticId(data.aesthetics[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, []);

  // Fetch analytics when tab switches or account changes
  useEffect(() => {
    if (activeTab !== "analytics") return;
    setLoadingAnalytics(true);
    const url = selectedAccountId
      ? `/api/analytics?accountId=${encodeURIComponent(selectedAccountId)}`
      : "/api/analytics";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setSocialAccounts(data.accounts || []);
        setAnalyticsPosts(data.posts || []);
        setAnalyticsStats(data.stats || null);
      })
      .catch(() => {})
      .finally(() => setLoadingAnalytics(false));
  }, [activeTab, selectedAccountId]);

  // Fetch clips when aesthetic changes
  useEffect(() => {
    if (!selectedAestheticId) return;
    setLoadingClips(true);
    setClips([]);
    fetch(`/api/flowstage?aestheticId=${encodeURIComponent(selectedAestheticId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        const vids = data.videos || [];
        setClips(vids);
        setSelectedClipIds(new Set(vids.map((v: AnalyzedVideo) => v.id)));
        // Store preset names on the aesthetic and auto-select first
        const sa = data.selectedAesthetic;
        if (sa) {
          const presets: string[] = sa.video_preset_names || [];
          setAesthetics((prev) =>
            prev.map((a) =>
              a.id === selectedAestheticId
                ? { ...a, detail: { ...a.detail, video_preset_names: presets, hooks: sa.hooks } }
                : a
            )
          );
          if (presets.length) setSelectedPreset(presets[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingClips(false));
  }, [selectedAestheticId]);

  // Fake smooth progress while rendering
  useEffect(() => {
    if (!rendering) return;
    const id = setInterval(() => {
      setRenderProgress((p) => (p < 92 ? p + Math.max(1, (95 - p) * 0.06) : p));
    }, 400);
    return () => clearInterval(id);
  }, [rendering]);

  const handleUploadClip = useCallback(async () => {
    if (!clipUrl.trim() || !selectedAestheticId) return;
    setUploadingClip(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/upload-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aestheticId: selectedAestheticId, url: clipUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClipUrl("");
      // Refresh clips
      const clipRes = await fetch(`/api/flowstage?aestheticId=${encodeURIComponent(selectedAestheticId)}`);
      const clipData = await clipRes.json();
      if (!clipData.error) setClips(clipData.videos || []);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingClip(false);
    }
  }, [clipUrl, selectedAestheticId]);

  const selectedAudio = audios.find((a) => a.id === selectedAudioId);
  const selectedAesthetic = aesthetics.find((a) => a.id === selectedAestheticId);

  const audioForPlan = selectedAudio || null;

  const resetPlan = useCallback(() => {
    setPlan(null);
    setRenderUrl(null);
    setRenderError(null);
    setRenderProgress(0);
  }, []);

  const activeClips = clips.filter((c) => selectedClipIds.has(c.id));

  const handleGeneratePlan = useCallback(async () => {
    if (!audioForPlan || !selectedAesthetic || !activeClips.length) return;
    setPlanning(true);
    setPlanError(null);
    setPlan(null);
    setRenderUrl(null);
    try {
      const res = await fetch("/api/plan-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: audioForPlan,
          aesthetic: {
            id: selectedAesthetic.id,
            name: selectedAesthetic.name,
            hooks: selectedAesthetic.detail?.hooks || [],
            preset_name: selectedPreset || selectedAesthetic.detail?.video_preset_names?.[0],
          },
          clips: activeClips,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.plan) throw new Error("No plan returned");
      setPlan(data.plan);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Planning failed");
    } finally {
      setPlanning(false);
    }
  }, [audioForPlan, selectedAesthetic, activeClips]);

  // Rendering requires a real Flowstage audio_id — can't render with just a searched song
  const canRender = !!plan && !!selectedAudio && !!selectedAesthetic;

  const handleRender = useCallback(async () => {
    if (!plan || !selectedAesthetic) return;
    if (!selectedAudio) {
      setRenderError("Select a Flowstage audio track to render. The searched song provides lyrics for planning, but Flowstage needs an uploaded audio file to render the video.");
      return;
    }
    setRendering(true);
    setRenderProgress(3);
    setRenderError(null);
    try {
      const res = await fetch("/api/render-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          audio_id: selectedAudio.id,
          aesthetic_id: selectedAesthetic.id,
          preset_name: selectedPreset || plan.preset_name || selectedAesthetic.detail?.video_preset_names?.[0],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.render_url) throw new Error("Render completed but no URL returned — check Flowstage dashboard");
      setRenderProgress(100);
      setRenderUrl(data.render_url);
    } catch (e) {
      setRenderProgress(0);
      setRenderError(e instanceof Error ? e.message : "Render failed");
    } finally {
      setRendering(false);
    }
  }, [plan, selectedAudio, selectedAesthetic, selectedPreset]);

  const canPlan =
    !!audioForPlan && !!selectedAestheticId && activeClips.length > 0 && !planning && !loadingClips;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-[1440px] mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/flowstage-icon.ico"
                alt="Flowstage"
                width={20}
                height={20}
                className="rounded"
                unoptimized
              />
              <span className="text-sm font-semibold tracking-tight">Flowstage</span>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-sm font-semibold tracking-tight">Triptych</span>
            </div>
            <nav className="flex items-center gap-1 ml-3">
              <button
                onClick={() => setActiveTab("editor")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "editor"
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "analytics"
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "settings"
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Settings
              </button>
            </nav>
          </div>
          {/* Account switcher */}
          <div className="flex items-center gap-2">
            {socialAccounts.length > 0 ? (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-8 rounded-md border border-border bg-card px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                <option value="">All managed accounts</option>
                {socialAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.handle} · {a.platform}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {loadingData ? "" : `${aesthetics.length} aesthetic${aesthetics.length !== 1 ? "s" : ""} · ${audios.length} track${audios.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Analytics Tab ────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="max-w-[1440px] mx-auto px-8 py-10 space-y-8">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Campaign Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Performance across TikTok, Instagram, and YouTube - all accounts, last 30 days.
              </p>
            </div>

            {loadingAnalytics ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full" />
                Loading metrics...
              </div>
            ) : analyticsStats ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Views", value: analyticsStats.totalViews.toLocaleString() },
                    { label: "Likes", value: analyticsStats.totalLikes.toLocaleString() },
                    { label: "Comments", value: analyticsStats.totalComments.toLocaleString() },
                    { label: "Shares", value: analyticsStats.totalShares.toLocaleString() },
                  ].map((stat) => (
                    <Card key={stat.label} className="border-border/50 bg-card">
                      <CardContent className="p-4">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="text-2xl font-semibold tracking-tight mt-1">{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Summary row */}
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-medium">{analyticsStats.totalPosts}</span> posted
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-medium">{analyticsStats.scheduledPosts}</span> scheduled
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-medium">{analyticsStats.avgEngagement}</span> avg engagement/post
                  </span>
                </div>

                {/* Posts table */}
                {analyticsPosts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Posts
                    </p>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-card">
                            <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Account</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Hook / Caption</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Views</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Likes</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Comments</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsPosts.map((post) => (
                            <tr key={post.id} className="border-b border-border/30 last:border-0 hover:bg-white/[0.02]">
                              <td className="px-4 py-3">
                                <span className="text-xs">{post.account_handle || "—"}</span>
                                <span className="text-[10px] text-muted-foreground ml-1">{post.account_platform}</span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs truncate max-w-xs">
                                  {post.hook || post.caption || "No caption"}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">
                                {post.views != null ? post.views.toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">
                                {post.likes != null ? post.likes.toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">
                                {post.comments != null ? post.comments.toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {post.is_posted ? (
                                  <Badge variant="outline" className="text-[9px] font-normal border-emerald-500/30 text-emerald-400">
                                    posted
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] font-normal">
                                    scheduled
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No posts in the last 30 days. Generate edits in the Editor tab and schedule them to managed accounts.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connect managed accounts (TikTok, Instagram) in Flowstage to track campaign performance.
              </p>
            )}
          </div>
        )}

        {/* ── Settings Tab ──────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="max-w-[1440px] mx-auto px-8 py-10 space-y-8">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Connect your Flowstage account and manage social platforms.
              </p>
            </div>

            {/* Flowstage connection */}
            <Card className="border-border/50 bg-card">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image src="/flowstage-icon.ico" alt="Flowstage" width={28} height={28} className="rounded" unoptimized />
                    <div>
                      <p className="text-sm font-medium">Flowstage</p>
                      <p className="text-[11px] text-muted-foreground">Content engine connection</p>
                    </div>
                  </div>
                  {apiKeyStored ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Connected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Not connected</Badge>
                  )}
                </div>
                {!apiKeyStored ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Paste your Flowstage API key (fs_...)"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                      <Button
                        onClick={async () => {
                          if (!apiKeyInput.trim()) return;
                          setConnectingFlowstage(true);
                          setConnectError(null);
                          try {
                            const res = await fetch("/api/connect", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
                            });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            setApiKeyStored(true);
                            setSocialAccounts(data.accounts || []);
                          } catch (e) {
                            setConnectError(e instanceof Error ? e.message : "Connection failed");
                          } finally {
                            setConnectingFlowstage(false);
                          }
                        }}
                        disabled={!apiKeyInput.trim() || connectingFlowstage}
                        className="h-9 px-4 rounded-lg text-xs"
                      >
                        {connectingFlowstage ? "Connecting..." : "Connect"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Get your API key from the API tab in{" "}
                      <a href="https://app.theflowstage.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline">
                        app.theflowstage.com
                      </a>
                    </p>
                    {connectError && <p className="text-[11px] text-red-400">{connectError}</p>}
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px] text-muted-foreground">
                    <p>{aesthetics.length} aesthetic{aesthetics.length !== 1 ? "s" : ""} · {audios.length} track{audios.length !== 1 ? "s" : ""}</p>
                    <button
                      onClick={() => { setApiKeyStored(false); setApiKeyInput(""); }}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social accounts */}
            <Card className="border-border/50 bg-card">
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium">Managed Accounts</p>
                  <p className="text-[11px] text-muted-foreground">
                    Connect TikTok and Instagram accounts to schedule edits and track performance.
                  </p>
                </div>

                {socialAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {socialAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            acc.platform === "tiktok" ? "bg-white/10" : "bg-gradient-to-br from-purple-500/20 to-pink-500/20"
                          }`}>
                            {acc.platform === "tiktok" ? "TT" : "IG"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{acc.handle}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{acc.platform}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Active</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No accounts connected yet.</p>
                )}

                <div className="flex gap-2 pt-2">
                  <a
                    href="https://app.theflowstage.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-background text-xs font-medium hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold">TT</span>
                    Connect TikTok
                  </a>
                  <a
                    href="https://app.theflowstage.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-background text-xs font-medium hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-[9px] font-bold">IG</span>
                    Connect Instagram
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Account connection is handled through Flowstage — you&apos;ll be redirected to authorize.
                </p>
              </CardContent>
            </Card>

            {/* Usage */}
            <Card className="border-border/50 bg-card">
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium">Usage This Month</p>
                  <p className="text-[11px] text-muted-foreground">Flowstage resource consumption for the current billing period.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Video Edits", used: usageLimits?.usage?.video_edits_per_month ?? 0, limit: usageLimits?.limits?.video_edits_per_month ?? 50 },
                    { label: "Posts", used: usageLimits?.usage?.posts_per_month ?? 0, limit: usageLimits?.limits?.posts_per_month ?? 100 },
                    { label: "Audio Uploads", used: usageLimits?.usage?.audios_uploaded_per_month ?? 0, limit: usageLimits?.limits?.audios_uploaded_per_month ?? 5 },
                    { label: "Slideshows", used: usageLimits?.usage?.slideshow_edits_per_month ?? 0, limit: usageLimits?.limits?.slideshow_edits_per_month ?? 50 },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-semibold">
                        {item.used}<span className="text-muted-foreground font-normal text-sm">/{item.limit}</span>
                      </p>
                      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-white/40 rounded-full"
                          style={{ width: `${Math.min(100, (item.used / item.limit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Editor Tab ───────────────────────────────── */}
        {activeTab === "editor" && (
        <div className="max-w-[1440px] mx-auto px-8 py-10 space-y-10">
          {/* ── Setup ─────────────────────────────────── */}
          {!plan && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  AI-directed edits for TikTok, Instagram, and YouTube.
                </h1>
                <p className="text-sm text-muted-foreground">
                  Flowstage renders. Triptych decides what to render and why. Pick a song, select your
                  clips, and AI matches each clip to the lyrics based on emotional meaning - not beats.
                  Review the reasoning, then render to any platform in one click.
                </p>
              </div>

              {/* Audio + aesthetic + preset row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Audio Track
                  </label>
                  <select
                    value={selectedAudioId}
                    onChange={(e) => { setSelectedAudioId(e.target.value); resetPlan(); }}
                    disabled={loadingData}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                  >
                    {audios.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}{a.duration ? ` · ${formatTime(a.duration)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Aesthetic
                  </label>
                  <select
                    value={selectedAestheticId}
                    onChange={(e) => { setSelectedAestheticId(e.target.value); setSelectedPreset(""); resetPlan(); }}
                    disabled={loadingData}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                  >
                    {loadingData && <option>Loading…</option>}
                    {aesthetics.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Preset
                  </label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    disabled={loadingClips}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                  >
                    {selectedAesthetic?.detail?.video_preset_names?.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    {!selectedAesthetic?.detail?.video_preset_names?.length && (
                      <option value="">Loading presets…</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Clip grid — selectable */}
              {selectedAestheticId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Clip library — click to include/exclude
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground">
                        {loadingClips ? "reading…" : `${selectedClipIds.size}/${clips.length} selected`}
                      </span>
                      {!loadingClips && clips.length > 0 && (
                        <button
                          onClick={() => {
                            if (selectedClipIds.size === clips.length) {
                              setSelectedClipIds(new Set());
                            } else {
                              setSelectedClipIds(new Set(clips.map((c) => c.id)));
                            }
                          }}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {selectedClipIds.size === clips.length ? "Deselect all" : "Select all"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {loadingClips &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="shrink-0 w-28 h-36 rounded-md bg-white/[0.03] border border-border animate-pulse"
                        />
                      ))}
                    {!loadingClips &&
                      clips.map((c) => {
                        const isSelected = selectedClipIds.has(c.id);
                        const isExpanded = expandedClipId === c.id;
                        return (
                          <div key={c.id} className="shrink-0 flex flex-col gap-1">
                            <button
                              onClick={() => {
                                const next = new Set(selectedClipIds);
                                if (isSelected) next.delete(c.id);
                                else next.add(c.id);
                                setSelectedClipIds(next);
                              }}
                              className={`relative w-28 h-36 rounded-md overflow-hidden border-2 transition-all ${
                                isSelected
                                  ? "border-white/50 ring-1 ring-white/20"
                                  : "border-border opacity-40 hover:opacity-70"
                              }`}
                            >
                              {c.url ? (
                                <VideoThumb src={c.url} alt={c.name} />
                              ) : c.thumbnail ? (
                                <Image
                                  src={c.thumbnail}
                                  alt={c.name}
                                  fill
                                  sizes="112px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full bg-card flex items-center justify-center text-[9px] text-muted-foreground p-1.5 text-center leading-tight">
                                  {c.analysis?.scene_summary?.slice(0, 40) || c.name}
                                </div>
                              )}
                              {/* Selection check */}
                              <div className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                isSelected ? "bg-white text-black" : "bg-black/50 text-white/50"
                              }`}>
                                {isSelected ? "✓" : ""}
                              </div>
                              {/* Tags overlay */}
                              {c.analysis?.tags && c.analysis.tags.length > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-3">
                                  <p className="text-[8px] text-white/80 truncate">
                                    {c.analysis.tags.slice(0, 3).join(" · ")}
                                  </p>
                                </div>
                              )}
                            </button>
                            {/* Info toggle */}
                            <button
                              onClick={() => setExpandedClipId(isExpanded ? null : c.id)}
                              className="text-[9px] text-muted-foreground hover:text-foreground transition-colors text-center"
                            >
                              {isExpanded ? "hide" : "info"}
                            </button>
                            {isExpanded && c.analysis && (
                              <div className="w-28 rounded-md bg-card border border-border p-2 space-y-1">
                                <p className="text-[9px] leading-tight">{c.analysis.scene_summary}</p>
                                <p className="text-[8px] text-muted-foreground">
                                  {c.analysis.scene_focus} · {c.analysis.location} · {c.analysis.time_of_day}
                                </p>
                                <p className="text-[8px] text-muted-foreground">
                                  {formatTime(c.duration)}s
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Clip upload */}
              {selectedAestheticId && (
                <div className="space-y-2">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Add to library — paste a public video URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://videos.pexels.com/... or any public MP4/MOV URL"
                      value={clipUrl}
                      onChange={(e) => setClipUrl(e.target.value)}
                      className="flex-1 h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <Button
                      onClick={handleUploadClip}
                      disabled={!clipUrl.trim() || uploadingClip}
                      variant="secondary"
                      className="h-9 px-4 rounded-lg text-xs"
                    >
                      {uploadingClip ? "Adding..." : "Add Clip"}
                    </Button>
                  </div>
                  {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
                  <p className="text-[10px] text-muted-foreground">
                    Supports MP4, MOV, M4V, WebM. Flowstage will analyze the clip automatically.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleGeneratePlan}
                  disabled={!canPlan}
                  className="h-10 px-6 rounded-lg font-medium"
                >
                  {planning ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                      Planning…
                    </span>
                  ) : (
                    "Generate Edit Plan"
                  )}
                </Button>
                {planning && (
                  <span className="text-xs text-muted-foreground">
                    Matching {activeClips.length} clips to lyrics…
                  </span>
                )}
              </div>

              {planError && <p className="text-xs text-red-400">{planError}</p>}
            </div>
          )}

          {/* ── Plan + Render ────────────────────────── */}
          {plan && (
            <div className="space-y-8">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Hook
                  </p>
                  <p className="text-2xl font-semibold tracking-tight leading-tight">
                    &ldquo;{plan.hook}&rdquo;
                  </p>
                </div>
                <button
                  onClick={resetPlan}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-2"
                >
                  ← Start over
                </button>
              </div>

              {/* Song section */}
              {audioForPlan && (
                <Card className="border-border/50 bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {audioForPlan.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {plan.section.name}
                      </Badge>
                    </div>
                    {audioForPlan.duration && (
                      <SongTimeline
                        duration={audioForPlan.duration}
                        section={plan.section}
                        sections={audioForPlan.sections}
                      />
                    )}
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                      <span>0:00</span>
                      <span>
                        {formatTime(plan.section.start_time)} – {formatTime(plan.section.end_time)}
                      </span>
                      <span>{formatTime(audioForPlan.duration || 0)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Narrative */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Narrative
                </p>
                <p className="text-sm leading-relaxed text-foreground/90 max-w-2xl">
                  {plan.narrative_summary}
                </p>
              </div>

              {/* Two-column: plan / render */}
              <div className={`grid gap-8 ${renderUrl ? "lg:grid-cols-[1fr_360px]" : "grid-cols-1"}`}>
                {/* Clips */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Shot list · {plan.clips.length} clips
                    </p>
                    <div className="flex gap-1.5">
                      {(["setup", "tension", "release", "payoff"] as EmotionalBeat[]).map((b) => (
                        <span
                          key={b}
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${BEAT_STYLES[b]}`}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {plan.clips.map((clip, i) => (
                      <Card key={`${clip.video_id}-${i}`} className="border-border/50 bg-card overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex gap-4">
                            <div className="relative w-28 h-28 shrink-0 bg-black overflow-hidden">
                              {clip.url ? (
                                <VideoThumb src={clip.url} alt={clip.video_name || `Clip ${i + 1}`} />
                              ) : clip.thumbnail ? (
                                <Image
                                  src={clip.thumbnail}
                                  alt={clip.video_name || `Clip ${i + 1}`}
                                  fill
                                  sizes="112px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                  {clip.video_name || `Clip ${i + 1}`}
                                </div>
                              )}
                              <span className="absolute top-1.5 left-1.5 text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 py-3 pr-4 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${BEAT_STYLES[clip.emotional_beat]}`}
                                >
                                  {clip.emotional_beat}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {formatTime(clip.start_time)} – {formatTime(clip.end_time)}
                                </span>
                                {clip.video_name && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {clip.video_name}
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] leading-relaxed text-foreground/90">
                                {clip.reasoning}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Render column */}
                <div className="space-y-3">
                  {!renderUrl && !rendering && (
                    <div className="space-y-3 lg:sticky lg:top-20">
                      <Button
                        onClick={handleRender}
                        disabled={!canRender && !selectedAesthetic}
                        className="w-full h-11 rounded-lg font-medium"
                      >
                        Render This Edit
                      </Button>
                      {!selectedAudio && (
                        <p className="text-[11px] text-amber-400 leading-relaxed">
                          Select an audio track above to render. Song search provides lyrics for AI planning - Flowstage needs the uploaded audio to produce the video.
                        </p>
                      )}
                      {selectedAudio && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Rendering {plan.clips.length} clips with &ldquo;{selectedAudio.name}&rdquo; via Flowstage. Ready for TikTok, Instagram, or YouTube.
                        </p>
                      )}
                      {renderError && (
                        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                          <p className="text-xs text-red-400">{renderError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {rendering && (
                    <Card className="border-border/50 bg-card">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Rendering
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {Math.round(renderProgress)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-white/60 to-white rounded-full transition-[width] duration-500 ease-out"
                            style={{ width: `${renderProgress}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Stitching {plan.clips.length} clips against {plan.section.name}…
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {renderUrl && (
                    <div className="space-y-2 lg:sticky lg:top-20">
                      <div className="rounded-lg overflow-hidden border border-border bg-black aspect-[9/16]">
                        <video
                          src={renderUrl}
                          controls
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain bg-black"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal border-emerald-500/30 text-emerald-400"
                        >
                          rendered
                        </Badge>
                        <a
                          href={renderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Open ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
}

// ── Song timeline with section highlight ───────────────

function SongTimeline({
  duration,
  section,
  sections,
}: {
  duration: number;
  section: { start_time: number; end_time: number };
  sections?: AudioSection[];
}) {
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / duration) * 100))}%`;
  return (
    <div className="relative h-8 w-full rounded-md bg-white/[0.04] overflow-hidden">
      {sections?.map((s, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r border-white/[0.06]"
          style={{ left: pct(s.start_time), width: `calc(${pct(s.end_time - s.start_time)})` }}
        >
          <span className="absolute top-1 left-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/70">
            {s.name}
          </span>
        </div>
      ))}
      <div
        className="absolute top-0 bottom-0 bg-white/20 border-l-2 border-r-2 border-white"
        style={{
          left: pct(section.start_time),
          width: pct(section.end_time - section.start_time),
        }}
      />
    </div>
  );
}
