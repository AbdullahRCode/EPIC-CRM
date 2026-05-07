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
      max_tokens: 2048,
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
              text: `This is a photo of a handwritten menswear store logbook page. Extract ALL client entries you can see.

Available branches: ${BRANCHES.join(", ")}

Return ONLY valid JSON:
{
  "entries": [
    {
      "name": "client name",
      "phone": "phone number or null",
      "email": "email or null",
      "branch": "matched branch or null",
      "notes": "cleaned version of any notes/details written",
      "uncertain": false,
      "raw_text": "exact text as written for this entry"
    }
  ],
  "page_notes": "any overall page notes or dates visible"
}

Set uncertain=true for entries where handwriting is unclear or information seems incomplete.
Clean all notes for grammar and clarity while preserving specific details.`,
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

