export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { VISIT_REASONS, EVENT_TYPES, ALTERATION_ITEMS, ALTERATION_STATUSES } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { notes, branch } = await req.json();
    if (!notes?.trim()) {
      return NextResponse.json({ error: "No notes provided" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a data entry assistant for EPIC Menswear, a luxury menswear retailer. A staff member has typed the following notes about a new client visit.

Notes: "${notes}"
Branch: ${branch}
Today: ${today}

Extract all structured details. Return ONLY valid JSON — no markdown, no code fences:
{
  "visit": {
    "items": "items purchased or empty string",
    "spend": 0,
    "reason": "one of: ${VISIT_REASONS.join(" | ")}",
    "notes": "any remaining visit detail not captured elsewhere"
  },
  "events": [],
  "event_date": null,
  "event_note": "",
  "alterations": [],
  "alteration_note": "",
  "alteration_status": "Received",
  "special_order": "",
  "measurements": {
    "chest": "", "waist": "", "sleeve": "", "inseam": "", "neck": "", "shoulder": ""
  },
  "follow_up": { "needed": false, "reason": "" }
}

Rules:
- visit.spend is a plain number, no currency symbol (1340 not "$1340"); 0 if not mentioned
- visit.reason must be one of the listed values; default "Walk-in (purchased)" if a purchase is mentioned, "Walk-in (no purchase)" otherwise
- events must only contain values from: ${EVENT_TYPES.join(", ")}; infer from context (wedding → Wedding, prom → Prom, grad/graduation → Grad, funeral → Funeral, work event → Work)
- event_date must be ISO format YYYY-MM-DD; resolve relative dates against today (${today}); null if not mentioned
- alterations must only contain values from: ${ALTERATION_ITEMS.join(", ")}; infer from context (hem/hemmed → Hem, sleeve → Sleeves, jacket taken in → Jacket, waist/taken in → Waist, shoulders → Shoulders)
- alteration_status must be one of: ${ALTERATION_STATUSES.join(", ")}; default "Received" for new alterations
- measurements: numeric values only (chest 40 → "40", waist 34 → "34"); empty string if not mentioned
- follow_up.needed = true if notes mention callback, follow-up, check back, uncertain, or confirm details
- special_order: description if a custom/special order is mentioned, otherwise empty string`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: `Could not parse AI response. Raw: ${raw.slice(0, 200)}` },
        { status: 500 }
      );
    }
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Parse entry error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
