import { NextRequest, NextResponse } from "next/server";

// Validates a Flowstage API key by calling /v1/limits
// Returns account info if valid
export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }

    const res = await fetch("https://api.theflowstage.com/v1/limits", {
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }
      return NextResponse.json({ error: `Flowstage returned ${res.status}` }, { status: res.status });
    }

    const limits = await res.json();

    // Also fetch social accounts to show connection status
    const accountsRes = await fetch("https://api.theflowstage.com/v1/social-accounts", {
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    });
    const accountsData = accountsRes.ok ? await accountsRes.json() : { accounts: [] };

    // Fetch aesthetics count
    const aestheticsRes = await fetch("https://api.theflowstage.com/v1/aesthetics", {
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    });
    const aestheticsData = aestheticsRes.ok ? await aestheticsRes.json() : { aesthetics: [] };

    return NextResponse.json({
      connected: true,
      limits,
      accounts: accountsData.accounts || [],
      aestheticCount: (aestheticsData.aesthetics || []).length,
    });
  } catch (error) {
    console.error("Connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
