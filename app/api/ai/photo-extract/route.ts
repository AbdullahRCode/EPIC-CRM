export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { BRANCHES } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = (imageFile.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp") || "image/jpeg";

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `This is a photo of a handwritten menswear store logbook or alteration slip. Extract ALL client entries visible.

Available branches: ${BRANCHES.join(", ")}

For each entry, extract and map into these specific fields:
- name: customer full name
- phone: phone number (digits only if possible)
- email: email address or null
- branch: matched branch name or null
- visit_date: date of visit in YYYY-MM-DD format or null
- employee: employee/staff name who logged the entry or null
- purchase_item: what was purchased (brand, style, color, size) or null
- amount_paid: numeric amount paid in dollars or null
- alteration_needed: true if any alteration is mentioned, false otherwise
- alteration_details: specific alteration instructions (e.g. "hem pants 1 inch", "take in sleeves") or null
- alteration_date_promised: promised ready date in YYYY-MM-DD format or null
- fit_notes: any size or fit information (e.g. "42R", "Mantoni fits well") or null
- remarks: any other notes not captured above or null
- uncertain: true if handwriting unclear or info seems incomplete

EPIC Menswear product knowledge for price verification:
- Carlo Lusso suits: ~$250 full suit
- Calvin Klein suits: Jacket $350, Pants $175, Full Suit $450
- Tommy Hilfiger: ~$475
- Giorgio Fiorelli, Mantoni, Bertolini, Renoir: $250-$475 range
- Sports Coats: $150-$350
- Dress Shirts: $60-$120
- Accessories (ties, belts): $20-$80

Return ONLY valid JSON:
{
  "entries": [
    {
      "name": "string",
      "phone": "string or null",
      "email": "string or null",
      "branch": "string or null",
      "visit_date": "YYYY-MM-DD or null",
      "employee": "string or null",
      "purchase_item": "string or null",
      "amount_paid": null,
      "alteration_needed": false,
      "alteration_details": "string or null",
      "alteration_date_promised": "string or null",
      "fit_notes": "string or null",
      "remarks": "string or null",
      "uncertain": false,
      "raw_text": "exact text as written"
    }
  ],
  "page_notes": "any overall page notes or dates"
}`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { entries: [] };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Photo extract error:", err);
    return NextResponse.json({ error: "Photo processing failed" }, { status: 500 });
  }
}
