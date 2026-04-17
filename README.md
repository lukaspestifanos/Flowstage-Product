# Triptych — Editor Mode

An AI edit director built on the Flowstage API. Labels pick a song and a clip library, and the system reads every clip's scene analysis against the song's timestamped lyrics to produce an emotionally-matched edit plan — then renders it through Flowstage.

## What it does

**Editor** — The core feature. Search any song or TikTok sound, select clips from a Flowstage aesthetic, and generate an edit plan. The AI reads each clip's scene summary, tags, and emotional tone against the song's lyrics and decides: which section of the song to use, which clips match that section's meaning, what order builds the best emotional arc, and what lyric should be the hook overlay. Every decision comes with reasoning the user can read before committing a render. One click sends the plan to Flowstage and returns a finished video.

**Analytics** — Pulls real post metrics (views, likes, comments, shares) across all connected TikTok/Instagram accounts. Campaign-level view for labels managing multiple editor pages.

**Settings** — Connect your Flowstage account, manage social platforms, monitor usage limits.

## What's novel vs. what's demonstration

The Editor is the differentiator. Flowstage renders videos — this decides *what* to render and *why*. The scene analysis data and lyric timestamps already exist in the API; nobody was using them together to make creative decisions. That's the gap this fills.

Analytics and Settings use the Flowstage API correctly but duplicate functionality that already exists in the Flowstage UI. I built them to demonstrate full API surface coverage in the time constraint, not because they're differentiated features. In a real product scope, these would be starting points for label-specific views (cross-account campaign tracking, team permissions) rather than 1:1 mirrors of existing Flowstage screens.

## How it works

1. `GET /v1/audios` — fetches the label's uploaded tracks with sections and timestamped lyrics
2. `GET /v1/aesthetics/{id}/videos` — fetches every clip's scene_summary, tags, scene_focus, location, time_of_day from Flowstage's analysis
3. Gemini reads the full lyrics + all clip analyses and returns a structured plan: chosen section, hook text, ordered clips with per-clip reasoning and emotional beat labels (setup → tension → release → payoff)
4. User reviews the plan and the reasoning before rendering
5. `POST /v1/video-edits/draft` — sends the clip order, audio section, hook, and preset to Flowstage in draft mode with `render: true`
6. `GET /v1/video-edits/{id}/progress` — polls until the render completes, returns the video URL

The two-step plan-then-render flow is intentional. Rendering costs API quota. Showing the plan first lets the user see the intelligence before burning a render, and lets them regenerate if the plan doesn't land.

## Tradeoffs

- **Rendered 1 edit in the demo.** Monthly render quota is limited — the plan step is free, rendering is not.
- **Used Gemini over Claude.** Cost constraint for a take-home. The architecture is model-agnostic — the prompt and response schema swap cleanly to any LLM.
- **Song search uses LRCLIB (free, no auth) for lyrics.** Flowstage audio is still required for rendering since the API needs a real `audio_id`. The search enriches planning with better lyric data.
- **Social account connection goes through Flowstage.** The API doesn't expose OAuth endpoints, so TikTok/Instagram auth links redirect to `app.theflowstage.com` where the user completes the flow.
- **Skipped auth.** Single-user demo — the API key is in `.env.local` or entered in Settings. A real deployment would need proper auth.
- **Smart fallback when Gemini is unavailable.** If the API key is exhausted or missing, the system falls back to heuristic clip scoring based on emotional tag density. The edit still gets planned — just without the natural language reasoning.

## What I'd build next

- **Fan submission flow.** Labels publish a song + clip bank as an aesthetic. Editor communities submit their own edits using label-approved clips. Best edits get promoted. This is where TikTok edit culture actually lives — Flowstage is creator-facing today, but the biggest driver of song discovery is the edit community.
- **Multi-hook overlays.** Currently one hook string per edit. Timed text overlays tied to specific lyric lines would make the text feel like real edit culture where every major line gets a callout.
- **Performance feedback loop.** After N edits, learn which clip-selection patterns drive engagement and pre-bias future plans toward what actually performs.
- **Beat detection.** The API doesn't expose beat timestamps today. Adding this plus per-clip duration control would unlock beat-synced edits on top of the same emotional matching architecture.

## How I used AI

Used Claude Code for scaffolding the Next.js project, wiring API routes, and fixing contract mismatches between frontend and backend. The Gemini prompt, the emotional matching architecture, and the product decisions (two-step plan-then-render, emotional beats over beat-sync, label framing) were mine. The core architectural choice — splitting creative decisions (AI) from execution (Flowstage API) — is the product thesis, not an implementation detail.

## Stack

- Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- Flowstage API (aesthetics, video edits, render, social accounts, posts)
- Google Gemini 2.0 Flash (edit planning)
- LRCLIB (song/lyrics search, free, no auth)
