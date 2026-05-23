export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_TENANT, BRANCHES } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const branchFilter: string | undefined =
      body.branch && body.branch !== "All" ? body.branch : undefined;
    const period: "daily" | "weekly" =
      body.period === "weekly" ? "weekly" : "daily";

    const today = new Date().toISOString().split("T")[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000)
      .toISOString()
      .split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];

    let query = getSupabaseAdmin()
      .from("clients")
      .select(
        "id, name, branch, visits, events, event_date, alterations, alteration_status, special_order, special_order_status, follow_up, updated_at"
      )
      .eq("tenant_id", DEFAULT_TENANT)
      .gte("updated_at", sixMonthsAgo);

    if (branchFilter) {
      query = query.eq("branch", branchFilter);
    }

    const { data: clients, error: dbError } = await query;

    if (dbError) {
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    const branchesToSummarise = branchFilter ? [branchFilter] : BRANCHES;
    const branchStats = branchesToSummarise.map((branch) => {
      const bc = (clients ?? []).filter((c) => c.branch === branch);

      const todayVisits = bc.filter((c) =>
        (c.visits ?? []).some((v: { date: string }) => v.date === today)
      ).length;

      const weekVisits = bc.filter((c) =>
        (c.visits ?? []).some(
          (v: { date: string }) => v.date >= sevenDaysAgo && v.date <= today
        )
      ).length;

      const weekRevenue = bc.reduce(
        (s, c) =>
          s +
          (c.visits ?? [])
            .filter(
              (v: { date: string }) => v.date >= sevenDaysAgo && v.date <= today
            )
            .reduce(
              (vs: number, v: { spend?: number }) => vs + (v.spend ?? 0),
              0
            ),
        0
      );

      const returningCount = bc.filter(
        (c) => (c.visits ?? []).length >= 2
      ).length;

      const alterationsReady = bc.filter(
        (c) => c.alteration_status === "Ready"
      ).length;

      const ordersArrived = bc.filter(
        (c) => c.special_order_status === "Arrived"
      ).length;

      const followUps = bc.filter((c) => c.follow_up?.needed).length;

      const totalSpend = bc.reduce(
        (s, c) =>
          s +
          (c.visits ?? []).reduce(
            (vs: number, v: { spend?: number }) => vs + (v.spend ?? 0),
            0
          ),
        0
      );

      return {
        branch,
        count: bc.length,
        todayVisits,
        weekVisits,
        weekRevenue,
        returningCount,
        alterationsReady,
        ordersArrived,
        followUps,
        totalSpend,
      };
    });

    const totalClients = (clients ?? []).length;
    const isWeekly = period === "weekly";
    const periodLabel = isWeekly ? "weekly" : "daily";
    const focusField = isWeekly
      ? "weekVisits and weekRevenue for each branch (last 7 days)"
      : "todayVisits for each branch";

    const periodRange = isWeekly
      ? `WEEKLY (last 7 days, ${sevenDaysAgo} to ${today})`
      : `DAILY (today only, ${today})`;

    const tomorrowLabel = isWeekly
      ? "1-2 sentences on next week priorities"
      : "1-2 sentences on tomorrow";

    const scopeLine = branchFilter
      ? `Scope: ${branchFilter} branch only. Total clients: ${totalClients}.`
      : `Total clients in system: ${totalClients}.`;

    const prompt = `You are a business analyst for EPIC Menswear, a luxury menswear chain with 6 locations in BC and Calgary. Today is ${today}. ${scopeLine}

Period: ${periodRange}

Branch stats:
${JSON.stringify(branchStats, null, 2)}

Generate a structured ${periodLabel} briefing focused on ${focusField}. Return ONLY valid JSON — no markdown, no code fences:
{
  "today_summary": "2-3 sentence ${periodLabel} overview of activity and business health",
  "branch_reads": [
    { "branch": "branch name", "summary": "1 concise sentence on ${periodLabel} performance", "highlight": "key metric if notable, otherwise omit" }
  ],
  "action_items": [
    { "label": "specific action with numbers", "urgency": "high|medium|low" }
  ],
  "tomorrow_outlook": "${tomorrowLabel}",
  "weekly_target": { "goal": "specific measurable goal", "rationale": "why this matters now" },
  "trend_observation": "1-2 sentences on a meaningful pattern"
}

Base everything strictly on the numbers provided. If data is sparse, note what should be tracked going forward.`;

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: `Could not parse AI response. Raw: ${raw.slice(0, 200)}` },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Summary error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
