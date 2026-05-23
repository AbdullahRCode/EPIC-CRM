export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_TENANT } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { query, branch } = await req.json();
    if (!query?.trim()) return NextResponse.json({ ids: [], interpretation: "" });

    // Fetch all clients for context (just the fields needed for search)
    let dbQuery = getSupabaseAdmin()
      .from("clients")
      .select("id, name, phone, email, branch, events, event_date, alterations, alteration_status, special_order, special_order_status, follow_up, visits, updated_at")
      .eq("tenant_id", DEFAULT_TENANT);

    if (branch && branch !== "All") dbQuery = dbQuery.eq("branch", branch);

    const { data: clients } = await dbQuery;
    if (!clients?.length) return NextResponse.json({ ids: [], interpretation: "No clients found." });

    // Build a compact client list for the prompt
    const clientIndex = clients.map((c) => {
      const totalSpend = (c.visits ?? []).reduce((s: number, v: { spend?: number }) => s + (v.spend ?? 0), 0);
      const lastVisit = (c.visits ?? []).sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date))[0];
      const daysSinceVisit = lastVisit
        ? Math.floor((Date.now() - new Date(lastVisit.date).getTime()) / 86400000)
        : 9999;

      return {
        id: c.id,
        name: c.name,
        branch: c.branch,
        events: c.events ?? [],
        event_date: c.event_date,
        alterations: c.alterations ?? [],
        alteration_status: c.alteration_status,
        special_order: c.special_order,
        special_order_status: c.special_order_status,
        follow_up: c.follow_up,
        total_spend: totalSpend,
        visit_count: (c.visits ?? []).length,
        days_since_visit: daysSinceVisit,
      };
    });

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a CRM search assistant for EPIC Menswear, a luxury menswear chain.

Given this natural language query: "${query}"

Here is a JSON list of clients:
${JSON.stringify(clientIndex, null, 2)}

Return ONLY valid JSON in this exact format:
{
  "ids": ["id1", "id2", ...],
  "interpretation": "One sentence explaining what you searched for"
}

Rules:
- Match clients relevant to the query based on events, alterations, spend, follow-up, days since visit, etc.
- "Cold" = 90+ days since last visit
- "VIP" = total_spend >= 1000
- "Returning" = visit_count >= 2
- Include all matching IDs, ordered by relevance
- If no matches, return empty ids array`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { ids: [], interpretation: raw };

    return NextResponse.json(result);
  } catch (err) {
    console.error("AI search error:", err);
    return NextResponse.json({ ids: [], interpretation: "Search error. Try again." }, { status: 500 });
  }
}

