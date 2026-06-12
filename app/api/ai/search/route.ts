export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_TENANT } from "@/lib/types";
import { getSessionProfile } from "@/lib/auth";
import { checkAiCap } from "@/lib/ai-limit";
import { getPriceListPrompt } from "@/lib/catalog-prompt";

export async function POST(req: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { query, branch, mode } = await req.json();
    if (!query?.trim()) return NextResponse.json({ type: "search", ids: [], interpretation: "" });

    const cap = await checkAiCap(mode === "note" ? "note" : "search", profile.userId);
    if (!cap.allowed) {
      return NextResponse.json({ error: cap.message }, { status: 429 });
    }

    // "note" mode: the caller supplies a complete prose prompt (ClientModal AI
    // Note). Skip the search machinery — and the full client-list prompt — and
    // return plain text under `result`.
    if (mode === "note") {
      const noteMsg = await getAnthropic().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: query }],
      });
      const text = noteMsg.content[0].type === "text" ? noteMsg.content[0].text : "";
      return NextResponse.json({ result: text.trim() });
    }

    // Employees are always scoped to their own branch, whatever they request
    const effectiveBranch = profile.role === "employee" ? profile.branch || "—none—" : branch;

    let dbQuery = getSupabaseAdmin()
      .from("clients")
      .select("id, name, phone, email, branch, events, event_date, alterations, alteration_status, special_order, special_order_status, follow_up, visits, updated_at")
      .eq("tenant_id", DEFAULT_TENANT);

    if (effectiveBranch && effectiveBranch !== "All") dbQuery = dbQuery.eq("branch", effectiveBranch);

    const { data: clients } = await dbQuery;
    if (!clients?.length) return NextResponse.json({ type: "search", ids: [], interpretation: "No clients found." });

    const clientIndex = clients.map((c) => {
      const totalSpend = (c.visits ?? []).reduce((s: number, v: { spend?: number }) => s + (v.spend ?? 0), 0);
      const lastVisit = (c.visits ?? []).sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date))[0];
      const daysSinceVisit = lastVisit
        ? Math.floor((Date.now() - new Date(lastVisit.date).getTime()) / 86400000)
        : 9999;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
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
          content: `You are the EPIC Menswear CRM assistant. You help staff find clients and take quick actions.

EPIC Menswear product catalog (for price verification):
${await getPriceListPrompt()}

When a user types a phone number or partial number → return client IDs matching that phone
When a user types a name → return matching client IDs ranked by relevance
When a user types "alteration done [name or phone]" → return { type: "action", action: "mark_alteration", query: "name or phone", status: "Picked up" }
When a user types "hemming done [name or phone]" → same as above
When a user types "ready [name or phone]" → return { type: "action", action: "mark_alteration", query: "...", status: "Ready" }
When a user types "order arrived [name or phone]" → return { type: "action", action: "mark_order", query: "...", status: "Arrived" }
When a user types "show alterations" → return { type: "action", action: "filter", filter: "Alterations" }
When a user types "show VIP" → return { type: "action", action: "filter", filter: "VIP" }
When a user types "show follow-up" or "needs follow-up" → return { type: "action", action: "filter", filter: "Follow-up" }
When a user types "show cold" or "cold clients" → return { type: "action", action: "filter", filter: "Cold" }
When a user types "active orders" or "show orders" → return { type: "action", action: "filter", filter: "Special Order" }
When a user types "ready for pickup" → return { type: "action", action: "filter", filter: "Alterations" }

For regular searches, return:
{ "type": "search", "ids": ["id1", "id2", ...], "interpretation": "One sentence explaining what you searched for" }

For actions, return:
{ "type": "action", "action": "mark_alteration" | "mark_order" | "filter", "query": "name or phone if applicable", "status": "new status if applicable", "filter": "filter value if applicable" }

Rules:
- "Cold" = 90+ days since last visit
- "VIP" = total_spend >= 1000
- "Returning" = visit_count >= 2
- Include all matching IDs ordered by relevance
- If no matches, return empty ids array

Here is the client list:
${JSON.stringify(clientIndex, null, 2)}

User query: "${query}"`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: "search", ids: [], interpretation: raw };

    // Ensure type field is present for backward compat
    if (!result.type) result.type = "search";

    return NextResponse.json(result);
  } catch (err) {
    console.error("AI search error:", err);
    return NextResponse.json({ type: "search", ids: [], interpretation: "Search error. Try again." }, { status: 500 });
  }
}
