export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_TENANT, BRANCHES } from "@/lib/types";

export async function POST() {
  const keyPreview = process.env.ANTHROPIC_API_KEY?.slice(0, 10) ?? "NOT SET";
  console.log("[summary] ANTHROPIC_API_KEY prefix:", keyPreview);

  try {
    const today = new Date().toISOString().split("T")[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];

    const { data: clients, error: dbError } = await getSupabaseAdmin()
      .from("clients")
      .select(
        "id, name, branch, visits, events, event_date, alterations, alteration_status, special_order, special_order_status, follow_up, updated_at"
      )
      .eq("tenant_id", DEFAULT_TENANT)
      .gte("updated_at", sixMonthsAgo);

    if (dbError) {
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
    }

    // Build branch stats even with an empty database â€” Claude can still generate a useful summary
    const branchStats = BRANCHES.map((branch) => {
      const bc = (clients ?? []).filter((c) => c.branch === branch);
      const todayVisits = bc.filter((c) =>
        (c.visits ?? []).some((v: { date: string }) => v.date === today)
      ).length;
      const returningCount = bc.filter((c) => (c.visits ?? []).length >= 2).length;
      const alterationsReady = bc.filter((c) => c.alteration_status === "Ready").length;
      const ordersArrived = bc.filter((c) => c.special_order_status === "Arrived").length;
      const followUps = bc.filter((c) => c.follow_up?.needed).length;
      const totalSpend = bc.reduce(
        (s, c) => s + (c.visits ?? []).reduce((vs: number, v: { spend?: number }) => vs + (v.spend ?? 0), 0),
        0
      );

      return {
        branch,
        count: bc.length,
        todayVisits,
        returningCount,
        alterationsReady,
        ordersArrived,
        followUps,
        totalSpend,
      };
    });

    const totalClients = (clients ?? []).length;

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a business analyst for EPIC Menswear, a luxury menswear chain with 6 locations in BC and Calgary. Today is ${today}. Total clients in system: ${totalClients}.

Branch stats (last 6 months):
${JSON.stringify(branchStats, null, 2)}

Generate a structured daily briefing. Return ONLY valid JSON â€” no markdown, no code fences:
{
  "today_summary": "2-3 sentence overview of today's activity and overall health across all branches",
  "branch_reads": [
    { "branch": "branch name", "summary": "1 concise sentence", "highlight": "key number or action if notable, otherwise omit" }
  ],
  "action_items": [
    { "label": "specific action with numbers", "urgency": "high|medium|low" }
  ],
  "tomorrow_outlook": "1-2 sentences â€” what to focus on tomorrow",
  "weekly_target": { "goal": "specific measurable goal for the week", "rationale": "why this goal matters now" },
  "trend_observation": "1-2 sentences on a pattern worth noting"
}

If data is sparse, write realistic, helpful content about what to prepare for in the coming weeks.`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    // Strip any markdown code fences Claude might add despite the instruction
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
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

