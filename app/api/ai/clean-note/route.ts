import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  let note = "";
  let context = "general client note";

  try {
    const body = await req.json();
    note = body.note ?? "";
    context = body.context ?? "general client note";

    if (!note.trim()) return NextResponse.json({ cleaned: note, uncertain: false });

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a note editor for EPIC Menswear, a luxury menswear CRM. Clean the following staff note for clarity, grammar, and professionalism. Keep it concise. Preserve all specific details (measurements, item names, dates, names).

Context: ${context}

Note to clean:
"${note}"

Return ONLY valid JSON:
{
  "cleaned": "the cleaned note",
  "uncertain": false,
  "uncertainty_reason": null
}

Set uncertain=true and fill uncertainty_reason if you are not confident about what was meant (ambiguous handwriting, unclear abbreviation, contradictory info, etc.)`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { cleaned: note, uncertain: false };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Clean note error:", err);
    return NextResponse.json({ cleaned: note, uncertain: false }, { status: 500 });
  }
}

