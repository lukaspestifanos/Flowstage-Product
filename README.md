# Triptych - Editor Mode

An AI edit director built on the Flowstage API. Labels pick a song and a clip library. The system reads every clip's scene analysis against the song's timestamped lyrics and produces an emotionally matched edit plan. One click renders it through Flowstage.

## What Flowstage already does, and where Triptych sits on top

Flowstage auto-draft already builds videos from multiple clips. Feed it an aesthetic, a song section, and a hook string, and it picks videos from your aesthetic and renders an edit. That works today.

What it does not do:

**It doesn't reason about which clip matches which lyric.** Auto-draft minimizes recency and maximizes variety. It is not reading scene summaries against lyric content to decide that a specific clip belongs on a specific line because of what the clip depicts and what the lyric says. The selection is stylistic, not semantic.

**It doesn't pick the section for you based on the song's emotional arc.** The user supplies `section_start_time` and `section_end_time`. The user decides the chorus is the right section to use. Triptych reads the full lyrics, identifies which section carries the emotional weight, and picks that section with a stated reason.

**It doesn't tell you why it made the choices it made.** Auto-draft returns a rendered video. It does not return "I put this clip here because the scene summary says 'person walking alone in rain' and the lyric at 00:34 says 'I never knew him,' and that's the emotional payoff of the section." Triptych returns the plan before the render, with per-clip reasoning and an emotional arc label (setup, tension, release, payoff) on every clip.

**It doesn't separate the creative decision from the render.** Auto-draft is one call. You get a video back. If the video is wrong, you regenerate, which costs another render. Triptych is two steps. The plan is free. The render is the commit. You see the intelligence before you spend the quota.

The short version: Flowstage's existing API can assemble a video out of multiple clips and music. Triptych adds the layer that decides, with reasoning, which specific clips tell which specific part of the song's story, and why. The render engine stays Flowstage's. The creative decision layer is new.

## What's demonstration, not differentiation

Analytics and Settings use the Flowstage API correctly but duplicate functionality that already exists in the Flowstage UI. I built them to demonstrate full API surface coverage in the time constraint, not because they're differentiated features. In a real product scope, these would be starting points for label-specific views like cross-account campaign tracking and team permissions, rather than 1:1 mirrors of existing Flowstage screens.

## What it does

**Editor.** The core feature. Search any song or TikTok sound, select clips from a Flowstage aesthetic, and generate an edit plan. The AI reads each clip's scene summary, tags, and emotional tone against the song's lyrics. It decides which section of the song to use, which clips match that section's meaning, what order builds the best emotional arc, and what lyric should be the hook overlay. Every decision comes with reasoning the user can read before committing a render. One click sends the plan to Flowstage and returns a finished video.

**Analytics.** Pulls real post metrics (views, likes, comments, shares) across all connected TikTok and Instagram accounts. Campaign-level view for labels managing multiple editor pages.

**Settings.** Connect your Flowstage account, manage social platforms, monitor usage limits.

## What's novel vs. what's demonstration

The Editor is the differentiator. Flowstage renders videos. Triptych decides what to render and why. The scene analysis data and lyric timestamps already exist in the API. Nobody was using them together to make creative decisions. That's the gap this fills.

Analytics and Settings use the Flowstage API correctly but duplicate functionality that already exists in the Flowstage UI. I built them to demonstrate full API surface coverage in the time constraint, not because they're differentiated features. In a real product scope, these would be starting points for label-specific views like cross-account campaign tracking and team permissions, rather than 1:1 mirrors of existing Flowstage screens.

## How it works

1. `GET /v1/audios` fetches the label's uploaded tracks with sections and timestamped lyrics.
2. `GET /v1/aesthetics/{id}/videos` fetches every clip's scene_summary, tags, scene_focus, location, and time_of_day from Flowstage's analysis.
3. Gemini reads the full lyrics plus all clip analyses and returns a structured plan: chosen section, hook text, ordered clips with per-clip reasoning and emotional beat labels (setup, tension, release, payoff).
4. User reviews the plan and the reasoning before rendering.
5. `POST /v1/video-edits/draft` sends the clip order, audio section, hook, and preset to Flowstage in draft mode with `render: true`.
6. `GET /v1/video-edits/{id}/progress` polls until the render completes and returns the video URL.

The two-step plan-then-render flow is intentional. Rendering costs API quota. Showing the plan first lets the user see the intelligence before burning a render, and lets them regenerate if the plan doesn't land.

## Tradeoffs

**Rendered 1 edit in the demo.** Monthly render quota is limited. The plan step is free, rendering is not.

**Used Gemini over Claude.** Cost constraint for a take-home. The architecture is model-agnostic. The prompt and response schema swap cleanly to any LLM.

**Song search uses LRCLIB (free, no auth) for lyrics.** Flowstage audio is still required for rendering since the API needs a real `audio_id`. The search enriches planning with better lyric data.

**Social account connection deep-links to Flowstage's OAuth flow.** The API doesn't expose OAuth endpoints directly, which is the correct security decision. New-account onboarding redirects to `app.theflowstage.com` and returns to Triptych after the connection completes.

**Skipped auth.** Single-user demo. The API key is in `.env.local` or entered in Settings. A real deployment would need proper auth.

**Graceful degradation when Gemini is unavailable.** The render pipeline still works via heuristic clip scoring based on emotional tag density, but without natural-language reasoning. The user gets a video, but loses the explainability that makes the product valuable. This is a resilience pattern, not a replacement for the AI layer.

## What I'd build next

**Fan submission flow.** Labels publish a song and a clip bank as an aesthetic. Editor communities submit their own edits using label-approved clips. Best edits get promoted. This is where TikTok edit culture actually lives. Flowstage is creator-facing today, but the biggest driver of song discovery is the edit community.

**Multi-hook overlays.** Currently one hook string per edit. Timed text overlays tied to specific lyric lines would make the text feel like real edit culture, where every major line gets a callout.

**Performance feedback loop.** After N edits, learn which clip-selection patterns drive engagement and pre-bias future plans toward what actually performs.

**Beat detection.** The API doesn't expose beat timestamps today. Adding this plus per-clip duration control would unlock beat-synced edits on top of the same emotional matching architecture.

## How I used AI

Used Claude Code for scaffolding the Next.js project, wiring API routes, and fixing contract mismatches between frontend and backend. The Gemini prompt, the emotional matching architecture, and the product decisions (two-step plan-then-render, emotional beats over beat-sync, label framing) were mine. The core architectural choice of splitting creative decisions (AI) from execution (Flowstage API) is the product thesis.

## Stack

- Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- Flowstage API (aesthetics, video edits, render, social accounts, posts)
- Google Gemini 2.0 Flash (edit planning)
- LRCLIB (song and lyrics search, free, no auth)