import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.theflowstage.com";

function getApiKey(): string {
  const key = process.env.FLOWSTAGE_API_KEY;
  if (!key) throw new Error("FLOWSTAGE_API_KEY not set");
  return key;
}

async function api<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-API-Key": getApiKey(), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Flowstage ${res.status}: ${body}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");

  try {
    // Get all social accounts
    const accountsData = await api<{ accounts: Array<{
      id: string;
      platform: string;
      handle: string;
      timezone?: string;
      default_timeslots?: number[];
      bound_aesthetic_id?: string;
    }> }>("/v1/social-accounts");

    const accounts = accountsData.accounts;

    if (!accounts.length) {
      return NextResponse.json({ accounts: [], posts: [] });
    }

    // If a specific account is selected, get its posts. Otherwise batch all.
    const targetIds = accountId ? [accountId] : accounts.map((a) => a.id);

    // Get posts for last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    const postsData = await api<{ posts_by_account: Record<string, Array<{
      id: string;
      social_account_id: string;
      video_edit_id: string;
      caption: string;
      hashtags: string[];
      time_scheduled: string;
      is_posted: boolean;
      tt_status: string | null;
      views: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      metrics_updated_at: string | null;
      hook: string | null;
      video_edit: {
        id: string;
        name: string;
        render_url: string | null;
        render_progress: number | null;
      } | null;
    }>> }>(
      `/v1/posts/batch?account_ids=${targetIds.join(",")}&start_date=${startDate}&end_date=${endDate}&include_posted=true`
    );

    // Flatten posts and add account info
    const allPosts: Array<Record<string, unknown>> = [];
    for (const [accId, posts] of Object.entries(postsData.posts_by_account)) {
      const account = accounts.find((a) => a.id === accId);
      for (const post of posts) {
        allPosts.push({
          ...post,
          account_handle: account?.handle,
          account_platform: account?.platform,
        });
      }
    }

    // Sort by views descending (posted content first)
    allPosts.sort((a, b) => {
      const aViews = (a.views as number) ?? -1;
      const bViews = (b.views as number) ?? -1;
      return bViews - aViews;
    });

    // Aggregate stats
    const postedPosts = allPosts.filter((p) => p.is_posted);
    const totalViews = postedPosts.reduce((sum, p) => sum + ((p.views as number) || 0), 0);
    const totalLikes = postedPosts.reduce((sum, p) => sum + ((p.likes as number) || 0), 0);
    const totalComments = postedPosts.reduce((sum, p) => sum + ((p.comments as number) || 0), 0);
    const totalShares = postedPosts.reduce((sum, p) => sum + ((p.shares as number) || 0), 0);
    const avgEngagement = postedPosts.length
      ? ((totalLikes + totalComments + totalShares) / postedPosts.length).toFixed(1)
      : "0";

    return NextResponse.json({
      accounts,
      posts: allPosts,
      stats: {
        totalPosts: postedPosts.length,
        scheduledPosts: allPosts.length - postedPosts.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        avgEngagement,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
